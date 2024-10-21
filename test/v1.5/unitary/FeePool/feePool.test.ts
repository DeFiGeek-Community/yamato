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
import { gasCostOf } from "../../testHelpers";

const day = Constants.day;
const week = Constants.week;
const ten_to_the_18 = Constants.ten_to_the_18;
const ten_to_the_19 = Constants.ten_to_the_19;

describe("FeePoolV2", () => {
  let alice, bob, charlie: SignerWithAddress;

  let feePool: FeePoolV2;
  let veYMT: VeYMT;
  let YMT: YMT;
  let YmtVesting: YmtVesting;
  let snapshot: SnapshotRestorer;

  before(async function () {
    [alice, bob, charlie] = await ethers.getSigners();

    YmtVesting = await (<YmtVesting__factory>(
      await ethers.getContractFactory("YmtVesting")
    )).deploy();

    YMT = await (<YMT__factory>await ethers.getContractFactory("YMT")).deploy(
      YmtVesting.address,
      alice.address
    );

    veYMT = await (<VeYMT__factory>(
      await ethers.getContractFactory("veYMT")
    )).deploy(YMT.address);

    feePool = await getProxy<FeePoolV2, FeePoolV2__factory>("FeePool", [], 1);
    feePool = await upgradeProxy(feePool.address, "FeePoolV2", undefined, {
      call: { fn: "initializeV2", args: [await time.latest()] },
    });
    await feePool.setVeYMT(veYMT.address);
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  describe("test_fee_distribution", () => {
    it("should correctly claim after deposit", async function () {
      // デポジット後のclaimテスト
      const amount = ethers.utils.parseEther("1000");
      await YMT.connect(alice).approve(veYMT.address, amount.mul(10));

      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 7; j++) {
          await bob.sendTransaction({
            to: feePool.address,
            value: ten_to_the_18,
          });
          await feePool.checkpointToken();
          await feePool.checkpointTotalSupply();
          await time.increase(day);
        }
      }

      await time.increase(week);
      await veYMT
        .connect(alice)
        .createLock(amount, (await time.latest()) + 3 * week);
      await time.increase(2 * week);

      await feePool.connect(alice)["claim()"]();

      const balanceBefore = await ethers.provider.getBalance(alice.address);
      const tx = await feePool.connect(alice)["claim()"]();
      const balanceAfter = await ethers.provider.getBalance(alice.address);
      expect(balanceAfter.sub(balanceBefore).add(await gasCostOf(tx))).to.be.eq(
        0
      );
    });

    it("should correctly claim during deposit", async function () {
      // デポジット中のclaimテスト
      const amount = ethers.utils.parseEther("1000");
      await YMT.connect(alice).approve(veYMT.address, amount.mul(10));

      await time.increase(week);
      await veYMT
        .connect(alice)
        .createLock(amount, (await time.latest()) + 8 * week);
      await time.increase(week);

      feePool = await getProxy<FeePoolV2, FeePoolV2__factory>("FeePool", [], 1);
      feePool = await upgradeProxy(feePool.address, "FeePoolV2", undefined, {
        call: { fn: "initializeV2", args: [await time.latest()] },
      });
      await feePool.setVeYMT(veYMT.address);

      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 7; j++) {
          await bob.sendTransaction({
            to: feePool.address,
            value: ten_to_the_18,
          });
          await feePool.checkpointToken();
          await feePool.checkpointTotalSupply();
          await time.increase(day);
        }
      }

      await time.increase(week);
      await feePool.checkpointToken();
      const balanceAlice = await ethers.provider.getBalance(alice.address);
      const tx = await feePool.connect(alice)["claim()"]();
      const gasCost = await gasCostOf(tx);
      const afterBalanceAlice = await ethers.provider.getBalance(alice.address);

      expect(afterBalanceAlice.sub(balanceAlice).add(gasCost)).to.be.closeTo(
        ethers.utils.parseEther("21"),
        20
      );
    });

    it("should correctly claim before deposit", async function () {
      // デポジット前のclaimテスト
      const [alice, bob] = await ethers.getSigners();
      const amount = ethers.utils.parseEther("1000");

      await YMT.connect(alice).approve(veYMT.address, amount.mul(10));

      await veYMT
        .connect(alice)
        .createLock(amount, (await time.latest()) + 8 * week);
      await time.increase(week);
      const startTime = await time.latest();
      await time.increase(week * 5);

      feePool = await getProxy<FeePoolV2, FeePoolV2__factory>("FeePool", [], 1);
      feePool = await upgradeProxy(feePool.address, "FeePoolV2", undefined, {
        call: { fn: "initializeV2", args: [await time.latest()] },
      });
      await feePool.setVeYMT(veYMT.address);

      await bob.sendTransaction({
        to: feePool.address,
        value: ten_to_the_19,
      });

      await feePool.checkpointToken();
      await time.increase(week);
      await feePool.checkpointToken();
      let balanceAlice = await ethers.provider.getBalance(alice.address);
      const tx = await feePool.connect(alice)["claim()"]();
      balanceAlice = (await ethers.provider.getBalance(alice.address))
        .sub(balanceAlice)
        .add(await gasCostOf(tx));
      expect(Number(balanceAlice) - 10 ** 18).to.be.gte(10 ** 18);
    });

    it("should correctly claim on double deposit", async function () {
      // 二重デポジットのclaimテスト
      const amount = ethers.utils.parseEther("1000");

      await YMT.approve(veYMT.address, amount.mul(10));

      const currentTimestamp = await time.latest();
      await veYMT.createLock(amount, currentTimestamp + 4 * week);

      await time.increase(week);

      const startTime = await time.latest();

      await time.increase(3 * week);

      await veYMT.connect(alice).withdraw();
      const excludeTime = Math.floor((await time.latest()) / week) * week;
      await veYMT
        .connect(alice)
        .createLock(amount, (await time.latest()) + 4 * week);

      await time.increase(2 * week);

      feePool = await getProxy<FeePoolV2, FeePoolV2__factory>("FeePool", [], 1);
      feePool = await upgradeProxy(feePool.address, "FeePoolV2", undefined, {
        call: { fn: "initializeV2", args: [startTime] },
      });
      await feePool.setVeYMT(veYMT.address);

      await bob.sendTransaction({
        to: feePool.address,
        value: ten_to_the_19,
      });

      await feePool.checkpointToken();

      await time.increase(week);

      await feePool.checkpointToken();

      await feePool.connect(alice)["claim()"]();

      const tokensToExclude = await feePool.tokensPerWeek(excludeTime);

      expect(
        ethers.utils
          .parseEther("10")
          .sub(await ethers.provider.getBalance(alice.address))
          .sub(tokensToExclude)
      ).to.be.lt(10);
    });

    it("should correctly claim on parallel deposit", async function () {
      // 並行デポジットのclaimテスト
      const amount = ethers.utils.parseEther("1000");

      await YMT.connect(alice).approve(veYMT.address, amount.mul(10));
      await YMT.connect(bob).approve(veYMT.address, amount.mul(10));
      await YMT.connect(alice).transfer(bob.address, amount);

      const currentTimestamp = await time.latest();
      await veYMT
        .connect(alice)
        .createLock(amount, currentTimestamp + 8 * week);
      await veYMT.connect(bob).createLock(amount, currentTimestamp + 8 * week);

      await time.increase(week);

      const startTime = await time.latest();

      await time.increase(5 * week);

      feePool = await getProxy<FeePoolV2, FeePoolV2__factory>("FeePool", [], 1);
      feePool = await upgradeProxy(feePool.address, "FeePoolV2", undefined, {
        call: { fn: "initializeV2", args: [startTime] },
      });
      await feePool.setVeYMT(veYMT.address);

      await bob.sendTransaction({
        to: feePool.address,
        value: ten_to_the_19,
      });

      await feePool.checkpointToken();

      await time.increase(week);

      await feePool.checkpointToken();

      let balanceAlice = await ethers.provider.getBalance(alice.address);
      let balanceBob = await ethers.provider.getBalance(bob.address);

      const txAlice = await feePool.connect(alice)["claim()"]();
      const txBob = await feePool.connect(bob)["claim()"]();

      balanceAlice = (await ethers.provider.getBalance(alice.address))
        .sub(balanceAlice)
        .add(await gasCostOf(txAlice));
      balanceBob = (await ethers.provider.getBalance(bob.address))
        .sub(balanceBob)
        .add(await gasCostOf(txBob));

      expect(balanceAlice).to.equal(balanceBob);
      expect(balanceAlice.add(balanceBob)).to.be.closeTo(ten_to_the_19, 20);
    });
  });
});
