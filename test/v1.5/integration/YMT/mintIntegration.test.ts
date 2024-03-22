import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber } from "ethers";
import {
  time,
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import {
  YMT,
  YMT__factory,
  YmtVesting,
  YmtVesting__factory,
} from "../../../../typechain";
import Constants from "../../Constants";
import { approxEqual } from "../../testHelpers";

const year = Constants.year;
const day = Constants.day;
const ten_to_the_18 = Constants.ten_to_the_18;

describe("YMT", function () {
  let accounts: SignerWithAddress[];
  let YMT: YMT;
  let YmtVesting: YmtVesting;
  let snapshot: SnapshotRestorer;

  before(async function () {
    accounts = await ethers.getSigners();
    YmtVesting = await (<YmtVesting__factory>(
      await ethers.getContractFactory("YmtVesting")
    )).deploy();

    YMT = await (<YMT__factory>await ethers.getContractFactory("YMT")).deploy(
      YmtVesting.address
    );

    await time.increase(day);
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

  describe("YMT Long-Term Mining Parameters", function () {
    // 400年間にわたるマイニングパラメータの変化とトークンmintをテスト
    it("should correctly reduce mining parameters over 400 years", async function () {
      const initialRate = await YMT.rate();
      await YMT.setMinter(accounts[0].address);
      let currentRate = initialRate;
      let totalMinted = BigNumber.from(0);

      // 400年間、毎年マイニングパラメータを更新
      for (let i = 0; i < 400; i++) {
        // 次の年に時間を進める
        await time.increase(year);

        // マイニングパラメータを更新
        await YMT.updateMiningParameters();

        // 新しいレートを取得
        let newRate = await YMT.rate();

        // レートが減少したことを確認
        if (Number(newRate) > 0) {
          expect(newRate).to.be.below(currentRate);
        }

        // 総供給量が一定の限界に達したかどうかを確認
        const totalSupply = await YMT.totalSupply();
        const availableSupply = await YMT.availableSupply();

        // トークンの発行量を計算してmint
        let yearMinted = currentRate.mul(year);
        await YMT.mint(accounts[1].address, availableSupply.sub(totalSupply));
        totalMinted = totalMinted.add(yearMinted);

        expect(availableSupply).to.be.lte(
          BigNumber.from("1000000000").mul(ten_to_the_18)
        );
        expect(totalSupply).to.be.lte(
          BigNumber.from("1000000000").mul(ten_to_the_18)
        );

        currentRate = newRate;
      }

      // トークンの総発行量が最大限界に達していることを確認
      const finalTotalSupply = await YMT.totalSupply();
      expect(
        approxEqual(
          finalTotalSupply,
          BigNumber.from("1000000000").mul(ten_to_the_18),
          ten_to_the_18
        )
      ).to.be.true;
    });
  });
});
