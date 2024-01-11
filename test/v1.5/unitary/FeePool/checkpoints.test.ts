import { expect } from "chai";
import { ethers } from "hardhat";
import {
  time,
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import {
  FeePoolV2,
  FeePoolV2__factory,
  YmtVesting,
  YMT,
  YmtVesting__factory,
  YMT__factory,
  VeYMT,
  VeYMT__factory,
} from "../../../../typechain";
import { getProxy } from "../../../../src/testUtil";
import { upgradeProxy } from "../../../../src/upgradeUtil";
import { contractVersion } from "../../../param/version";
import Constants from "../../Constants";

const week = Constants.week;
const year = Constants.year;
const MAX_UINT256 = Constants.MAX_UINT256;

describe("FeePoolV2", () => {
  let alice: SignerWithAddress;

  let feePool: FeePoolV2;
  let veYMT: VeYMT;
  let YMT: YMT;
  let YmtVesting: YmtVesting;
  let snapshot: SnapshotRestorer;

  before(async function () {
    [alice] = await ethers.getSigners();

    YmtVesting = await (<YmtVesting__factory>(
      await ethers.getContractFactory("YmtVesting")
    )).deploy();

    YMT = await (<YMT__factory>await ethers.getContractFactory("YMT")).deploy(
      YmtVesting.address
    );

    veYMT = await (<VeYMT__factory>(
      await ethers.getContractFactory("veYMT")
    )).deploy(YMT.address);
    feePool = await getProxy<FeePoolV2, FeePoolV2__factory>(
      "FeePool",
      [],
      1
    );
    feePool = await upgradeProxy(feePool.address, "FeePoolV2", undefined, {
      call: { fn: "initializeV2", args: [await time.latest()] },
    });

    await feePool.setVeYMT(veYMT.address);
    console.log(await feePool.timeCursor())
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  // TODO
  // 下記の観点のテストを追加
  // https://discord.com/channels/729808684359876718/729812922649542758/1162241240360816730

  describe("test_checkpoints", () => {
    beforeEach(async function () {
      await YMT.approve(veYMT.address, MAX_UINT256);
      await veYMT.createLock(
        ethers.utils.parseEther("1000"),
        (await time.latest()) + week * 52
      );
    });
    it("should correctly checkpoint total supply", async function () {
      // 合計供給量のチェックポイントをテストする
      const startTime = await feePool.timeCursor();
      const weekEpoch =
        Math.floor(((await time.latest()) + week) / week) * week;

      await time.increaseTo(weekEpoch);

      const weekBlock = await time.latestBlock();

      await feePool.checkpointTotalSupply();

      expect(await feePool.veSupply(startTime)).to.equal(0);
      expect(await feePool.veSupply(weekEpoch)).to.equal(
        await veYMT.totalSupplyAt(weekBlock)
      );
    });

    it("should advance time cursor correctly", async function () {
      // 時間カーソルの進行をテストする
      const startTime = (await feePool.timeCursor()).toNumber();
      await time.increase(year);
      await feePool.checkpointTotalSupply();
      const newTimeCursor = (await feePool.timeCursor()).toNumber();
      expect(newTimeCursor).to.equal(startTime + week * 20);
      expect(await feePool.veSupply(startTime + week * 19)).to.be.above(0);
      expect(await feePool.veSupply(startTime + week * 20)).to.equal(0);

      await feePool.checkpointTotalSupply();

      expect(await feePool.timeCursor()).to.equal(startTime + week * 40);
      expect(await feePool.veSupply(startTime + week * 20)).to.be.above(0);
      expect(await feePool.veSupply(startTime + week * 39)).to.be.above(0);
      expect(await feePool.veSupply(startTime + week * 40)).to.equal(0);
    });

    it("should claim and checkpoint total supply correctly", async function () {
      // 合計供給量のチェックポイントと請求をテストする
      const start_time = (await feePool.timeCursor()).toNumber();

      await feePool.connect(alice)["claim()"]();

      expect((await feePool.timeCursor()).toNumber()).to.equal(
        start_time + week
      );
    });

    it("should toggle allow checkpoint correctly", async function () {
      // チェックポイント許可の切り替えをテストする
      const lastTokenTime = (await feePool.lastTokenTime()).toNumber();

      await time.increase(week);

      await feePool.connect(alice)["claim()"]();
      expect((await feePool.lastTokenTime()).toNumber()).to.equal(
        lastTokenTime
      );

      await feePool.toggleAllowCheckpointToken();
      const tx = await feePool.connect(alice)["claim()"]();
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      expect((await feePool.lastTokenTime()).toNumber()).to.equal(
        block.timestamp
      );
    });
  });
});
