import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { EVMUtils, GaugeControllerTestSetup } from "../helper";

describe("GaugeController", function () {
  let setup: GaugeControllerTestSetup;
  let evm: EVMUtils;
  let snapshotId: string;

  before(async () => {
    setup = new GaugeControllerTestSetup();
    await setup.setup();
  });

  beforeEach(async () => {
    evm = new EVMUtils();
    snapshotId = await evm.snapshot();
  });

  afterEach(async () => {
    await evm.restore(snapshotId);
  });

  describe("test gauges weights", function () {
    it("test addGauges", async () => {
      await setup.gauge_controller.addGauge(setup.three_gauges[0], 0, 0);
      await setup.gauge_controller.addGauge(setup.three_gauges[1], 0, 0);

      expect(await setup.gauge_controller.gauges(0)).to.equal(setup.three_gauges[0]);
      expect(await setup.gauge_controller.gauges(1)).to.equal(setup.three_gauges[1]);
    });

    it("test nGauges", async () => {
      expect(await setup.gauge_controller.nGauges()).to.equal("0");

      await setup.gauge_controller.addGauge(setup.three_gauges[0], 0, 0);
      await setup.gauge_controller.addGauge(setup.three_gauges[1], 0, 0);

      expect(await setup.gauge_controller.nGauges()).to.equal("2");
    });

    it("test nGauges same gauge", async () => {
      expect(await setup.gauge_controller.nGauges()).to.equal("0");

      await setup.gauge_controller.addGauge(setup.three_gauges[0], 0, 0);
      await expect(setup.gauge_controller.addGauge(setup.three_gauges[0], 0, 0)).to.revertedWith(
        "cannot add the same gauge twice"
      );

      expect(await setup.gauge_controller.nGauges()).to.equal("1");
    });

    it("test nGaugeTypes", async () => {
      expect(await setup.gauge_controller.nGaugeTypes()).to.equal("1"); // unset & LiquidityGauge

      await setup.gauge_controller.addType("Insurance", 0);

      expect(await setup.gauge_controller.nGaugeTypes()).to.equal(BigNumber.from("2")); //unset, LiquidityGauge, Insurance
    });

    it("test gaugeTypes", async () => {
      await setup.gauge_controller.addType("Insurance", 0);

      await setup.gauge_controller.addGauge(setup.three_gauges[0], 1, 0);
      await setup.gauge_controller.addGauge(setup.three_gauges[1], 0, 0);

      expect(await setup.gauge_controller.gaugeTypes(setup.three_gauges[0])).to.equal("1");
      expect(await setup.gauge_controller.gaugeTypes(setup.three_gauges[1])).to.equal("0");
    });

    it("test gauge weight", async () => {
      await setup.gauge_controller.addGauge(setup.three_gauges[0], 0, setup.ten_to_the_19);

      expect(await setup.gauge_controller.getGaugeWeight(setup.three_gauges[0])).to.equal(setup.ten_to_the_19);
    });

    it("test gauge weight as zero", async () => {
      await setup.gauge_controller.addGauge(setup.three_gauges[0], 0, 0);

      expect(await setup.gauge_controller.getGaugeWeight(setup.three_gauges[0])).to.equal("0");
    });

    it("test getGaugeWeight", async () => {
      await setup.gauge_controller.addGauge(setup.three_gauges[0], 0, 0);

      expect(await setup.gauge_controller.getGaugeWeight(setup.three_gauges[0])).to.equal("0");

      await setup.gauge_controller.changeGaugeWeight(setup.three_gauges[0], setup.ten_to_the_21);

      expect(await setup.gauge_controller.getGaugeWeight(setup.three_gauges[0])).to.equal(setup.ten_to_the_21);
    });

    it("test type weight", async () => {
      await setup.gauge_controller.addType("Insurance", setup.TYPE_WEIGHTS[0]);
      expect(await setup.gauge_controller.getTypeWeight(1)).to.equal(setup.TYPE_WEIGHTS[0]);
      expect(await setup.gauge_controller.getTypeWeight(2)).to.equal("0");
    });

    it("test changeTypeWeight", async () => {
      await setup.gauge_controller.addType("Insurance", setup.TYPE_WEIGHTS[0]);
      await setup.gauge_controller.addType("Insurance", setup.TYPE_WEIGHTS[1]);
      await setup.gauge_controller.changeTypeWeight(2, setup.TYPE_WEIGHTS[1]);
      await setup.gauge_controller.changeTypeWeight(1, BigNumber.from("31337"));

      expect(await setup.gauge_controller.getTypeWeight(0)).to.equal(0);
      expect(await setup.gauge_controller.getTypeWeight(1)).to.equal("31337");
      expect(await setup.gauge_controller.getTypeWeight(2)).to.equal(setup.TYPE_WEIGHTS[1]);
    });

    it("test relative weight write", async () => {
      await setup.gauge_controller.addType("Insurance", setup.TYPE_WEIGHTS[0]);
      await setup.gauge_controller.addType("Insurance", setup.TYPE_WEIGHTS[1]);

      await setup.gauge_controller.addGauge(setup.three_gauges[0], 1, setup.GAUGE_WEIGHTS[0]);
      await setup.gauge_controller.addGauge(setup.three_gauges[1], 1, setup.GAUGE_WEIGHTS[1]);
      await setup.gauge_controller.addGauge(setup.three_gauges[2], 2, setup.GAUGE_WEIGHTS[2]);

      let gauge_type = [0, 0, 1];
      let total_weight = setup.TYPE_WEIGHTS[0]
        .mul(setup.GAUGE_WEIGHTS[0])
        .add(setup.TYPE_WEIGHTS[0].mul(setup.GAUGE_WEIGHTS[1]))
        .add(setup.TYPE_WEIGHTS[1].mul(setup.GAUGE_WEIGHTS[2]));

      await ethers.provider.send("evm_increaseTime", [setup.WEEK.mul(2).toNumber()]);
      await ethers.provider.send("evm_mine",[]);

      let t = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);

      for (let i = 0; i < 3; i++) {
        await setup.gauge_controller.gaugeRelativeWeightWrite(setup.three_gauges[i], t);
        let relative_weight = await setup.gauge_controller.gaugeRelativeWeight(setup.three_gauges[i], t);
        expect(relative_weight).to.equal(
          setup.ten_to_the_18.mul(setup.GAUGE_WEIGHTS[i]).mul(setup.TYPE_WEIGHTS[gauge_type[i]]).div(total_weight)
        );
      }

      await ethers.provider.send("evm_increaseTime", [setup.YEAR.div("2").toNumber()]);
      await ethers.provider.send("evm_mine",[]);

      for (let i = 0; i < 3; i++) {
        await setup.gauge_controller.gaugeRelativeWeightWrite(setup.three_gauges[i], t);
        let relative_weight = await setup.gauge_controller.gaugeRelativeWeight(setup.three_gauges[i], t);
        expect(relative_weight).to.equal(
          setup.ten_to_the_18.mul(setup.GAUGE_WEIGHTS[i]).mul(setup.TYPE_WEIGHTS[gauge_type[i]]).div(total_weight)
        );
      }

      await ethers.provider.send("evm_increaseTime", [setup.YEAR.div("10").toNumber()]);
      await ethers.provider.send("evm_mine",[]);

      for (let i = 0; i < 3; i++) {
        await setup.gauge_controller.gaugeRelativeWeightWrite(setup.three_gauges[i], t);
        let relative_weight = await setup.gauge_controller.gaugeRelativeWeight(setup.three_gauges[i], t);
        expect(relative_weight).to.equal(
          setup.ten_to_the_18.mul(setup.GAUGE_WEIGHTS[i]).mul(setup.TYPE_WEIGHTS[gauge_type[i]]).div(total_weight)
        );
      }
    });
  });
});
