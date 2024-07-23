import { expect } from "chai";
import { ethers } from "hardhat";
import {
  time,
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import {
  YmtVesting,
  YMT,
  YmtVesting__factory,
  YMT__factory,
  VeYMT,
  VeYMT__factory,
} from "../../../../typechain";
import Constants from "../../Constants";

const week = Constants.week;
const ten_to_the_18 = Constants.ten_to_the_18;
const ten_to_the_20 = Constants.ten_to_the_20;

describe("veYMT", function () {
  let accounts: SignerWithAddress[];
  let veYMT: VeYMT;
  let YMT: YMT;
  let YmtVesting: YmtVesting;
  let snapshot: SnapshotRestorer;

  before(async () => {
    // テストの前準備: サインアップ、コントラクトのデプロイ、初期承認
    accounts = await ethers.getSigners();
    YmtVesting = await (<YmtVesting__factory>(
      await ethers.getContractFactory("YmtVesting")
    )).deploy();
    YMT = await (<YMT__factory>await ethers.getContractFactory("YMT")).deploy(
      YmtVesting.address
    );
    veYMT = await (<VeYMT__factory>(
      await ethers.getContractFactory("veYMT")
    )).deploy(YMT.address);
    await YMT.connect(accounts[0]).approve(veYMT.address, ten_to_the_20);
  });

  beforeEach(async () => {
    // 各テストの前にスナップショットを取る
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    // 各テストの後にスナップショットを復元する
    await snapshot.restore();
  });

  it("should allow any depositor to deposit for a user after toggleDepositForAllApproval is enabled", async () => {
    // ユーザーがロックを作成し、全てのデポジターに対してdepositForの実行を許可する
    await veYMT
      .connect(accounts[0])
      .createLock(ten_to_the_18, (await time.latest()) + week);
    await veYMT.connect(accounts[0]).toggleDepositForAllApproval();

    // 許可されたデポジターがdepositForを実行し、成功することを確認
    await expect(
      veYMT
        .connect(accounts[2])
        .depositFor(accounts[0].address, ethers.utils.parseEther("10"))
    ).to.not.be.reverted;
  });

  it("should not allow a depositor to deposit for a user without toggleDepositForAllApproval enabled", async () => {
    // ユーザーがロックを作成するが、全てのデポジターに対する許可は行わない
    await veYMT
      .connect(accounts[0])
      .createLock(ten_to_the_18, (await time.latest()) + week);

    // 許可されていないデポジターがdepositForを実行しようとすると、失敗することを確認
    await expect(
      veYMT
        .connect(accounts[2])
        .depositFor(accounts[0].address, ethers.utils.parseEther("10"))
    ).to.be.revertedWith("Not allowed to deposit for this address");
  });

  it("should toggle depositForAll approval back to original state after being called twice", async () => {
    // ユーザーがロックを作成し、全てのデポジターに対する許可をトグル操作で2回実行する
    await veYMT
      .connect(accounts[0])
      .createLock(ten_to_the_18, (await time.latest()) + week);
    await veYMT.connect(accounts[0]).toggleDepositForAllApproval(); // 許可を与える

    // 2回のトグル操作後、デポジターがdepositForを実行し、成功することを確認
    await expect(
      veYMT
        .connect(accounts[2])
        .depositFor(accounts[0].address, ethers.utils.parseEther("10"))
    ).to.not.be.reverted;

    // さらにトグル操作を行い、許可を取り消す
    await veYMT.connect(accounts[0]).toggleDepositForAllApproval();

    // 許可が取り消された後、デポジターがdepositForを実行しようとすると、失敗することを確認
    await expect(
      veYMT
        .connect(accounts[2])
        .depositFor(accounts[0].address, ethers.utils.parseEther("10"))
    ).to.be.revertedWith("Not allowed to deposit for this address");
  });
});
