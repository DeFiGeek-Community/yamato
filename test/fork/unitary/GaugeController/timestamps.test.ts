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

  let snapshot: SnapshotRestorer;

  const TYPE_WEIGHTS = Constants.TYPE_WEIGHTS;
  const week = Constants.week;
  const year = Constants.year;

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
      const expectedTime = Math.floor((currentTime + week) / week) * week;
      expect(await gaugeController.timeTotal()).to.equal(expectedTime);

      for (let i = 0; i < 5; i++) {
        await ethers.provider.send("evm_increaseTime", [
          Math.floor(1.1 * year),
        ]);

        await gaugeController.checkpoint();

        const newCurrentTime = (await ethers.provider.getBlock("latest"))
          .timestamp;
        const newExpectedTime =
          Math.floor((newCurrentTime + week) / week) * week;
        expect(await gaugeController.timeTotal()).to.equal(newExpectedTime);
      }
    });
  });
});
