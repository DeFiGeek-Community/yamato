import { ethers } from "hardhat";
import { expect } from "chai";
import {
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import {
  YMT,
  YMT__factory,
} from "../../../../typechain";

describe("YMT", function () {
  let accounts: SignerWithAddress[];
  let YMT: YMT;
  let snapshot: SnapshotRestorer;

  before(async function () {
    accounts = await ethers.getSigners();
    YMT = await (<YMT__factory>await ethers.getContractFactory("YMT")).deploy();
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  describe("YMT Setters Tests", function () {
    it("non-admin should not be able to set ymtMinter", async function () {
      // 非管理者がymtMinterを設定できないことを確認するテスト
      await expect(
        YMT.connect(accounts[1]).setMinter(accounts[2].address)
      ).to.be.revertedWith("dev: admin only");
    });

    it("non-admin should not be able to set admin", async function () {
      // 非管理者がadminを設定できないことを確認するテスト
      await expect(
        YMT.connect(accounts[1]).setAdmin(accounts[2].address)
      ).to.be.revertedWith("dev: admin only");
    });

    it("admin should be able to set ymtMinter", async function () {
      // 管理者がymtMinterを設定できることを確認するテスト
      await YMT.setMinter(accounts[1].address);
      expect(await YMT.ymtMinter()).to.equal(accounts[1].address);
    });

    it("admin should be able to set admin", async function () {
      // 管理者がadminを設定できることを確認するテスト
      await YMT.setAdmin(accounts[1].address);
      expect(await YMT.admin()).to.equal(accounts[1].address);
    });
  });
});
