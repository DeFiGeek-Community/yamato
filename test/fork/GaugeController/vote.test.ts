import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { EVMUtils, TestSetup } from "../helper";

describe("GaugeController", function () {
  let setup: TestSetup;
  let evm: EVMUtils;
  let snapshotId: string;

  before(async () => {
    setup = new TestSetup();
    await setup.setup();
    await setup.addType();
    await setup.addGaugeZero();
    await setup.createLock();
  });

  beforeEach(async () => {
    evm = new EVMUtils();
    snapshotId = await evm.snapshot();
  });

  afterEach(async () => {
    await evm.restore(snapshotId);
  });

  describe("test_vote", function () {
    it("test_vote", async () => {
      // Test if voting for a gauge with a weight of 10000 sets the user's vote power to 10000.
      await setup.gaugeController.voteForGaugeWeights(setup.gaugesAddress[0], 10000);
      expect(await setup.gaugeController.voteUserPower(setup.accountsAddress[0])).to.equal(BigNumber.from("10000")); //Total vote power used by user
    });

    it("test_vote_partial", async () => {
      // Test if voting with a weight of 1234 sets the user's vote power to 1234.
      await setup.gaugeController.voteForGaugeWeights(setup.gaugesAddress[1], 1234);
      expect(await setup.gaugeController.voteUserPower(setup.accountsAddress[0])).to.equal(BigNumber.from("1234"));
    });

    it("test_vote_change", async () => {
      // Test if it's possible to change the weight of the same gauge after 10 days.
      await setup.gaugeController.voteForGaugeWeights(setup.gaugesAddress[1], 1234);
      await expect(setup.gaugeController.voteForGaugeWeights(setup.gaugesAddress[1], 1234)).to.revertedWith(
        "Cannot vote so often"
      );

      await ethers.provider.send("evm_increaseTime", [setup.DAY.mul("10").toNumber()]);

      await setup.gaugeController.voteForGaugeWeights(setup.gaugesAddress[1], 42);

      expect(await setup.gaugeController.voteUserPower(setup.accountsAddress[0])).to.equal(BigNumber.from("42"));
    });

    it("test_vote_remove", async () => {
      // Test that removing a vote sets the user's voting power to 0.
      await setup.gaugeController.voteForGaugeWeights(setup.gaugesAddress[1], 10000);
      await expect(setup.gaugeController.voteForGaugeWeights(setup.gaugesAddress[1], 1234)).to.revertedWith(
        "Cannot vote so often"
      );

      await ethers.provider.send("evm_increaseTime", [setup.DAY.mul("10").toNumber()]);
      await setup.gaugeController.voteForGaugeWeights(setup.gaugesAddress[1], 0);

      expect(await setup.gaugeController.voteUserPower(setup.accountsAddress[0])).to.equal(setup.zero);
    });

    it("test_vote_multiple", async () => {
      // Test if voting for multiple gauges sums up the user's voting power.
      await setup.gaugeController.voteForGaugeWeights(setup.gaugesAddress[0], 4000);
      await setup.gaugeController.voteForGaugeWeights(setup.gaugesAddress[1], 6000);

      expect(await setup.gaugeController.voteUserPower(setup.accountsAddress[0])).to.equal(BigNumber.from("10000"));
    });

    it("test_vote_no_balance", async () => {
      // Test that users without locked tokens can't vote.
      await expect(setup.gaugeController.connect(setup.accounts[1]).voteForGaugeWeights(setup.gaugesAddress[0], 10000)).to.revertedWith(
        "Your token lock expires too soon"
      );
    });

    it("test_vote_expired", async () => {
      // Test that users with expired token locks can't vote.
      await ethers.provider.send("evm_increaseTime", [setup.YEAR.mul("2").toNumber()]);

      await expect(setup.gaugeController.voteForGaugeWeights(setup.gaugesAddress[0], 10000)).to.revertedWith(
        "Your token lock expires too soon"
      );
    });

    it("test_invalid_gauge_id", async () => {
      // Test that voting with an invalid gauge ID throws an error.
      await expect(setup.gaugeController.voteForGaugeWeights(setup.gaugesAddress[2], 10000)).to.revertedWith("Gauge not added");
    });

    it("test_over_user_weight", async () => {
      // Test that voting with power exceeding the user's capacity throws an error.
      await expect(setup.gaugeController.voteForGaugeWeights(setup.gaugesAddress[0], 10001)).to.revertedWith(
        "You used all your voting power"
      );
    });

    it("test_over_weight_multiple", async () => {
      // Test that voting for multiple gauges with total power exceeding user's capacity throws an error.
      await setup.gaugeController.voteForGaugeWeights(setup.gaugesAddress[0], 8000);
      await expect(setup.gaugeController.voteForGaugeWeights(setup.gaugesAddress[1], 4000)).to.revertedWith(
        "Used too much power"
      );
    });

    it("test_over_weight_adjust_existing", async () => {
      // Test that adjusting an existing vote to exceed the user's total voting power throws an error.
      await setup.gaugeController.voteForGaugeWeights(setup.gaugesAddress[0], 6000);
      await setup.gaugeController.voteForGaugeWeights(setup.gaugesAddress[1], 3000);

      await ethers.provider.send("evm_increaseTime", [setup.DAY.mul("10").toNumber()]);

      await expect(setup.gaugeController.voteForGaugeWeights(setup.gaugesAddress[0], 8000)).to.revertedWith(
        "Used too much power"
      );
    });

    it("test_exceeding_voting_power", async () => {
      await setup.gaugeController.voteForGaugeWeights(setup.gaugesAddress[0], 6000);
      await expect(setup.gaugeController.voteForGaugeWeights(setup.gaugesAddress[1], 5000)).to.revertedWith(
        "Used too much power"
      );
    });

    it("test_emit_vote_event", async () => {
      let now = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp + 1);
      await expect(setup.gaugeController.voteForGaugeWeights(setup.gaugesAddress[0], 5000))
      .to.emit(setup.gaugeController, "VoteForGauge")
      .withArgs(now, setup.accountsAddress[0], setup.gaugesAddress[0], 5000);
    });

  });
});
