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
  let threeGauges: string[];
  let snapshot: SnapshotRestorer;

  const TYPE_WEIGHTS = Constants.TYPE_WEIGHTS;
  const GAUGE_WEIGHTS = Constants.GAUGE_WEIGHTS;
  const ten_to_the_18 = Constants.ten_to_the_18;

  beforeEach(async function () {
    snapshot = await takeSnapshot();
    accounts = await ethers.getSigners();
    ({ gaugeController, threeGauges } = await deployContracts());
    await gaugeController.addType("none", TYPE_WEIGHTS[0]);
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  describe("GaugeController TotalWeight", function () {
    it("test_total_weight", async function () {
      await gaugeController.addGauge(threeGauges[0], 0, GAUGE_WEIGHTS[0]);

      expect(await gaugeController.getTotalWeight()).to.equal(
        GAUGE_WEIGHTS[0].mul(TYPE_WEIGHTS[0])
      );
    });

    it("test_change_type_weight", async function () {
      await gaugeController.addGauge(threeGauges[0], 0, ten_to_the_18);
      await gaugeController.changeTypeWeight(0, 31337);

      expect(await gaugeController.getTotalWeight()).to.equal(
        ten_to_the_18.mul(31337)
      );
    });

    it("test_change_gauge_weight", async function () {
      await gaugeController.addGauge(threeGauges[0], 0, ten_to_the_18);
      await gaugeController.changeGaugeWeight(threeGauges[0], 31337);

      expect(await gaugeController.getTotalWeight()).to.equal(
        TYPE_WEIGHTS[0].mul(31337)
      );
    });

    it("test_multiple", async function () {
      await gaugeController.addType("Insurance", TYPE_WEIGHTS[1]);
      await gaugeController.addGauge(threeGauges[0], 0, GAUGE_WEIGHTS[0]);
      await gaugeController.addGauge(threeGauges[1], 0, GAUGE_WEIGHTS[1]);
      await gaugeController.addGauge(threeGauges[2], 1, GAUGE_WEIGHTS[2]);

      const expectedTotalWeight = GAUGE_WEIGHTS[0]
        .mul(TYPE_WEIGHTS[0])
        .add(GAUGE_WEIGHTS[1].mul(TYPE_WEIGHTS[0]))
        .add(GAUGE_WEIGHTS[2].mul(TYPE_WEIGHTS[1]));

      expect(await gaugeController.getTotalWeight()).to.equal(
        expectedTotalWeight
      );
    });
  });
});
