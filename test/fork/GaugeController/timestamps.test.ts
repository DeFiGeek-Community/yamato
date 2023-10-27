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
  });

  beforeEach(async () => {
    evm = new EVMUtils();
    snapshotId = await evm.snapshot();
  });

  afterEach(async () => {
    await evm.restore(snapshotId);
  });

  describe("test_timestamp", function () {
    it("test_timestamp", async () => {
      let now = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);
      expect(await setup.gauge_controller.timeTotal()).to.equal(now.add(setup.WEEK).div(setup.WEEK).or(BigNumber.from("0")).mul(setup.WEEK));

      for (let i = 0; i < 5; i++) {
        //await time.increase(YEAR.mul(BigNumber.from('11')).div(BigNumber.from('10')));
        let t = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);
        await ethers.provider.send("evm_increaseTime", [setup.YEAR.mul("11").div("10").toNumber()]);

        await setup.gauge_controller.checkpoint();
        now = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);
        expect(await setup.gauge_controller.timeTotal()).to.equal(now.add(setup.WEEK).div(setup.WEEK).or(BigNumber.from("0")).mul(setup.WEEK)); //technically, blocktimestamp for this tx is "now+1", but it works fine for here because of .div(setup.WEEK) rounds down the number.
      }
    });
  });
});
