import { expect } from "chai";
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
  });

  afterEach(async () => {
    await evm.restore(snapshotId);
  });

  describe("test_total_weight", function () {
    it("test_total_weight", async () => {
      await setup.gaugeController.addGauge(
        setup.gaugesAddress[0],
        1,
        setup.GAUGE_WEIGHTS[0]
      );
      expect(await setup.gaugeController.getTotalWeight()).to.equal(
        setup.GAUGE_WEIGHTS[0].mul(setup.TYPE_WEIGHTS[0])
      );
    });

    it("test_changeTypeWeight", async () => {
      await setup.gaugeController.addGauge(
        setup.gaugesAddress[0],
        1,
        setup.ten_to_the_18
      );

      await setup.gaugeController.changeTypeWeight(1, BigNumber.from("31337"));

      expect(await setup.gaugeController.getTotalWeight()).to.equal(
        setup.ten_to_the_18.mul(BigNumber.from("31337"))
      );
    });

    it("test_changeGaugeWeight", async () => {
      await setup.gaugeController.addGauge(
        setup.gaugesAddress[0],
        1,
        setup.ten_to_the_18
      );

      await setup.gaugeController.changeGaugeWeight(
        setup.gaugesAddress[0],
        BigNumber.from("31337")
      );

      expect(await setup.gaugeController.getTotalWeight()).to.equal(
        setup.TYPE_WEIGHTS[0].mul(BigNumber.from("31337"))
      );
    });

    it("test_multiple", async () => {
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

      let expected = setup.GAUGE_WEIGHTS[0]
        .mul(setup.TYPE_WEIGHTS[0])
        .add(setup.GAUGE_WEIGHTS[1].mul(setup.TYPE_WEIGHTS[0]))
        .add(setup.GAUGE_WEIGHTS[2].mul(setup.TYPE_WEIGHTS[1]));

      expect(await setup.gaugeController.getTotalWeight()).to.equal(expected);
    });
  });
});
