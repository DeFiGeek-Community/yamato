import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
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

  describe("YMT Burn Function Tests", function () {
    it("should correctly burn a specific amount of tokens", async function () {
      // 特定の量のトークンを正しく燃焼させるテスト
      const balance: BigNumber = await YMT.balanceOf(accounts[0].address);
      const initialSupply: BigNumber = await YMT.totalSupply();

      await YMT.burn(31337);

      expect(await YMT.balanceOf(accounts[0].address)).to.equal(
        balance.sub(31337)
      );
      expect(await YMT.totalSupply()).to.equal(initialSupply.sub(31337));
    });

    it("should allow non-admin to burn their tokens", async function () {
      // 非管理者が自分のトークンを燃焼させることを許可するテスト
      const initialSupply: BigNumber = await YMT.totalSupply();

      await YMT.transfer(accounts[1].address, 1000000);
      await YMT.connect(accounts[1]).burn(31337);

      expect(await YMT.balanceOf(accounts[1].address)).to.equal(
        1000000 - 31337
      );
      expect(await YMT.totalSupply()).to.equal(initialSupply.sub(31337));
    });

    it("should correctly burn the entire token supply", async function () {
      // トークン供給の全量を正しく燃焼させるテスト
      const initialSupply: BigNumber = await YMT.totalSupply();

      await YMT.burn(initialSupply);

      expect(await YMT.balanceOf(accounts[0].address)).to.equal(0);
      expect(await YMT.totalSupply()).to.equal(0);
    });

    it("should revert if burning more than the total supply", async function () {
      // 総供給量を超える量を燃焼させようとした場合にリバートするテスト
      const initialSupply: BigNumber = await YMT.totalSupply();

      await expect(
        YMT.burn(initialSupply.add(1))
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });
  });
});
