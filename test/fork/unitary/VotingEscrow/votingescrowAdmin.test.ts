import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import {
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

describe("VotingEscrow", () => {
  let votingEscrow: Contract;
  let token: Contract;
  let accounts: SignerWithAddress[];
  let snapshot: SnapshotRestorer;

  beforeEach(async function () {
    snapshot = await takeSnapshot();
    const CRV = await ethers.getContractFactory("CRV");
    const VotingEscrow = await ethers.getContractFactory("VotingEscrow");

    token = await CRV.deploy();
    await token.deployed();

    votingEscrow = await VotingEscrow.deploy(
      token.address,
      "Voting-escrowed token",
      "vetoken",
      "v1"
    );
    await votingEscrow.deployed();

    accounts = await ethers.getSigners();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  it("test_commit_admin_only", async function () {
    await expect(
      votingEscrow
        .connect(accounts[1])
        .commitTransferOwnership(accounts[1].address)
    ).to.be.revertedWith("admin only");
  });

  it("test_apply_admin_only", async function () {
    await expect(
      votingEscrow.connect(accounts[1]).applyTransferOwnership()
    ).to.be.revertedWith("admin only");
  });

  it("test_commit_transfer_ownership", async function () {
    await votingEscrow
      .connect(accounts[0])
      .commitTransferOwnership(accounts[1].address);

    expect(await votingEscrow.admin()).to.equal(accounts[0].address);
    expect(await votingEscrow.futureAdmin()).to.equal(accounts[1].address);
  });

  it("test_apply_transfer_ownership", async function () {
    await votingEscrow
      .connect(accounts[0])
      .commitTransferOwnership(accounts[1].address);
    await votingEscrow.connect(accounts[0]).applyTransferOwnership();

    expect(await votingEscrow.admin()).to.equal(accounts[1].address);
  });

  it("test_apply_without_commit", async function () {
    await expect(
      votingEscrow.connect(accounts[0]).applyTransferOwnership()
    ).to.be.revertedWith("admin not set");
  });
});
