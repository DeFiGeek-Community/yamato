import { ethers } from "hardhat";
import { expect } from "chai";
import {
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { deployContracts } from "../../helper";
import Constants from "../../Constants";

describe("GaugeController", function () {
  let accounts: SignerWithAddress[];
  let gaugeController: Contract;
  let threeGauges: String[];
  let snapshot: SnapshotRestorer;

  const WEEK = Constants.WEEK;
  const YEAR = Constants.YEAR;
  const TYPE_WEIGHTS = Constants.TYPE_WEIGHTS;
  const GAUGE_WEIGHTS = Constants.GAUGE_WEIGHTS;

  beforeEach(async function () {
    snapshot = await takeSnapshot();
    accounts = await ethers.getSigners();
    ({ gaugeController, threeGauges } = await deployContracts());
    await gaugeController.addType("none", TYPE_WEIGHTS[0]);
  });

  afterEach(async () => {
    await snapshot.restore();
  });
  describe("GaugeController GaugesWeights", function () {
    it("test_add_gauges", async function () {
      await gaugeController.addGauge(threeGauges[0], 0, GAUGE_WEIGHTS[0]);
      await gaugeController.addGauge(threeGauges[1], 0, GAUGE_WEIGHTS[1]);

      expect(await gaugeController.gauges(0)).to.equal(threeGauges[0]);
      expect(await gaugeController.gauges(1)).to.equal(threeGauges[1]);
    });

    it("test_n_gauges", async function () {
      expect(await gaugeController.nGauges()).to.equal(0);

      await gaugeController.addGauge(threeGauges[0], 0, GAUGE_WEIGHTS[0]);
      await gaugeController.addGauge(threeGauges[1], 0, GAUGE_WEIGHTS[1]);

      expect(await gaugeController.nGauges()).to.equal(2);
    });

    it("test_n_gauges_same_gauge", async function () {
      await gaugeController.addGauge(threeGauges[0], 0, GAUGE_WEIGHTS[0]);
      await expect(
        gaugeController.addGauge(threeGauges[0], 0, GAUGE_WEIGHTS[0])
      ).to.be.revertedWith("cannot add the same gauge twice");
    });

    it("test_n_gauge_types", async function () {
      expect(await gaugeController.nGaugeTypes()).to.equal(1);

      await gaugeController.addType("Insurance", TYPE_WEIGHTS[1]);

      expect(await gaugeController.nGaugeTypes()).to.equal(2);
    });

    it("test_gauge_types", async function () {
      await gaugeController.addType("Insurance", TYPE_WEIGHTS[1]);
      await gaugeController.addGauge(threeGauges[0], 1, GAUGE_WEIGHTS[0]);
      await gaugeController.addGauge(threeGauges[1], 0, GAUGE_WEIGHTS[1]);

      expect(await gaugeController.gaugeTypes(threeGauges[0])).to.equal(1);
      expect(await gaugeController.gaugeTypes(threeGauges[1])).to.equal(0);
    });

    it("test_gauge_weight", async function () {
      await gaugeController.addGauge(threeGauges[0], 0, GAUGE_WEIGHTS[0]);

      expect(await gaugeController.getGaugeWeight(threeGauges[0])).to.equal(
        GAUGE_WEIGHTS[0]
      );
    });

    it("test_gauge_weight_as_zero", async function () {
      await gaugeController.addGauge(threeGauges[0], 0, 0);

      expect(await gaugeController.getGaugeWeight(threeGauges[0])).to.equal(0);
    });

    it("test_set_gauge_weight", async function () {
      await gaugeController.addGauge(threeGauges[0], 0, 0);
      await gaugeController.changeGaugeWeight(threeGauges[0], GAUGE_WEIGHTS[0]);
      await ethers.provider.send("evm_increaseTime", [WEEK.toNumber()]);

      expect(await gaugeController.getGaugeWeight(threeGauges[0])).to.equal(
        GAUGE_WEIGHTS[0]
      );
    });

    it("test_type_weight", async function () {
      await gaugeController.addType("Insurance", 0);

      expect(await gaugeController.getTypeWeight(0)).to.equal(TYPE_WEIGHTS[0]);
      expect(await gaugeController.getTypeWeight(1)).to.equal(0);
    });

    it("test_change_type_weight", async function () {
      await gaugeController.addType("Insurance", TYPE_WEIGHTS[0]);
      await gaugeController.changeTypeWeight(0, TYPE_WEIGHTS[1]);

      expect(await gaugeController.getTypeWeight(0)).to.equal(TYPE_WEIGHTS[1]);
    });

    it("test_relative_weight_write", async function () {
      await gaugeController.addType("Insurance", TYPE_WEIGHTS[1]);
      await gaugeController.addGauge(threeGauges[0], 0, GAUGE_WEIGHTS[0]);
      await gaugeController.addGauge(threeGauges[1], 0, GAUGE_WEIGHTS[1]);
      await gaugeController.addGauge(threeGauges[2], 1, GAUGE_WEIGHTS[2]);
      await ethers.provider.send("evm_increaseTime", [YEAR.toNumber()]);

      const expectedWeight = TYPE_WEIGHTS[0]
        .mul(GAUGE_WEIGHTS[0])
        .add(TYPE_WEIGHTS[0].mul(GAUGE_WEIGHTS[1]))
        .add(TYPE_WEIGHTS[1].mul(GAUGE_WEIGHTS[2]));

      for (let i = 0; i < threeGauges.length; i++) {
        const relativeWeight = await gaugeController.gaugeRelativeWeight(
          threeGauges[i],
          0
        );
        expect(relativeWeight).to.equal(
          GAUGE_WEIGHTS[i]
            .mul(TYPE_WEIGHTS[Math.floor(i / 2)])
            .div(expectedWeight)
        );
      }
    });
  });
});
