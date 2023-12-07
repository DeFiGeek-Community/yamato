import { ethers } from "hardhat";
import { expect } from "chai";
import {
  time,
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { BigNumber } from "ethers";
import {
  YMT,
  YMT__factory,
} from "../../../../typechain";
import Constants from "../../Constants";

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

  describe("YMT Inflation Delay Tests", function () {
    it("should correctly calculate rate after delay", async function () {
      // 遅延後のレートが正しく計算されるかを確認するテスト
      expect(await YMT.rate()).to.equal(0);

      await time.increase(86401);

      await YMT.updateMiningParameters();

      expect(await YMT.rate()).to.be.gt(0);
    });

    it("should correctly set start epoch time after delay", async function () {
      // 遅延後に開始エポック時間が正しく設定されるかを確認するテスト
      const creationTime = await YMT.startEpochTime();
      const now = BigNumber.from(await time.latest());
      expect(creationTime).to.equal(now.add("86400").sub(YEAR));

      await time.increase(86401);

      await YMT.updateMiningParameters();

      expect(await YMT.startEpochTime()).to.equal(creationTime.add(YEAR));
    });

    it("should correctly update mining epoch after delay", async function () {
      // 遅延後にマイニングエポックが正しく更新されるかを確認するテスト
      expect(await YMT.miningEpoch()).to.equal(-1);

      await time.increase(86401);

      await YMT.updateMiningParameters();

      expect(await YMT.miningEpoch()).to.equal(0);
    });

    it("should correctly update available supply after delay", async function () {
      // 遅延後に利用可能な供給量が正しく更新されるかを確認するテスト
      expect(await YMT.availableSupply()).to.equal(
        ethers.utils.parseEther("450000000")
      );

      await time.increase(86401);

      await YMT.updateMiningParameters();

      expect(await YMT.availableSupply()).to.be.gt(
        ethers.utils.parseEther("450000000")
      );
    });
  });
});
