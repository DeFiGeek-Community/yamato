import { ethers } from "hardhat";
import chai, { expect } from "chai";
import { FakeContract, smock } from "@defi-wonderland/smock";
import {
  SnapshotRestorer,
  takeSnapshot,
  time,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ScoreRegistry } from "../../../../typechain";
import {
  FIXTURES,
  mockV1_5Fixture,
  deployScoreRegistry,
  initializeScoreRegistryWithMock,
} from "../../../param/fixture";
import { startImpersonate, expectEventEmitted } from "../../../param/helper";
import { ScoreRegistryHelper } from "../../testHelpers";
import Constants from "../../../v1.5/Constants";

chai.use(smock.matchers);

/**
 * ScoreRegistry.userCheckpoint() Tests
 *
 * These tests verify the correct behavior of the userCheckpoint function in the ScoreRegistry contract.
 *
 * Key concepts:
 * - Working Balance: Represents the user's current contribution or active participation.
 * - Integrate Fraction: Represents the user's accumulated score over time, which determines the mintable amount.
 * - Checkpoint: The process of updating a user's score and the overall state of the ScoreRegistry.
 *
 * Test structure:
 * 1. Access Control
 * 2. Working Balance Updates
 * 3. Integrate Fraction Accumulation
 * 4. Time and Period Handling
 * 5. Price Volatility Effects
 * 6. Multiple Users Interaction
 * 7. Edge Cases
 * 8. Inflation Rate Changes
 * 9. Killed State Behavior
 * 10. Interaction with ScoreWeightController
 */

