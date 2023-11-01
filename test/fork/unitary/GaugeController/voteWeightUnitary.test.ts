import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { EVMUtils, TestSetup } from "../../helper";

describe("GaugeController", function () {
  let setup: TestSetup;
  let evm: EVMUtils;
  let snapshotId: string;

  beforeEach(async () => {
    evm = new EVMUtils();
    snapshotId = await evm.snapshot();
    setup = new TestSetup();
    await setup.setup();
    await setup.addType();
    await setup.addGaugeZero();
    await setup.createLock();
  });

  afterEach(async () => {
    await evm.restore(snapshotId);
  });

  describe("test_vote_weight_unitary", function () {
    it("test_no_immediate_effect_on_weight", async () => {
      await setup.gaugeController.voteForGaugeWeights(
        setup.gaugesAddress[0],
        10000
      );
      expect(
        await setup.gaugeController.gaugeRelativeWeight(
          setup.gaugesAddress[0],
          BigNumber.from((await ethers.provider.getBlock("latest")).timestamp)
        )
      ).to.equal(BigNumber.from("0"));
    });

    it("test_remove_vote_no_immediate_effect", async () => {
      // ゲージに対して投票を行った後、時間を進めてそのゲージのチェックポイントを取ります。
      // その後、投票を取り消して、投票の取り消しは即座には影響しないことを確認します。
      await setup.gaugeController.voteForGaugeWeights(
        setup.gaugesAddress[0],
        10000
      );

      await ethers.provider.send("evm_increaseTime", [
        setup.DAY.mul("10").toNumber(),
      ]);

      await setup.gaugeController.checkpointGauge(setup.gaugesAddress[0]);
      await setup.gaugeController.voteForGaugeWeights(
        setup.gaugesAddress[0],
        0
      );

      expect(
        await setup.gaugeController.gaugeRelativeWeight(
          setup.gaugesAddress[0],
          BigNumber.from((await ethers.provider.getBlock("latest")).timestamp)
        )
      ).to.equal(setup.ten_to_the_18);
    });

    it("test_effect_on_following_period", async () => {
      // ゲージに対して投票を行い、一週間時間を進めた後にそのゲージの重みが変わっていることを確認します。
      await setup.gaugeController.voteForGaugeWeights(
        setup.gaugesAddress[0],
        10000
      );

      await ethers.provider.send("evm_increaseTime", [setup.WEEK.toNumber()]);
      await setup.gaugeController.checkpointGauge(setup.gaugesAddress[0]);
      expect(
        await setup.gaugeController.gaugeRelativeWeight(
          setup.gaugesAddress[0],
          BigNumber.from((await ethers.provider.getBlock("latest")).timestamp)
        )
      ).to.equal(setup.ten_to_the_18);
    });

    it("test_remove_vote_means_no_weight", async () => {
      // ゲージに対して投票を行い、時間を進めてそのゲージのチェックポイントを取ります。
      // 投票を取り消し、さらに一週間時間を進めた後、そのゲージの重みが0になっていることを確認します。
      await setup.gaugeController.voteForGaugeWeights(
        setup.gaugesAddress[0],
        10000
      );
      await ethers.provider.send("evm_increaseTime", [
        setup.DAY.mul("10").toNumber(),
      ]);
      await setup.gaugeController.checkpointGauge(setup.gaugesAddress[0]);

      expect(
        await setup.gaugeController.gaugeRelativeWeight(
          setup.gaugesAddress[0],
          BigNumber.from((await ethers.provider.getBlock("latest")).timestamp)
        )
      ).to.equal(setup.ten_to_the_18);

      await setup.gaugeController.voteForGaugeWeights(
        setup.gaugesAddress[0],
        0
      );
      await ethers.provider.send("evm_increaseTime", [setup.WEEK.toNumber()]);
      await setup.gaugeController.checkpointGauge(setup.gaugesAddress[0]);

      expect(
        await setup.gaugeController.gaugeRelativeWeight(
          setup.gaugesAddress[0],
          BigNumber.from((await ethers.provider.getBlock("latest")).timestamp)
        )
      ).to.equal(setup.zero);
    });
  });
});