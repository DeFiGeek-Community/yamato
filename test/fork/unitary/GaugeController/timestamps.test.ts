import { ethers } from "hardhat";
import { expect } from "chai";
import {
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { deployContracts } from "../../helper";
import Constants from "../../Constants";

describe("GaugeController", function () {
  let accounts;
  let gaugeController;

  let snapshot: SnapshotRestorer;

  const TYPE_WEIGHTS = Constants.TYPE_WEIGHTS;
  const WEEK = Constants.week;
  const YEAR = Constants.year;

  beforeEach(async function () {
    snapshot = await takeSnapshot();
    accounts = await ethers.getSigners();
    ({ gaugeController } = await deployContracts());
    await gaugeController.addType("none", TYPE_WEIGHTS[0]);
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  describe("GaugeController Timestamps", function () {
    it("test_timestamps", async function () {
      const currentTime = (await ethers.provider.getBlock("latest")).timestamp;
      const expectedTime = Math.floor((currentTime + WEEK) / WEEK) * WEEK;
      expect(await gaugeController.timeTotal()).to.equal(expectedTime);

      for (let i = 0; i < 5; i++) {
        await ethers.provider.send("evm_increaseTime", [
          Math.floor(1.1 * YEAR),
        ]);

        await gaugeController.checkpoint();

        const newCurrentTime = (await ethers.provider.getBlock("latest"))
          .timestamp;
        const newExpectedTime =
          Math.floor((newCurrentTime + WEEK) / WEEK) * WEEK;
        expect(await gaugeController.timeTotal()).to.equal(newExpectedTime);
      }
    });
  });
});
