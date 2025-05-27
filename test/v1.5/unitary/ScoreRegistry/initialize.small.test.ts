import { ethers } from "hardhat";
import chai, { expect } from "chai";
import { FakeContract, smock } from "@defi-wonderland/smock";
import { ScoreRegistry } from "../../../../typechain";
import {
  SnapshotRestorer,
  takeSnapshot,
  time,
} from "@nomicfoundation/hardhat-network-helpers";
import {
  FIXTURES,
  mockV1_5Fixture,
  deployScoreRegistry,
} from "../../../param/fixture";
import { expectEventEmitted } from "../../../param/helper";
import Constants from "../../Constants";

chai.use(smock.matchers);

const week = Constants.week;

/**
 * ScoreRegistry.initialize() Tests
 *
 * These tests verify the correct initialization of the ScoreRegistry contract.
 * The initialize function sets up crucial contract dependencies and initial state.
 *
 * Key aspects tested:
 * 1. Correct setting of contract dependencies (YMT, veYMT, YmtMinter, ScoreWeightController)
 * 2. Proper initialization of state variables (periodTimestamp, inflationRate, futureEpochTime)
 * 3. Handling of edge cases and invalid inputs
 *
 * Test structure:
 * 1. Successful Initialization
 * 2. Initialization Restrictions
 * 3. Edge Cases
 */

describe("ScoreRegistry.initialize()", () => {
  let scoreRegistry: ScoreRegistry;
  let mocks: Record<string, FakeContract>;
  let snapshot: SnapshotRestorer;

  function setupMocks(customSetup = {}) {
    const defaultSetup = {
      ymtAddress: mocks.YMT.address,
      veYmtAddress: mocks.veYMT.address,
      swcAddress: mocks.ScoreWeightController.address,
      rate: FIXTURES.ymt.rate,
      futureEpochTime: FIXTURES.ymt.futureEpochTimeWrite,
    };
    const setup = { ...defaultSetup, ...customSetup };

    mocks.YmtMinter.YMT.returns(setup.ymtAddress);
    mocks.YmtMinter.scoreWeightController.returns(setup.swcAddress);
    mocks.ScoreWeightController.veYMT.returns(setup.veYmtAddress);
    mocks.YMT.rate.returns(setup.rate);
    mocks.YMT.futureEpochTimeWrite.returns(setup.futureEpochTime);
  }

  before(async () => {
    await time.increase(week * 10);
    mocks = await mockV1_5Fixture();
    scoreRegistry = await deployScoreRegistry();

    setupMocks();
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  context("1. Successful Initialization", () => {
    /**
     * This test verifies that the initialize function correctly sets all required values
     * and emits the Initialized event. It checks each dependency and state variable
     * to ensure they are set to the expected values.
     */

    it("should correctly initialize the contract and set all required values", async function () {
      const tx = await scoreRegistry.initialize(
        mocks.YmtMinter.address,
        mocks.Yamato.address
      );

      expectEventEmitted(tx, "Initialized", 1);

      expect(await scoreRegistry.YMT()).to.equal(mocks.YMT.address);
      expect(await scoreRegistry.veYMT()).to.equal(mocks.veYMT.address);
      expect(await scoreRegistry.ymtMinter()).to.equal(mocks.YmtMinter.address);
      expect(await scoreRegistry.scoreWeightController()).to.equal(
        mocks.ScoreWeightController.address
      );

      const currentTimestamp = await time.latest();
      expect(await scoreRegistry.periodTimestamp(0)).to.equal(currentTimestamp);
      expect(await scoreRegistry.inflationRate()).to.equal(FIXTURES.ymt.rate);
      expect(await scoreRegistry.futureEpochTime()).to.equal(
        FIXTURES.ymt.futureEpochTimeWrite
      );
    });
  });

  context("2. Initialization Restrictions", () => {
    /**
     * These tests check the restrictions on initialization, including
     * prevention of re-initialization and validation of input parameters.
     */

    it("should revert if already initialized", async function () {
      await scoreRegistry.initialize(
        mocks.YmtMinter.address,
        mocks.Yamato.address
      );
      await expect(
        scoreRegistry.initialize(mocks.YmtMinter.address, mocks.Yamato.address)
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });
  });

  context("3. Edge Cases", () => {
    /**
     * These tests check how the initialize function handles extreme values
     * for inflation rate and future epoch time.
     */

    it("should handle extremely large values for rate and futureEpochTime", async function () {
      const largeValue = ethers.constants.MaxUint256;
      setupMocks({ rate: largeValue, futureEpochTime: largeValue });
      await expect(
        scoreRegistry.initialize(mocks.YmtMinter.address, mocks.Yamato.address)
      ).to.be.not.reverted;
      expect(await scoreRegistry.inflationRate()).to.equal(largeValue);
      expect(await scoreRegistry.futureEpochTime()).to.equal(largeValue);
    });

    it("should handle zero values for rate and futureEpochTime", async function () {
      setupMocks({ rate: 0, futureEpochTime: 0 });
      await expect(
        scoreRegistry.initialize(mocks.YmtMinter.address, mocks.Yamato.address)
      ).to.be.not.reverted;
      expect(await scoreRegistry.inflationRate()).to.equal(0);
      expect(await scoreRegistry.futureEpochTime()).to.equal(0);
    });
  });
});
