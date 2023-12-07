import { expect } from "chai";
import { ethers } from "hardhat";
import {
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import {
  YMT,
  YMT__factory,
  VeYMT,
  VeYMT__factory,
} from "../../../../typechain";

describe("veYMT", () => {
  let accounts: SignerWithAddress[];
  let veYMT: VeYMT;
  let YMT: YMT;
  let snapshot: SnapshotRestorer;

  before(async function () {
    accounts = await ethers.getSigners();

    YMT = await (<YMT__factory>await ethers.getContractFactory("YMT")).deploy();

    veYMT = await (<VeYMT__factory>(
      await ethers.getContractFactory("veYMT")
    )).deploy(YMT.address);
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  // 管理者権限がない場合のapplyTransferOwnership関数テスト
  it("Commit ownership transfer by non-admin", async function () {
    await expect(
      veYMT.connect(accounts[1]).commitTransferOwnership(accounts[1].address)
    ).to.be.revertedWith("admin only");
  });

  // 管理者権限がない場合のapplyTransferOwnership関数テスト
  it("Apply ownership transfer by non-admin", async function () {
    await expect(
      veYMT.connect(accounts[1]).applyTransferOwnership()
    ).to.be.revertedWith("admin only");
  });

  // commitTransferOwnershipテスト
  it("Successful commitment of transfer ownership", async function () {
    await veYMT.commitTransferOwnership(accounts[1].address);

    expect(await veYMT.admin()).to.equal(accounts[0].address);
    expect(await veYMT.futureAdmin()).to.equal(accounts[1].address);
  });

  // commitTransferOwnershipテスト
  it("Successful application of transfer ownership", async function () {
    await veYMT.commitTransferOwnership(accounts[1].address);
    await veYMT.applyTransferOwnership();

    expect(await veYMT.admin()).to.equal(accounts[1].address);
  });

  // コミットなしでのapplyTransferOwnership関数テスト
  it("Apply transfer ownership without commit", async function () {
    await expect(veYMT.applyTransferOwnership()).to.be.revertedWith(
      "admin not set"
    );
  });
});
