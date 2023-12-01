import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import {
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

describe.only("veYMT", () => {
  let veYMT: Contract;
  let token: Contract;
  let accounts: SignerWithAddress[];
  let snapshot: SnapshotRestorer;

  before(async function () {
    snapshot = await takeSnapshot();
    const YMT = await ethers.getContractFactory("YMT");
    const VeYMT = await ethers.getContractFactory("veYMT");

    token = await YMT.deploy();
    await token.deployed();

    veYMT = await VeYMT.deploy(token.address);
    await veYMT.deployed();

    accounts = await ethers.getSigners();
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  it("test_commit_admin_only", async function () {
    await expect(
      veYMT.connect(accounts[1]).commitTransferOwnership(accounts[1].address)
    ).to.be.revertedWith("admin only");
  });

  it("test_apply_admin_only", async function () {
    await expect(
      veYMT.connect(accounts[1]).applyTransferOwnership()
    ).to.be.revertedWith("admin only");
  });

  it("test_commit_transfer_ownership", async function () {
    await veYMT
      .connect(accounts[0])
      .commitTransferOwnership(accounts[1].address);

    expect(await veYMT.admin()).to.equal(accounts[0].address);
    expect(await veYMT.futureAdmin()).to.equal(accounts[1].address);
  });

  it("test_apply_transfer_ownership", async function () {
    await veYMT
      .connect(accounts[0])
      .commitTransferOwnership(accounts[1].address);
    await veYMT.connect(accounts[0]).applyTransferOwnership();

    expect(await veYMT.admin()).to.equal(accounts[1].address);
  });

  it("test_apply_without_commit", async function () {
    await expect(
      veYMT.connect(accounts[0]).applyTransferOwnership()
    ).to.be.revertedWith("admin not set");
  });
});
