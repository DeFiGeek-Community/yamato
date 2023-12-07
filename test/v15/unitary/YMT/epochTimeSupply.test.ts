import { ethers } from "hardhat";
import { expect } from "chai";
import {
  time,
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { BigNumber } from "ethers";
import { YMT, YMT__factory } from "../../../../typechain";
import Constants from "../../Constants";

const week = Constants.week;
const year = Constants.year;
const YEAR = Constants.YEAR;

describe("YMT", function () {
  let YMT: YMT;
  let snapshot: SnapshotRestorer;

  before(async function () {
    YMT = await (<YMT__factory>await ethers.getContractFactory("YMT")).deploy();
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  describe("YMT Epoch Time and Supply Tests", function () {
    // 開始エポック時間が正しく更新されるかを確認するテスト
    it("should update start epoch time correctly", async function () {
      const creationTime: BigNumber = await YMT.startEpochTime();
      await time.increase(year);

      expect(await YMT.startEpochTime()).to.equal(creationTime);

      await YMT.startEpochTimeWrite();

      expect(await YMT.startEpochTime()).to.equal(creationTime.add(YEAR));
    });

    // 同じエポック内で開始エポック時間が更新されないことを確認するテスト
    it("should not update epoch time in the same epoch", async function () {
      await YMT.startEpochTimeWrite();
      await YMT.startEpochTimeWrite();
    });

    // マイニングパラメータが正しく更新されるかを確認するテスト
    it("should update mining parameters correctly", async function () {
      const creationTime = await YMT.startEpochTime();
      const now = BigNumber.from(await time.latest());
      const newEpoch = creationTime.add(YEAR).sub(now);
      await time.increase(newEpoch);
      await YMT.updateMiningParameters();
    });

    // マイニングパラメータが早すぎる場合に更新されないことを確認するテスト
    it("should not update mining parameters too soon", async function () {
      const creationTime = await YMT.startEpochTime();
      const now = BigNumber.from(await time.latest());
      const newEpoch = creationTime.add(YEAR).sub(now);
      await time.increase(newEpoch.sub(BigNumber.from("3")));
      await expect(YMT.updateMiningParameters()).to.be.revertedWith(
        "dev: too soon!"
      );
    });

    // 終了時間が開始時間より前の場合にmintable timeframeがリバートされることを確認するテスト
    it("should revert mintable timeframe if end is before start", async function () {
      const creationTime = await YMT.startEpochTime();
      await expect(
        YMT.mintableInTimeframe(creationTime.add(1), creationTime)
      ).to.be.revertedWith("dev: start > end");
    });

    // 複数のエポックにわたるmintableな量を計算するテスト
    it("should calculate mintable amount over multiple epochs", async function () {
      const creationTime = await YMT.startEpochTime();

      // Two epochs should not raise
      await YMT.mintableInTimeframe(
        creationTime,
        creationTime
          .add(YEAR)
          .mul(BigNumber.from("19").div(BigNumber.from("10")))
      );

      // Three epochs should raise
      await expect(
        YMT.mintableInTimeframe(
          creationTime,
          creationTime
            .add(YEAR)
            .mul(BigNumber.from("21").div(BigNumber.from("10")))
        )
      ).to.be.revertedWith("dev: too far in future");
    });

    // 利用可能な供給量が正しく計算されるかを確認するテスト
    it("should calculate available supply correctly", async function () {
      const creationTime = await YMT.startEpochTime();
      const initialSupply = await YMT.totalSupply();
      const rate = await YMT.rate();
      await time.increase(week);

      const currentTime = BigNumber.from(await time.latest());

      const timeElapsed = currentTime.sub(creationTime);
      const expected = initialSupply.add(timeElapsed.mul(rate));

      expect(await YMT.availableSupply()).to.equal(expected);
    });
  });
});