describe("ScoreRegistry.userCheckpoint()", () => {
  let scoreRegistry: ScoreRegistry;
  let mocks: Record<string, FakeContract>;
  let accounts: SignerWithAddress[];
  let snapshot: SnapshotRestorer;

  function setupMocks(customSetup = {}) {
    const defaultSetup = {
      pledge: FIXTURES.pledge,
      totalDebt: FIXTURES.yamato.totalDebt,
      price: FIXTURES.priceFeed.price,
      futureEpochTimeWrite: FIXTURES.ymt.futureEpochTimeWrite,
      rate: FIXTURES.ymt.rate,
      scoreRelativeWeight: Constants.ten_to_the_18,
      veBalance: FIXTURES.veYMT.balance,
      veTotalSupply: FIXTURES.veYMT.totalSupply,
    };
    const setup = { ...defaultSetup, ...customSetup };

    mocks.Yamato.currencyOS.returns(mocks.CurrencyOS.address);
    mocks.Yamato.getPledge.returns({
      coll: setup.pledge.coll,
      debt: setup.pledge.debt,
      isCreated: setup.pledge.isCreated,
      owner: setup.pledge.owner,
      priority: setup.pledge.priority,
    });

    mocks.YMT.futureEpochTimeWrite.returns(setup.futureEpochTimeWrite);
    mocks.YMT.rate.returns(setup.rate);
    mocks.ScoreWeightController.checkpointScore.returns();
    mocks.ScoreWeightController.scoreRelativeWeight.returns(
      setup.scoreRelativeWeight
    );
    mocks.Yamato.getTotalDebt.returns(setup.totalDebt);
    mocks.CurrencyOS.priceFeed.returns(mocks.PriceFeed.address);
    mocks.PriceFeed.fetchPrice.returns(setup.price);
    mocks.PriceFeed.getPrice.returns(setup.price);
    mocks.PriceFeed.lastGoodPrice.returns(setup.price);
    mocks.veYMT["balanceOf(address)"].returns(setup.veBalance);
    mocks.veYMT["totalSupply()"].returns(setup.veTotalSupply);
  }

  before(async () => {
    accounts = await ethers.getSigners();
    mocks = await mockV1_5Fixture();
    scoreRegistry = await deployScoreRegistry();
    await initializeScoreRegistryWithMock(scoreRegistry, mocks);

    snapshot = await takeSnapshot();
  });

  context("1. Access Control", () => {
    beforeEach(async () => {
      await snapshot.restore();
      setupMocks();
    });

    it("should allow a user to call for themselves", async function () {
      const tx = await scoreRegistry
        .connect(accounts[1])
        .userCheckpoint(accounts[1].address);

      await expectEventEmitted(tx, "UpdateScoreLimit", {
        user: accounts[1].address,
      });
    });

    it("should allow YmtMinter to call for any user", async function () {
      const ymtMinterSigner = await startImpersonate(mocks.YmtMinter.address);

      const tx = await scoreRegistry
        .connect(ymtMinterSigner)
        .userCheckpoint(accounts[2].address);

      await expectEventEmitted(tx, "UpdateScoreLimit", {
        user: accounts[2].address,
      });
    });

    it("should revert calls from unauthorized users", async function () {
      await expect(
        scoreRegistry.connect(accounts[1]).userCheckpoint(accounts[2].address)
      ).to.be.revertedWith("dev: unauthorized");
    });
  });

  context("2. Working Balance Updates", () => {
    beforeEach(async () => {
      await snapshot.restore();
      setupMocks({
        pledge: {
          ...FIXTURES.pledge,
          owner: accounts[1].address,
        },
      });
    });

    it("should update user's working balance immediately after state change", async function () {
      const initialWorkingBalance = await scoreRegistry.workingBalances(
        accounts[1].address
      );

      await scoreRegistry
        .connect(accounts[1])
        .userCheckpoint(accounts[1].address);

      const newWorkingBalance = await scoreRegistry.workingBalances(
        accounts[1].address
      );
      expect(newWorkingBalance).to.be.gt(initialWorkingBalance);
    });

    it("should update total working supply", async function () {
      const initialWorkingSupply = await scoreRegistry.workingSupply();

      const event = (
        await (
          await scoreRegistry
            .connect(accounts[1])
            .userCheckpoint(accounts[1].address)
        ).wait()
      ).events.find((event) => event.event === "UpdateScoreLimit");
      const additionalBalance = event.args[4];

      const newWorkingSupply = await scoreRegistry.workingSupply();
      expect(newWorkingSupply).to.be.equal(
        initialWorkingSupply.add(additionalBalance)
      );
    });
  });

  context("3. Integrate Fraction Accumulation", () => {
    beforeEach(async () => {
      await snapshot.restore();
      mocks.ScoreWeightController.scoreRelativeWeight.returns(
        ethers.utils.parseEther("1")
      );
      setupMocks();
      await ScoreRegistryHelper.setWorkingSupply(
        scoreRegistry,
        ethers.utils.parseEther("1000")
      );
      await ScoreRegistryHelper.setWorkingBalance(
        scoreRegistry,
        accounts[1].address,
        ethers.utils.parseEther("100")
      );
    });

    it("should increase integrate fraction over time when working balance is non-zero", async () => {
      await scoreRegistry
        .connect(accounts[1])
        .userCheckpoint(accounts[1].address);
      const initialIntegrateFraction = await scoreRegistry.integrateFraction(
        accounts[1].address
      );

      // Advance time
      await time.increase(Constants.WEEK.mul(4));
      await ethers.provider.send("evm_mine", []);

      await scoreRegistry
        .connect(accounts[1])
        .userCheckpoint(accounts[1].address);

      const newIntegrateFraction = await scoreRegistry.integrateFraction(
        accounts[1].address
      );
      expect(newIntegrateFraction).to.be.gt(initialIntegrateFraction);
    });

    it("should not increase integrate fraction when working balance is zero", async () => {
      await scoreRegistry
        .connect(accounts[1])
        .userCheckpoint(accounts[1].address);
      const initialIntegrateFraction = await scoreRegistry.integrateFraction(
        accounts[1].address
      );

      // Set working balance to zero
      await ScoreRegistryHelper.setWorkingBalance(
        scoreRegistry,
        accounts[1].address,
        ethers.utils.parseEther("0")
      );

      await scoreRegistry
        .connect(accounts[1])
        .userCheckpoint(accounts[1].address);

      const newIntegrateFraction = await scoreRegistry.integrateFraction(
        accounts[1].address
      );
      expect(newIntegrateFraction).to.equal(initialIntegrateFraction);
    });

    it("should not change integrate fraction for multiple calls in a same block", async () => {
      await scoreRegistry
        .connect(accounts[1])
        .userCheckpoint(accounts[1].address);

      // Call checkpoint multiple times in same block
      await ethers.provider.send("evm_setAutomine", [false]);

      const initialIntegrateFraction = await scoreRegistry.integrateFraction(
        accounts[1].address
      );
      for (let i = 0; i < 5; i++) {
        await scoreRegistry
          .connect(accounts[1])
          .userCheckpoint(accounts[1].address);
      }

      await ethers.provider.send("evm_mine", []);
      await ethers.provider.send("evm_setAutomine", [true]);

      const secondIntegrateFraction = await scoreRegistry.integrateFraction(
        accounts[1].address
      );

      await scoreRegistry
        .connect(accounts[1])
        .userCheckpoint(accounts[1].address);

      const thirdIntegrateFraction = await scoreRegistry.integrateFraction(
        accounts[1].address
      );

      const integrateFractionDiff1_2 = secondIntegrateFraction.sub(
        initialIntegrateFraction
      );
      const integrateFractionDiff2_3 = thirdIntegrateFraction.sub(
        secondIntegrateFraction
      );
      expect(integrateFractionDiff1_2).to.be.closeTo(
        integrateFractionDiff2_3,
        integrateFractionDiff1_2.div(1000)
      ); // 0.1% tolerance
      expect(initialIntegrateFraction).not.to.be.equal(0);
      expect(secondIntegrateFraction).not.to.be.equal(0);
      expect(thirdIntegrateFraction).not.to.be.equal(0);

      for (let i = 0; i < 10; i++) {
        await scoreRegistry
          .connect(accounts[1])
          .userCheckpoint(accounts[1].address);
      }

      const fourthIntegrateFraction = await scoreRegistry.integrateFraction(
        accounts[1].address
      );
      const integrateFractionDiff3_4 = fourthIntegrateFraction.sub(
        thirdIntegrateFraction
      );
      // console.log(integrateFractionDiff2_3.toString());
      // console.log(integrateFractionDiff3_4.toString());
      expect(integrateFractionDiff3_4).is.greaterThan(integrateFractionDiff2_3);
    });

    it("should update user integrate fraction when called in a new period", async function () {
      await scoreRegistry
        .connect(accounts[1])
        .userCheckpoint(accounts[1].address);
      const initialIntegrateFraction = await scoreRegistry.integrateFraction(
        accounts[1].address
      );

      await time.increase(Constants.YEAR);
      await ethers.provider.send("evm_mine", []);

      await scoreRegistry
        .connect(accounts[1])
        .userCheckpoint(accounts[1].address);
      const newIntegrateFraction = await scoreRegistry.integrateFraction(
        accounts[1].address
      );

      expect(newIntegrateFraction).to.be.gt(initialIntegrateFraction);
    });
  });

  context("4. Price Volatility Effects", () => {
    beforeEach(async () => {
      await snapshot.restore();
      setupMocks();
    });

    it("should update score correctly when price increases", async function () {
      await scoreRegistry
        .connect(accounts[1])
        .userCheckpoint(accounts[1].address);
      const initialScore = await scoreRegistry.workingBalances(
        accounts[1].address
      );

      setupMocks({ price: FIXTURES.priceFeed.price.mul(2) });
      await scoreRegistry
        .connect(accounts[1])
        .userCheckpoint(accounts[1].address);
      const newScore = await scoreRegistry.workingBalances(accounts[1].address);

      expect(newScore).to.be.gt(initialScore);
    });

    it("should update score correctly when price decreases", async function () {
      await scoreRegistry
        .connect(accounts[1])
        .userCheckpoint(accounts[1].address);
      const initialScore = await scoreRegistry.workingBalances(
        accounts[1].address
      );

      setupMocks({ price: FIXTURES.priceFeed.price.div(2) });
      await scoreRegistry
        .connect(accounts[1])
        .userCheckpoint(accounts[1].address);
      const newScore = await scoreRegistry.workingBalances(accounts[1].address);

      expect(newScore).to.be.lt(initialScore);
    });
  });

  context("5. Multiple Users Interaction", () => {
    beforeEach(async () => {
      await snapshot.restore();
      setupMocks();
    });

    it("should correctly update total working supply with multiple users", async function () {
      const initialSupply = await scoreRegistry.workingSupply();

      await scoreRegistry
        .connect(accounts[1])
        .userCheckpoint(accounts[1].address);
      await scoreRegistry
        .connect(accounts[2])
        .userCheckpoint(accounts[2].address);

      const newSupply = await scoreRegistry.workingSupply();
      expect(newSupply).to.be.gt(initialSupply);
    });

    it("should maintain correct proportions of working balances between users", async function () {
      setupMocks({
        pledge: { ...FIXTURES.pledge, debt: ethers.utils.parseEther("100") },
      });
      await scoreRegistry
        .connect(accounts[1])
        .userCheckpoint(accounts[1].address);

      setupMocks({
        pledge: { ...FIXTURES.pledge, debt: ethers.utils.parseEther("200") },
      });
      await scoreRegistry
        .connect(accounts[2])
        .userCheckpoint(accounts[2].address);

      const balance1 = await scoreRegistry.workingBalances(accounts[1].address);
      const balance2 = await scoreRegistry.workingBalances(accounts[2].address);

      expect(balance2).to.be.closeTo(balance1.mul(2), balance1.div(100)); // Allow 1% deviation
      expect(balance1).not.to.be.equal(0);
      expect(balance2).not.to.be.equal(0);
    });
  });

  context("6. Edge Cases", () => {
    beforeEach(async () => {
      await snapshot.restore();
      setupMocks();
    });

    it("should handle large debt values", async function () {
      let dividerDebt = ethers.utils.parseUnits("1", 1);
      let dividerTotalDebt = ethers.utils.parseUnits("1", 19);
      setupMocks({
        pledge: {
          ...FIXTURES.pledge,
          debt: ethers.constants.MaxUint256.div(dividerDebt),
        },
        totalDebt: ethers.constants.MaxUint256.div(dividerTotalDebt),
      });

      await expect(
        scoreRegistry.connect(accounts[1]).userCheckpoint(accounts[1].address)
      ).to.be.reverted;

      dividerDebt = ethers.utils.parseUnits("1", 1);
      dividerTotalDebt = ethers.utils.parseUnits("1", 20);
      setupMocks({
        pledge: {
          ...FIXTURES.pledge,
          debt: ethers.constants.MaxUint256.div(dividerDebt),
        },
        totalDebt: ethers.constants.MaxUint256.div(dividerTotalDebt),
      });

      await expect(
        scoreRegistry.connect(accounts[1]).userCheckpoint(accounts[1].address)
      ).to.not.be.reverted;
    });

    it("should handle extremely small non-zero user's debt", async function () {
      setupMocks({
        pledge: { ...FIXTURES.pledge, debt: 1 },
      });

      await scoreRegistry
        .connect(accounts[1])
        .userCheckpoint(accounts[1].address);
      await scoreRegistry
        .connect(accounts[1])
        .userCheckpoint(accounts[1].address);

      const workingBalance = await scoreRegistry.workingBalances(
        accounts[1].address
      );
      expect(workingBalance).to.be.gt(0);
    });

    it("should handle edge case of zero balance", async function () {
      setupMocks({
        pledge: { ...FIXTURES.pledge, debt: 0, coll: 0 },
      });

      await scoreRegistry
        .connect(accounts[1])
        .userCheckpoint(accounts[1].address);

      const workingBalance = await scoreRegistry.workingBalances(
        accounts[1].address
      );
      expect(workingBalance).to.equal(0);
    });
  });

  context("7. Inflation Rate Changes", () => {
    beforeEach(async () => {
      await snapshot.restore();
      setupMocks();
    });

    it("should update inflation rate when future epoch time is reached", async function () {
      const initialRate = await scoreRegistry.inflationRate();
      const futureEpochTime = await scoreRegistry.futureEpochTime();

      // Advance time to just after the future epoch time
      await time.increaseTo(futureEpochTime.add(1));

      // Set new rate in YMT mock
      const newRate = initialRate.mul(2);
      mocks.YMT.rate.returns(newRate);

      await scoreRegistry
        .connect(accounts[1])
        .userCheckpoint(accounts[1].address);

      const updatedRate = await scoreRegistry.inflationRate();
      expect(updatedRate).to.equal(newRate);
    });

    it("should not update inflation rate before future epoch time", async function () {
      const initialRate = await scoreRegistry.inflationRate();
      const futureEpochTime = await scoreRegistry.futureEpochTime();

      // Advance time to just before the future epoch time
      await time.increaseTo(futureEpochTime.sub(1));

      await scoreRegistry
        .connect(accounts[1])
        .userCheckpoint(accounts[1].address);

      const updatedRate = await scoreRegistry.inflationRate();
      expect(updatedRate).to.equal(initialRate);
    });
  });

  context("8. Killed State Behavior", () => {
    beforeEach(async () => {
      await snapshot.restore();
      setupMocks();
    });

    it("should not accumulate integrate fraction when contract is killed", async function () {
      // Initial checkpoint
      await scoreRegistry
        .connect(accounts[1])
        .userCheckpoint(accounts[1].address);
      const initialIntegrateFraction = await scoreRegistry.integrateFraction(
        accounts[1].address
      );

      // Kill the contract
      await scoreRegistry.setKilled(true);

      // Advance time
      await time.increase(Constants.WEEK.mul(4));

      // Checkpoint again
      await scoreRegistry
        .connect(accounts[1])
        .userCheckpoint(accounts[1].address);

      const newIntegrateFraction = await scoreRegistry.integrateFraction(
        accounts[1].address
      );
      expect(newIntegrateFraction).to.equal(initialIntegrateFraction);
    });

    it("should resume accumulation when contract is unkilled", async function () {
      // Kill the contract
      await scoreRegistry.setKilled(true);

      // Initial checkpoint
      await scoreRegistry
        .connect(accounts[1])
        .userCheckpoint(accounts[1].address);
      const initialIntegrateFraction = await scoreRegistry.integrateFraction(
        accounts[1].address
      );

      // Advance time
      await time.increase(Constants.WEEK.mul(4));

      // Unkill the contract
      await scoreRegistry.setKilled(false);

      // Checkpoint again
      await scoreRegistry
        .connect(accounts[1])
        .userCheckpoint(accounts[1].address);

      const newIntegrateFraction = await scoreRegistry.integrateFraction(
        accounts[1].address
      );
      expect(newIntegrateFraction).to.be.gt(initialIntegrateFraction);
    });
  });

  context("9. Interaction with ScoreWeightController", () => {
    beforeEach(async () => {
      await snapshot.restore();
      setupMocks();
    });

    it("should call checkpointScore on ScoreWeightController", async function () {
      mocks.ScoreWeightController.checkpointScore.reset();
      await scoreRegistry
        .connect(accounts[1])
        .userCheckpoint(accounts[1].address);
      expect(mocks.ScoreWeightController.checkpointScore).to.have.been
        .calledOnce;
    });

    it("should use scoreRelativeWeight from ScoreWeightController", async function () {
      const customWeight = ethers.utils.parseEther("0.5"); // 50% weight
      mocks.ScoreWeightController.scoreRelativeWeight.returns(customWeight);

      const periodTimestamp = await scoreRegistry.periodTimestamp(
        await scoreRegistry.period()
      );
      const roundedPeriodTimestamp = periodTimestamp
        .div(FIXTURES.WEEK)
        .mul(FIXTURES.WEEK);

      await scoreRegistry
        .connect(accounts[1])
        .userCheckpoint(accounts[1].address);

      expect(
        mocks.ScoreWeightController.scoreRelativeWeight
      ).to.have.been.calledWith(scoreRegistry.address, roundedPeriodTimestamp);

      const workingBalance = await scoreRegistry.workingBalances(
        accounts[1].address
      );
      expect(workingBalance).to.not.equal(0);
    });
  });
});
