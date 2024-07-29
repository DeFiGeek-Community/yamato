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
import Constants from "../../../v1.5/Constants";
import { ScoreRegistryHelper } from "../../testHelpers";

chai.use(smock.matchers);

/**
 * ScoreRegistry.checkpoint() Tests
 *
 * These tests verify the correct behavior of the checkpoint function in the ScoreRegistry contract.
 * The checkpoint function updates various state variables and calculates rewards based on time elapsed.
 *
 * Key aspects tested:
 * 1. Access control
 * 2. Future epoch time and inflation rate updates
 * 3. Behavior when the contract is in a killed state
 * 4. State updates when time has passed since the last checkpoint
 * 5. Behavior with different working supply scenarios
 *
 * Test structure:
 * 1. Access Control
 * 2. Future Epoch Time Update
 * 3. Killed State Behavior
 * 4. Time Passage Scenarios
 *    4.1 Non-zero Working Supply
 *    4.2 Zero Working Supply
 */

describe("ScoreRegistry.checkpoint()", () => {
  let scoreRegistry: ScoreRegistry;
  let mocks: Record<string, FakeContract>;
  let accounts: SignerWithAddress[];
  let snapshot: SnapshotRestorer;

  function setupMocks(customSetup = {}) {
    const defaultSetup = {
      futureEpochTimeWrite: FIXTURES.ymt.futureEpochTimeWrite,
      rate: FIXTURES.ymt.rate,
      scoreRelativeWeight: Constants.ten_to_the_18,
      permitDeps: true,
    };
    const setup = { ...defaultSetup, ...customSetup };

    mocks.YMT.futureEpochTimeWrite.returns(setup.futureEpochTimeWrite);
    mocks.YMT.rate.returns(setup.rate);
    mocks.ScoreWeightController.checkpointScore.returns();
    mocks.ScoreWeightController.scoreRelativeWeight.returns(
      setup.scoreRelativeWeight
    );
    mocks.Yamato.permitDeps.returns(setup.permitDeps);
  }

  before(async () => {
    accounts = await ethers.getSigners();
    mocks = await mockV1_5Fixture();
    scoreRegistry = await deployScoreRegistry();
    await initializeScoreRegistryWithMock(scoreRegistry, mocks);

    setupMocks();

    snapshot = await takeSnapshot();
  });

  beforeEach(async () => await snapshot.restore());

  context("1. Access Control", () => {
    beforeEach(async () => {
      await snapshot.restore();
      setupMocks();
    });

    it("should only allow Yamato contract to call checkpoint", async function () {
      await expect(scoreRegistry.checkpoint(accounts[1].address)).not.to.be
        .reverted;

      setupMocks({ permitDeps: false });
      await expect(
        scoreRegistry.checkpoint(accounts[1].address)
      ).to.be.revertedWith("You are not Yamato contract.");
    });
  });

  context("2. Future Epoch Time Update", () => {
    beforeEach(async () => {
      await snapshot.restore();
      setupMocks();
    });

    it("should update futureEpochTime and inflationRate when prevFutureEpoch >= periodTime", async function () {
      const initialStates = await ScoreRegistryHelper.getStates(
        scoreRegistry,
        accounts[1].address
      );

      const newRate = FIXTURES.ymt.rate.mul(2);
      const newFutureEpochTime = initialStates.futureEpochTime.add(
        FIXTURES.WEEK
      );
      mocks.YMT.rate.returns(newRate);
      mocks.YMT.futureEpochTimeWrite.returns(newFutureEpochTime);

      await scoreRegistry.checkpoint(accounts[1].address);
      const finalStates = await ScoreRegistryHelper.getStates(
        scoreRegistry,
        accounts[1].address
      );

      expect(
        finalStates.inflationRate,
        "Inflation rate should be updated to the new rate"
      ).to.equal(newRate);
      expect(
        finalStates.futureEpochTime,
        "Future epoch time should be updated to the new value"
      ).to.equal(newFutureEpochTime);
      expect(mocks.YMT.rate, "YMT.rate() should have been called").to.have.been
        .called;
      expect(
        mocks.YMT.futureEpochTimeWrite,
        "YMT.futureEpochTimeWrite() should have been called"
      ).to.have.been.called;
    });

    it("should not update futureEpochTime and inflationRate when prevFutureEpoch < periodTime", async function () {
      // Setup
      const pastFutureEpochTime =
        (await time.latest()) - Constants.YEAR.toNumber();

      // Configure mocks
      mocks.YmtMinter.YMT.returns(mocks.YMT.address);
      mocks.YmtMinter.scoreWeightController.returns(
        mocks.ScoreWeightController.address
      );
      mocks.ScoreWeightController.veYMT.returns(mocks.veYMT.address);
      mocks.YMT.rate.returns(FIXTURES.ymt.rate);
      mocks.YMT.futureEpochTimeWrite.returns(pastFutureEpochTime);

      // Re-deploy & Initialize ScoreRegistry
      scoreRegistry = await deployScoreRegistry();
      await scoreRegistry.initialize(
        mocks.YmtMinter.address,
        mocks.Yamato.address
      );

      // Capture initial state
      const initialStates = await ScoreRegistryHelper.getStates(
        scoreRegistry,
        accounts[1].address
      );

      // Perform checkpoint
      await scoreRegistry.checkpoint(accounts[1].address);

      // Capture final state
      const finalStates = await ScoreRegistryHelper.getStates(
        scoreRegistry,
        accounts[1].address
      );

      // Assertions
      expect(
        finalStates.inflationRate,
        "Inflation rate should remain unchanged"
      ).to.equal(initialStates.inflationRate);
      expect(
        finalStates.futureEpochTime,
        "Future epoch time should remain unchanged"
      ).to.equal(initialStates.futureEpochTime);
    });
  });

  context("3. Killed State Behavior", () => {
    beforeEach(async () => {
      await snapshot.restore();
      setupMocks();
      scoreRegistry = await deployScoreRegistry();
      await initializeScoreRegistryWithMock(scoreRegistry, mocks);
    });

    it("should update period and timestamps but maintain constant supply-related values when contract is killed", async function () {
      await scoreRegistry.setKilled(true);
      const tester = accounts[1].address;
      const initialStates = await ScoreRegistryHelper.getStates(
        scoreRegistry,
        tester
      );

      await scoreRegistry.checkpoint(tester);

      const finalStates = await ScoreRegistryHelper.getStates(
        scoreRegistry,
        tester
      );
      expect(finalStates.period, "Period should be incremented").to.equal(
        initialStates.period.add(1)
      );
      expect(
        finalStates.periodTimestamp,
        "New period timestamp should match block timestamp"
      ).to.equal(finalStates.timestamp);
      expect(
        finalStates.integrateInvSupply,
        "integrateInvSupply should not change"
      ).to.equal(initialStates.integrateInvSupply);
      expect(
        finalStates.integrateFraction,
        "integrateFraction should not change"
      ).to.equal(initialStates.integrateFraction);
      expect(
        finalStates.integrateInvSupplyOf,
        "integrateInvSupplyOf should not change"
      ).to.equal(initialStates.integrateInvSupplyOf);
      expect(
        finalStates.integrateCheckpointOf,
        "integrateCheckpointOf should be updated to block timestamp"
      )
        .to.be.gt(initialStates.integrateCheckpointOf)
        .and.to.equal(finalStates.timestamp);
    });
  });

  context("4. When time has passed since last checkpoint execution", () => {
    let initialStates;

    beforeEach(async () => {
      scoreRegistry = await deployScoreRegistry();
      await initializeScoreRegistryWithMock(scoreRegistry, mocks);
      setupMocks();
      initialStates = await ScoreRegistryHelper.getStates(
        scoreRegistry,
        accounts[1].address
      );
      await time.increaseTo(initialStates.timestamp + 1);
    });

    context("4.1 When workingSupply is not zero", () => {
      beforeEach(async () => {
        setupMocks();
        await ScoreRegistryHelper.setWorkingSupply(
          scoreRegistry,
          ethers.utils.parseUnits("100", 18)
        );
      });

      it("should increase integrateInvSupply over a single week period", async function () {
        const initialStates = await ScoreRegistryHelper.getStates(
          scoreRegistry,
          accounts[1].address
        );

        await time.increase(FIXTURES.WEEK);
        await scoreRegistry.checkpoint(accounts[1].address);

        const finalStates = await ScoreRegistryHelper.getStates(
          scoreRegistry,
          accounts[1].address
        );

        expect(
          finalStates.integrateInvSupply,
          "IntegrateInvSupply should increase after one week"
        ).to.be.greaterThan(initialStates.integrateInvSupply);
        expect(
          finalStates.period,
          "Period should be incremented by one"
        ).to.equal(initialStates.period.add(1));
        expect(
          finalStates.periodTimestamp,
          "Period timestamp should be updated to reflect the week's passage"
        ).to.be.greaterThan(initialStates.periodTimestamp);
      });

      it("should correctly update integrateInvSupply over multiple weeks", async function () {
        const initialStates = await ScoreRegistryHelper.getStates(
          scoreRegistry,
          accounts[1].address
        );

        await time.increase(FIXTURES.WEEK.mul(3)); // Increase by 3 weeks
        await scoreRegistry.checkpoint(accounts[1].address);

        const finalStates = await ScoreRegistryHelper.getStates(
          scoreRegistry,
          accounts[1].address
        );

        expect(
          finalStates.integrateInvSupply,
          "IntegrateInvSupply should increase significantly over three weeks"
        ).to.be.greaterThan(initialStates.integrateInvSupply);
        // Consider adding more specific checks here, e.g., ensuring the increase is proportional to the time passed
      });

      it("should update user's integrateFraction when they have a non-zero working balance", async function () {
        await ScoreRegistryHelper.setWorkingBalance(
          scoreRegistry,
          accounts[1].address,
          ethers.utils.parseUnits("10", 18)
        );
        const initialStates = await ScoreRegistryHelper.getStates(
          scoreRegistry,
          accounts[1].address
        );
        await time.increase(FIXTURES.WEEK);

        await scoreRegistry.checkpoint(accounts[1].address);
        const finalStates = await ScoreRegistryHelper.getStates(
          scoreRegistry,
          accounts[1].address
        );

        expect(
          finalStates.integrateFraction,
          "User's integrateFraction should increase when they have a working balance"
        ).to.be.greaterThan(initialStates.integrateFraction);
      });
    });

    context("4.2 When workingSupply is zero", () => {
      beforeEach(async () => {
        setupMocks();
        await ScoreRegistryHelper.setWorkingSupply(
          scoreRegistry,
          ethers.utils.parseUnits("0", 18)
        );
      });

      it("should not increase integrateInvSupply when workingSupply is zero", async function () {
        const initialStates = await ScoreRegistryHelper.getStates(
          scoreRegistry,
          accounts[1].address
        );

        await time.increase(FIXTURES.WEEK);
        await scoreRegistry.checkpoint(accounts[1].address);

        const finalStates = await ScoreRegistryHelper.getStates(
          scoreRegistry,
          accounts[1].address
        );

        expect(
          finalStates.integrateInvSupply,
          "IntegrateInvSupply should remain unchanged when workingSupply is zero"
        ).to.equal(initialStates.integrateInvSupply);
      });

      it("should still update period and timestamps when workingSupply is zero", async function () {
        const initialStates = await ScoreRegistryHelper.getStates(
          scoreRegistry,
          accounts[1].address
        );

        await time.increase(FIXTURES.WEEK);
        await scoreRegistry.checkpoint(accounts[1].address);

        const finalStates = await ScoreRegistryHelper.getStates(
          scoreRegistry,
          accounts[1].address
        );

        expect(
          finalStates.period,
          "Period should be incremented even with zero workingSupply"
        ).to.equal(initialStates.period.add(1));
        expect(
          finalStates.periodTimestamp,
          "Period timestamp should be updated even with zero workingSupply"
        ).to.be.greaterThan(initialStates.periodTimestamp);
      });

      it("should not update user's integrateFraction when workingSupply is zero", async function () {
        await ScoreRegistryHelper.setWorkingBalance(
          scoreRegistry,
          accounts[1].address,
          ethers.utils.parseUnits("10", 18)
        );
        const initialStates = await ScoreRegistryHelper.getStates(
          scoreRegistry,
          accounts[1].address
        );
        await time.increase(FIXTURES.WEEK);

        await scoreRegistry.checkpoint(accounts[1].address);
        const finalStates = await ScoreRegistryHelper.getStates(
          scoreRegistry,
          accounts[1].address
        );

        expect(
          finalStates.integrateFraction,
          "User's integrateFraction should remain unchanged when workingSupply is zero"
        ).to.equal(initialStates.integrateFraction);
      });
    });
  });

  context("5. Edge Cases", () => {
    beforeEach(async () => {
      await snapshot.restore();
      scoreRegistry = await deployScoreRegistry();
      await initializeScoreRegistryWithMock(scoreRegistry, mocks);
      setupMocks();
    });

    it("should handle multiple checkpoints in quick succession", async function () {
      const initialStates = await ScoreRegistryHelper.getStates(
        scoreRegistry,
        accounts[1].address
      );

      for (let i = 0; i < 5; i++) {
        await scoreRegistry.checkpoint(accounts[1].address);
      }

      const finalStates = await ScoreRegistryHelper.getStates(
        scoreRegistry,
        accounts[1].address
      );

      expect(
        finalStates.period,
        "Period should be incremented per multiple checkpoints in quick succession"
      ).to.equal(initialStates.period.add(5));
    });

    it("should handle extremely large working supply values", async function () {
      const largeWorkingSupply = ethers.constants.MaxUint256.div(2);
      await ScoreRegistryHelper.setWorkingSupply(
        scoreRegistry,
        largeWorkingSupply
      );

      await time.increase(FIXTURES.WEEK);
      await expect(
        scoreRegistry.checkpoint(accounts[1].address),
        "Checkpoint should not revert with large working supply"
      ).to.not.be.reverted;
    });
  });

  context("6. Interaction with ScoreWeightController", () => {
    beforeEach(async () => {
      await snapshot.restore();
      setupMocks();
    });

    it("should handle different relative weights from ScoreWeightController", async function () {
      const testCases = [
        { weight: 0, description: "zero weight" },
        { weight: Constants.ten_to_the_18.div(2), description: "half weight" },
        {
          weight: Constants.ten_to_the_18.mul(2),
          description: "double weight",
        },
      ];

      for (const testCase of testCases) {
        setupMocks({ scoreRelativeWeight: testCase.weight });
        await expect(
          scoreRegistry.checkpoint(accounts[1].address),
          `Checkpoint should not revert with ${testCase.description}`
        ).to.not.be.reverted;
      }
    });
  });

  context("7. Gas Consumption", () => {
    beforeEach(async () => {
      await snapshot.restore();
      setupMocks();
    });

    it("should have reasonable gas consumption", async function () {
      const testCases = [
        { description: "normal conditions", setupFn: async () => {} },
        {
          description: "with large working supply",
          setupFn: async () => {
            await ScoreRegistryHelper.setWorkingSupply(
              scoreRegistry,
              ethers.utils.parseUnits("1000000", 18)
            );
          },
        },
        {
          description: "after long time period",
          setupFn: async () => {
            await time.increase(FIXTURES.YEAR);
          },
        },
      ];

      for (const testCase of testCases) {
        await testCase.setupFn();
        const tx = await scoreRegistry.checkpoint(accounts[1].address);
        const receipt = await tx.wait();
        // console.log(
        //   `Gas used for checkpoint (${testCase.description}):`,
        //   receipt.gasUsed.toString()
        // );
        expect(receipt.gasUsed.toNumber()).to.be.lessThan(
          300000,
          `Gas consumption should be reasonable for ${testCase.description}`
        );
      }
    });
  });
});
