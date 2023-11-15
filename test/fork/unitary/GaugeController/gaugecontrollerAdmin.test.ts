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

  beforeEach(async function () {
    snapshot = await takeSnapshot();
    accounts = await ethers.getSigners();
    ({ gaugeController } = await deployContracts());
    await gaugeController.addType("none", TYPE_WEIGHTS[0]);
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  describe("GaugeController GaugecontrollerAdmin", function () {
    it("test_commit_admin_only", async function () {
      await expect(
        gaugeController
          .connect(accounts[1])
          .commitTransferOwnership(accounts[1].address)
      ).to.be.revertedWith("admin only");
    });

    it("test_apply_admin_only", async function () {
      await expect(
        gaugeController.connect(accounts[1]).applyTransferOwnership()
      ).to.be.revertedWith("admin only");
    });

    it("test_commit_transfer_ownership", async function () {
      await gaugeController.commitTransferOwnership(accounts[1].address);

      expect(await gaugeController.admin()).to.equal(
        await accounts[0].getAddress()
      );
      expect(await gaugeController.futureAdmin()).to.equal(accounts[1].address);
    });

    it("test_apply_transfer_ownership", async function () {
      await gaugeController.commitTransferOwnership(accounts[1].address);
      await gaugeController.applyTransferOwnership();

      expect(await gaugeController.admin()).to.equal(accounts[1].address);
    });

    it("test_apply_without_commit", async function () {
      await expect(gaugeController.applyTransferOwnership()).to.be.revertedWith(
        "admin not set"
      );
    });
  });
});
