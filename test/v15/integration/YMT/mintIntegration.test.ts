import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber } from "ethers";
import {
  time,
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { YMT, YMT__factory } from "../../../../typechain";
import Constants from "../../Constants";

const year = Constants.year;

describe("YMT", function () {
  let accounts: SignerWithAddress[];
  let YMT: YMT;
  let snapshot: SnapshotRestorer;

  before(async function () {
    accounts = await ethers.getSigners();
    YMT = await (<YMT__factory>await ethers.getContractFactory("YMT")).deploy();

    await time.increase(86401);
    await YMT.updateMiningParameters();
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  describe("YMT Mint Integration Tests", function () {
    // 指定された期間に応じて正しい量のトークンを発行する
    it("should mint the correct amount of tokens", async function () {
      const duration = year;
      await YMT.setMinter(accounts[0].address);
      const creationTime = await YMT.startEpochTime();
      const initialSupply = await YMT.totalSupply();
      const rate = await YMT.rate();

      await time.increase(duration);

      const currentTime = BigNumber.from(await time.latest());
      const amount = currentTime.sub(creationTime).mul(rate);
      await YMT.mint(accounts[1].address, amount);

      expect(await YMT.balanceOf(accounts[1].address)).to.equal(amount);
      expect(await YMT.totalSupply()).to.equal(initialSupply.add(amount));
    });

    // 利用可能な量を超えるトークンを発行しようとした場合にリバートする
    it("should revert when trying to mint more than the available amount", async function () {
      const duration = year;
      await YMT.setMinter(accounts[0].address);
      const creationTime = await YMT.startEpochTime();
      const rate = await YMT.rate();

      await time.increase(duration);

      const currentTime = BigNumber.from(await time.latest());
      const amount = currentTime.sub(creationTime).add(2).mul(rate);
      await expect(YMT.mint(accounts[1].address, amount)).to.be.revertedWith(
        "dev: exceeds allowable mint amount"
      );
    });

    // 複数回にわたって正確にトークンを発行する
    it("should accurately mint tokens multiple times", async function () {
      await YMT.setMinter(accounts[0].address);
      let totalSupply = await YMT.totalSupply();
      let balance = BigNumber.from(0);
      let epochStart = Number(await YMT.startEpochTime());

      const durations = [year * 0.33, year * 0.5, year * 0.7];

      for (const duration of durations) {
        await time.increase(duration);

        if ((await time.latest()) - epochStart > year) {
          await YMT.updateMiningParameters();
          epochStart = Number(await YMT.startEpochTime());
        }

        const amount = (await YMT.availableSupply()).sub(totalSupply);
        await YMT.mint(accounts[1].address, amount);

        balance = balance.add(amount);
        totalSupply = totalSupply.add(amount);

        expect(await YMT.balanceOf(accounts[1].address)).to.equal(balance);
        expect(await YMT.totalSupply()).to.equal(totalSupply);
      }
    });
  });
});
