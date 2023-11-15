import { expect } from "chai";
import { ethers } from "hardhat";
import {
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { deployContracts } from "../../Helper";
import Constants from "../../Constants";

describe("LiquidityGauge checkpoint", function () {
  let accounts: SignerWithAddress;
  let gauges: Contract[];

  let snapshot: SnapshotRestorer;
  const year = Constants.year;

  beforeEach(async function () {
    snapshot = await takeSnapshot();
    accounts = await ethers.getSigners();
    ({ gauges } = await deployContracts());
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  it("test_user_checkpoint", async function () {
    // Assuming `userCheckpoint` is a function on your contract
    await gauges[0].connect(accounts[1]).userCheckpoint(accounts[1].address);
  });

  it("test_user_checkpoint_new_period", async function () {
    await gauges[0].connect(accounts[1]).userCheckpoint(accounts[1].address);

    // Increase the time on the blockchain
    await ethers.provider.send("evm_increaseTime", [year * 1.1]);
    await ethers.provider.send("evm_mine"); // this one will actually mine a new block

    await gauges[0].connect(accounts[1]).userCheckpoint(accounts[1].address);
  });

  it("test_user_checkpoint_wrong_account", async function () {
    // Expect the transaction to be reverted with the specified error message
    await expect(
      gauges[0].connect(accounts[1]).userCheckpoint(accounts[2].address)
    ).to.be.revertedWith("dev: unauthorized");
  });
});
