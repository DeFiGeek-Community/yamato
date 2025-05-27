import { ethers } from "hardhat";
import chai, { expect } from "chai";
import { FakeContract, smock } from "@defi-wonderland/smock";
import {
  SnapshotRestorer,
  takeSnapshot,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { ScoreRegistry } from "../../../../typechain";
import {
  FIXTURES,
  mockV1_5Fixture,
  deployScoreRegistry,
  initializeScoreRegistryWithMock,
} from "../../../param/fixture";

chai.use(smock.matchers);

/**
 * ScoreRegistry.updateScoreLimit() Tests
 *
 * Key Concepts:
 * - Score Limit = min(debt, baseScore + additionalScore)
 * - baseScore = debt * tokenless_production_rate (40%)
 * - additionalScore = totalDebt * veShare * token_production_rate (60%)
 * - veShare = userVeBalance / veTotalSupply
 * - Final score (working balance) = Score Limit * coefficient (based on ICR)
 */

describe("ScoreRegistry.updateScoreLimit()", () => {
  let scoreRegistry: ScoreRegistry;
  let mocks: Record<string, FakeContract>;
  let accounts: SignerWithAddress[];
  let snapshot: SnapshotRestorer;

  function setupMocks(customSetup = {}) {
    const defaultSetup = {
      permitDeps: true,
      veBalance: FIXTURES.veYMT.balance,
      veTotalSupply: FIXTURES.veYMT.totalSupply,
    };
    const setup = { ...defaultSetup, ...customSetup };

    mocks.Yamato.permitDeps.returns(setup.permitDeps);
    mocks.veYMT["balanceOf(address)"].returns(setup.veBalance);
    mocks.veYMT["totalSupply()"].returns(setup.veTotalSupply);
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

    it("should only allow Yamato contract to call updateScoreLimit", async function () {
      await expect(
        scoreRegistry.updateScoreLimit(accounts[1].address, 100, 1000, 150)
      ).not.to.be.reverted;

      setupMocks({ permitDeps: false });
      await expect(
        scoreRegistry.updateScoreLimit(accounts[1].address, 100, 1000, 150)
      ).to.be.revertedWith("You are not Yamato contract.");
    });
  });

  context("2. Score Limit Calculation", () => {
    beforeEach(async () => {
      await snapshot.restore();
      setupMocks();
    });

    it("should calculate limit as debt * tokenless_production when veTotalSupply is zero", async function () {
      setupMocks({ veTotalSupply: 0 });
      const debt = FIXTURES.pledge.debt;
      await scoreRegistry.updateScoreLimit(
        accounts[1].address,
        debt,
        FIXTURES.yamato.totalDebt,
        FIXTURES.pledge.ICR // 13500, coefficient: x1
      );

      const workingBalance = await scoreRegistry.workingBalances(
        accounts[1].address
      );
      const expectedLimit = debt.mul(4).div(10); // debt * tokenless_production_rate (40%)
      expect(
        workingBalance,
        "Working balance should be debt * tokenless_production_rate when veTotalSupply is zero"
      ).to.equal(expectedLimit);
    });

    it("should calculate limit correctly when veShare is small and limit is less than debt", async function () {
      const veBalance = FIXTURES.veYMT.balance.div(10); // Reduce veBalance to ensure limit < debt
      const veTotalSupply = FIXTURES.veYMT.totalSupply;
      const totalDebt = FIXTURES.yamato.totalDebt;
      setupMocks({ veBalance });
      const debt = FIXTURES.pledge.debt.mul(20);
      await scoreRegistry.updateScoreLimit(
        accounts[1].address,
        debt,
        totalDebt,
        FIXTURES.pledge.ICR // 13500, coefficient: x1
      );

      const workingBalance = await scoreRegistry.workingBalances(
        accounts[1].address
      );
      const baseScore = debt.mul(4).div(10); // debt * ve_tokenless_production_rate
      const veShare = veBalance
        .mul(ethers.constants.WeiPerEther)
        .div(veTotalSupply);
      const additionalScore = totalDebt
        .mul(veShare)
        .mul(6) // ve_token_production_rate (60%)
        .div(10)
        .div(ethers.constants.WeiPerEther);
      const expectedLimit = baseScore.add(additionalScore);

      expect(
        workingBalance,
        "Working balance should equal calculated limit when it's less than debt"
      ).to.equal(expectedLimit);
      expect(
        workingBalance,
        "Working balance should be less than debt"
      ).to.be.lt(debt);
    });

    it("should cap the limit at debt when calculated limit exceeds debt", async function () {
      const veBalance = FIXTURES.veYMT.balance.mul(2); // Increase veBalance to ensure the limit exceeds debt
      setupMocks({ veBalance });
      const debt = FIXTURES.pledge.debt;
      const totalDebt = FIXTURES.yamato.totalDebt;
      await scoreRegistry.updateScoreLimit(
        accounts[1].address,
        debt,
        totalDebt,
        FIXTURES.pledge.ICR // 13500, coefficient: x1
      );

      const workingBalance = await scoreRegistry.workingBalances(
        accounts[1].address
      );
      const baseScore = debt.mul(4).div(10); // debt * ve_tokenless_production_rate
      const veShare = veBalance
        .mul(ethers.constants.WeiPerEther)
        .div(FIXTURES.veYMT.totalSupply);
      const additionalScore = totalDebt
        .mul(veShare)
        .mul(6) // ve_token_production_rate (60%)
        .div(10)
        .div(ethers.constants.WeiPerEther);
      const calculatedLimit = baseScore.add(additionalScore);

      expect(
        workingBalance,
        "Working balance should be capped at debt amount when calculated limit exceeds debt"
      ).to.equal(debt);
      expect(
        calculatedLimit,
        "Calculated limit should exceed debt"
      ).is.greaterThan(debt);
    });

    it("should handle zero totalDebt correctly", async function () {
      const debt = FIXTURES.pledge.debt;
      await scoreRegistry.updateScoreLimit(
        accounts[1].address,
        debt,
        0, // totalDebt
        FIXTURES.pledge.ICR // 13500, coefficient: x1
      );

      const workingBalance = await scoreRegistry.workingBalances(
        accounts[1].address
      );
      const expectedLimit = debt.mul(4).div(10); // Only baseScore should be calculated
      expect(
        workingBalance,
        "Working balance should only include baseScore when totalDebt is zero"
      ).to.equal(expectedLimit);
    });
  });

  context("3. Collateral Ratio Effect", () => {
    beforeEach(async () => {
      await snapshot.restore();
      setupMocks();
    });

    it("should apply coefficient based on collateral ratio", async function () {
      const veBalance = FIXTURES.veYMT.balance.mul(2); // Ensure limit > debt
      setupMocks({ veBalance });
      const debt = FIXTURES.pledge.debt;
      const totalDebt = FIXTURES.yamato.totalDebt;

      const testCases = [
        { account: accounts[0], icr: 12999, expectedCoefficient: 0 }, // coefficient: x0
        { account: accounts[1], icr: 13000, expectedCoefficient: 1 }, // coefficient: x1
        { account: accounts[2], icr: 15000, expectedCoefficient: 1.5 }, // coefficient: x1.5
        { account: accounts[3], icr: 20000, expectedCoefficient: 2 }, // coefficient: x2
        { account: accounts[4], icr: 25000, expectedCoefficient: 2.5 }, // coefficient: x2.5
        { account: accounts[5], icr: 100000, expectedCoefficient: 2.5 }, // coefficient: x2.5 (max)
      ];

      for (const testCase of testCases) {
        await scoreRegistry.updateScoreLimit(
          testCase.account.address,
          debt,
          totalDebt,
          testCase.icr
        );
        const workingBalance = await scoreRegistry.workingBalances(
          testCase.account.address
        );
        const expectedBalance = debt
          .mul(testCase.expectedCoefficient * 10)
          .div(10);
        expect(
          workingBalance,
          `Working balance should be correct for ICR ${testCase.icr}`
        ).to.equal(expectedBalance);
      }
    });

    it("should handle ICR boundary values correctly", async function () {
      const debt = FIXTURES.pledge.debt;
      const totalDebt = FIXTURES.yamato.totalDebt;

      await scoreRegistry.updateScoreLimit(
        accounts[0].address,
        debt,
        totalDebt,
        12999
      );
      await scoreRegistry.updateScoreLimit(
        accounts[1].address,
        debt,
        totalDebt,
        13000
      );

      expect(
        await scoreRegistry.workingBalances(accounts[0].address),
        "Working balance should be 0 for ICR 12999"
      ).to.equal(0);
      expect(
        await scoreRegistry.workingBalances(accounts[1].address),
        "Working balance should be equal to debt for ICR 13000"
      ).to.equal(debt);
    });
  });

  context("4. State Updates", () => {
    beforeEach(async () => {
      await snapshot.restore();
      setupMocks();
    });

    it("should update workingSupply correctly", async function () {
      const prevWorkingSupply = await scoreRegistry.workingSupply();
      expect(prevWorkingSupply).to.be.equal(0);

      const prevBalance = await scoreRegistry.workingBalances(
        accounts[1].address
      );

      const tx = await scoreRegistry.updateScoreLimit(
        accounts[1].address,
        100,
        1000,
        150
      );
      const receipt = tx.wait();
      const event = (await receipt).events.find(
        (event) => event.event === "UpdateScoreLimit"
      );
      const _limit = event.args[4];
      const newWorkingSupply = await scoreRegistry.workingSupply();
      expect(
        newWorkingSupply,
        "Working supply should be updated correctly"
      ).to.equal(prevWorkingSupply.add(_limit).sub(prevBalance));
    });
  });

  context("5. Edge Cases", () => {
    beforeEach(async () => {
      await snapshot.restore();
      setupMocks();
    });

    it("should handle zero debt correctly", async function () {
      const testCases = [
        { totalDebt: 1000, icr: 150 },
        { totalDebt: 1000000, icr: 15000 },
        { totalDebt: 8000000, icr: 30000 },
      ];

      for (const testCase of testCases) {
        await scoreRegistry.updateScoreLimit(
          accounts[0].address,
          0,
          testCase.totalDebt,
          testCase.icr
        );
        expect(
          await scoreRegistry.workingBalances(accounts[0].address),
          `Working balance should be 0 for zero debt (totalDebt: ${testCase.totalDebt}, ICR: ${testCase.icr})`
        ).to.equal(0);
      }
    });

    it("should handle extremely large values with overflow", async function () {
      const largeValue = ethers.constants.MaxUint256;
      await expect(
        scoreRegistry.updateScoreLimit(
          accounts[1].address,
          largeValue,
          largeValue,
          FIXTURES.pledge.ICR
        ),
        "Should revert on extremely large values due to overflow"
      ).to.be.reverted;
    });
  });
});
