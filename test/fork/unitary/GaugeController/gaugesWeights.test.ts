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
  });

  afterEach(async () => {
    await evm.restore(snapshotId);
  });

  describe("test gauges weights", function () {
    it("test addGauges", async () => {
      await setup.gaugeController.addGauge(setup.gaugesAddress[0], 0, 0);
      await setup.gaugeController.addGauge(setup.gaugesAddress[1], 0, 0);

      expect(await setup.gaugeController.gauges(0)).to.equal(
        setup.gaugesAddress[0]
      );
      expect(await setup.gaugeController.gauges(1)).to.equal(
        setup.gaugesAddress[1]
      );
    });

    it("test nGauges", async () => {
      expect(await setup.gaugeController.nGauges()).to.equal("0");

      await setup.gaugeController.addGauge(setup.gaugesAddress[0], 0, 0);
      await setup.gaugeController.addGauge(setup.gaugesAddress[1], 0, 0);

      expect(await setup.gaugeController.nGauges()).to.equal("2");
    });

    it("test nGauges same gauge", async () => {
      expect(await setup.gaugeController.nGauges()).to.equal("0");

      await setup.gaugeController.addGauge(setup.gaugesAddress[0], 0, 0);
      await expect(
        setup.gaugeController.addGauge(setup.gaugesAddress[0], 0, 0)
      ).to.revertedWith("cannot add the same gauge twice");

      expect(await setup.gaugeController.nGauges()).to.equal("1");
    });

    it("test nGaugeTypes", async () => {
      expect(await setup.gaugeController.nGaugeTypes()).to.equal("1"); // unset & LiquidityGauge

      await setup.gaugeController.addType("Liquidity", 0);

      expect(await setup.gaugeController.nGaugeTypes()).to.equal(
        BigNumber.from("2")
      ); //unset, LiquidityGauge, Liquidity
    });

    it("test gaugeTypes", async () => {
      await setup.gaugeController.addType("Liquidity", 0);

      await setup.gaugeController.addGauge(setup.gaugesAddress[0], 1, 0);
      await setup.gaugeController.addGauge(setup.gaugesAddress[1], 0, 0);

      expect(
        await setup.gaugeController.gaugeTypes(setup.gaugesAddress[0])
      ).to.equal("1");
      expect(
        await setup.gaugeController.gaugeTypes(setup.gaugesAddress[1])
      ).to.equal("0");
    });

    it("test gauge weight", async () => {
      await setup.gaugeController.addGauge(
        setup.gaugesAddress[0],
        0,
        setup.ten_to_the_19
      );

      expect(
        await setup.gaugeController.getGaugeWeight(setup.gaugesAddress[0])
      ).to.equal(setup.ten_to_the_19);
    });

    it("test gauge weight as zero", async () => {
      await setup.gaugeController.addGauge(setup.gaugesAddress[0], 0, 0);

      expect(
        await setup.gaugeController.getGaugeWeight(setup.gaugesAddress[0])
      ).to.equal("0");
    });

    it("test getGaugeWeight", async () => {
      await setup.gaugeController.addGauge(setup.gaugesAddress[0], 0, 0);

      expect(
        await setup.gaugeController.getGaugeWeight(setup.gaugesAddress[0])
      ).to.equal("0");

      await setup.gaugeController.changeGaugeWeight(
        setup.gaugesAddress[0],
        setup.ten_to_the_21
      );

      expect(
        await setup.gaugeController.getGaugeWeight(setup.gaugesAddress[0])
      ).to.equal(setup.ten_to_the_21);
    });

    it("test type weight", async () => {
      await setup.gaugeController.addType("Liquidity", setup.TYPE_WEIGHTS[0]);
      expect(await setup.gaugeController.getTypeWeight(1)).to.equal(
        setup.TYPE_WEIGHTS[0]
      );
      expect(await setup.gaugeController.getTypeWeight(2)).to.equal("0");
    });

    it("test changeTypeWeight", async () => {
      await setup.gaugeController.addType("Liquidity", setup.TYPE_WEIGHTS[0]);
      await setup.gaugeController.addType("Liquidity", setup.TYPE_WEIGHTS[1]);
      await setup.gaugeController.changeTypeWeight(2, setup.TYPE_WEIGHTS[1]);
      await setup.gaugeController.changeTypeWeight(1, BigNumber.from("31337"));

      expect(await setup.gaugeController.getTypeWeight(0)).to.equal(0);
      expect(await setup.gaugeController.getTypeWeight(1)).to.equal("31337");
      expect(await setup.gaugeController.getTypeWeight(2)).to.equal(
        setup.TYPE_WEIGHTS[1]
      );
    });

    it("test relative weight write", async () => {
      await setup.gaugeController.addType("Liquidity", setup.TYPE_WEIGHTS[0]);
      await setup.gaugeController.addType("Liquidity", setup.TYPE_WEIGHTS[1]);

      await setup.gaugeController.addGauge(
        setup.gaugesAddress[0],
        1,
        setup.GAUGE_WEIGHTS[0]
      );
      await setup.gaugeController.addGauge(
        setup.gaugesAddress[1],
        1,
        setup.GAUGE_WEIGHTS[1]
      );
      await setup.gaugeController.addGauge(
        setup.gaugesAddress[2],
        2,
        setup.GAUGE_WEIGHTS[2]
      );

      let gauge_type = [0, 0, 1];
      let total_weight = setup.TYPE_WEIGHTS[0]
        .mul(setup.GAUGE_WEIGHTS[0])
        .add(setup.TYPE_WEIGHTS[0].mul(setup.GAUGE_WEIGHTS[1]))
        .add(setup.TYPE_WEIGHTS[1].mul(setup.GAUGE_WEIGHTS[2]));

      await ethers.provider.send("evm_increaseTime", [
        setup.WEEK.mul(2).toNumber(),
      ]);
      await ethers.provider.send("evm_mine", []);

      let t = BigNumber.from(
        (await ethers.provider.getBlock("latest")).timestamp
      );

      for (let i = 0; i < 3; i++) {
        await setup.gaugeController.gaugeRelativeWeightWrite(
          setup.gaugesAddress[i],
          t
        );
        let relativeWeight = await setup.gaugeController.gaugeRelativeWeight(
          setup.gaugesAddress[i],
          t
        );
        expect(relativeWeight).to.equal(
          setup.ten_to_the_18
            .mul(setup.GAUGE_WEIGHTS[i])
            .mul(setup.TYPE_WEIGHTS[gauge_type[i]])
            .div(total_weight)
        );
      }

      await ethers.provider.send("evm_increaseTime", [
        setup.YEAR.div("2").toNumber(),
      ]);
      await ethers.provider.send("evm_mine", []);

      for (let i = 0; i < 3; i++) {
        await setup.gaugeController.gaugeRelativeWeightWrite(
          setup.gaugesAddress[i],
          t
        );
        let relativeWeight = await setup.gaugeController.gaugeRelativeWeight(
          setup.gaugesAddress[i],
          t
        );
        expect(relativeWeight).to.equal(
          setup.ten_to_the_18
            .mul(setup.GAUGE_WEIGHTS[i])
            .mul(setup.TYPE_WEIGHTS[gauge_type[i]])
            .div(total_weight)
        );
      }

      await ethers.provider.send("evm_increaseTime", [
        setup.YEAR.div("10").toNumber(),
      ]);
      await ethers.provider.send("evm_mine", []);

      for (let i = 0; i < 3; i++) {
        await setup.gaugeController.gaugeRelativeWeightWrite(
          setup.gaugesAddress[i],
          t
        );
        let relativeWeight = await setup.gaugeController.gaugeRelativeWeight(
          setup.gaugesAddress[i],
          t
        );
        expect(relativeWeight).to.equal(
          setup.ten_to_the_18
            .mul(setup.GAUGE_WEIGHTS[i])
            .mul(setup.TYPE_WEIGHTS[gauge_type[i]])
            .div(total_weight)
        );
      }
    });
  });
});
