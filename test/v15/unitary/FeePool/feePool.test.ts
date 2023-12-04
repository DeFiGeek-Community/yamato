import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import {
  time,
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import {
  FeePool,
  FeePool__factory,
} from "../../../../typechain";
import { getProxy } from "../../../../src/testUtil";
import { contractVersion } from "../../../param/version";

const DAY = 86400;
const WEEK = DAY * 7;

describe("FeePoolV2", () => {
  let alice, bob, charlie: SignerWithAddress;

  let feePool: Contract;
  let veYMT: Contract;
  let YMT: Contract;
  let snapshot: SnapshotRestorer;

  before(async function () {
    [alice, bob, charlie] = await ethers.getSigners();

    const ymt = await ethers.getContractFactory("YMT");
    const VeYMT = await ethers.getContractFactory("veYMT");

    YMT = await ymt.deploy();
    await YMT.deployed();

    veYMT = await VeYMT.deploy(YMT.address);
    await veYMT.deployed();

    feePool = await getProxy<FeePool, FeePool__factory>(
      contractVersion["FeePool"],
      [await time.latest()]
    );
    await feePool.setVeYMT(veYMT.address);
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  async function gasCostOf(tx) {
    const receipt = await tx.wait()
    return receipt.gasUsed.mul(receipt.effectiveGasPrice)
  }

  describe("test_fee_distribution", () => {
    it("test_deposited_after", async function () {
      const amount = ethers.utils.parseEther("1000");
      await YMT.connect(alice).approve(veYMT.address, amount.mul(10));

      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 7; j++) {
          await bob.sendTransaction({
            to: feePool.address,
            value: ethers.utils.parseEther("1"),
          });
          await feePool.checkpointToken();
          await feePool.checkpointTotalSupply();
          await time.increase(DAY);
        }
      }

      await time.increase(WEEK);
      await veYMT
        .connect(alice)
        .createLock(amount, (await time.latest()) + 3 * WEEK);
      await time.increase(2 * WEEK);

      await feePool.connect(alice)["claim()"]();

      const balanceBefore = await ethers.provider.getBalance(alice.address);
      const tx = await feePool.connect(alice)["claim()"]();
      const balanceAfter = await ethers.provider.getBalance(alice.address);
      expect(balanceAfter.sub(balanceBefore).add(await gasCostOf(tx))).to.be.eq(0);
    });

    it("test_deposited_during", async function () {
      const amount = ethers.utils.parseEther("1000");
      await YMT.connect(alice).approve(veYMT.address, amount.mul(10));

      await time.increase(WEEK);
      await veYMT
        .connect(alice)
        .createLock(amount, (await time.latest()) + 8 * WEEK);
      await time.increase(WEEK);

      feePool = await getProxy<FeePool, FeePool__factory>(
        contractVersion["FeePool"],
        [await time.latest()]
      );
      await feePool.setVeYMT(veYMT.address);

      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 7; j++) {
          await bob.sendTransaction({
            to: feePool.address,
            value: ethers.utils.parseEther("1"),
          });
          await feePool.checkpointToken();
          await feePool.checkpointTotalSupply();
          await time.increase(DAY);
        }
      }

      await time.increase(WEEK);
      await feePool.checkpointToken();
      const balanceAlice = await ethers.provider.getBalance(alice.address);
      const tx = await feePool.connect(alice)["claim()"]();
      const gasCost = await gasCostOf(tx)
      const afterBalanceAlice = await ethers.provider.getBalance(alice.address);

      expect(afterBalanceAlice.sub(balanceAlice).add(gasCost)).to.be.closeTo(
        ethers.utils.parseEther("21"),
        20
      );
    });

    it("test_deposited_before", async function () {
      const [alice, bob] = await ethers.getSigners();
      const amount = ethers.utils.parseEther("1000");

      await YMT.connect(alice).approve(veYMT.address, amount.mul(10));

      await veYMT
        .connect(alice)
        .createLock(amount, (await time.latest()) + 8 * WEEK);
      await time.increase(WEEK);
      const startTime = await time.latest();
      await time.increase(WEEK * 5);

      feePool = await getProxy<FeePool, FeePool__factory>(
        contractVersion["FeePool"],
        [await time.latest()]
      );
      await feePool.setVeYMT(veYMT.address);

      await bob.sendTransaction({
        to: feePool.address,
        value: ethers.utils.parseEther("10"),
      });

      await feePool.checkpointToken();
      await time.increase(WEEK);
      await feePool.checkpointToken();
      let balanceAlice = await ethers.provider.getBalance(alice.address);
      const tx = await feePool.connect(alice)["claim()"]();
      balanceAlice = (await ethers.provider.getBalance(alice.address)).sub(balanceAlice).add(await gasCostOf(tx));
      expect(
        Number(balanceAlice) - 10 ** 18
      ).to.be.gte(10 ** 18);
    });

    it("test_deposited_twice", async function () {
      const amount = ethers.utils.parseEther("1000");

      await YMT.approve(veYMT.address, amount.mul(10));

      const currentTimestamp = await time.latest();
      await veYMT.createLock(amount, currentTimestamp + 4 * WEEK);

      await time.increase(WEEK);

      const startTime = await time.latest();

      await time.increase(3 * WEEK);

      await veYMT.connect(alice).withdraw();
      const excludeTime = Math.floor((await time.latest()) / WEEK) * WEEK;
      await veYMT
        .connect(alice)
        .createLock(amount, (await time.latest()) + 4 * WEEK);

      await time.increase(2 * WEEK);

      feePool = await getProxy<FeePool, FeePool__factory>(
        contractVersion["FeePool"],
        [startTime]
      );
      await feePool.setVeYMT(veYMT.address);

      await bob.sendTransaction({
        to: feePool.address,
        value: ethers.utils.parseEther("10"),
      });

      await feePool.checkpointToken();

      await time.increase(WEEK);

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

    it("test_deposited_parallel", async function () {
      const amount = ethers.utils.parseEther("1000");

      await YMT.connect(alice).approve(veYMT.address, amount.mul(10));
      await YMT.connect(bob).approve(veYMT.address, amount.mul(10));
      await YMT.connect(alice).transfer(bob.address, amount);

      const currentTimestamp = await time.latest();
      await veYMT
        .connect(alice)
        .createLock(amount, currentTimestamp + 8 * WEEK);
      await veYMT.connect(bob).createLock(amount, currentTimestamp + 8 * WEEK);

      await time.increase(WEEK);

      const startTime = await time.latest();

      await time.increase(5 * WEEK);

      feePool = await getProxy<FeePool, FeePool__factory>(
        contractVersion["FeePool"],
        [startTime]
      );
      await feePool.setVeYMT(veYMT.address);

      await bob.sendTransaction({
        to: feePool.address,
        value: ethers.utils.parseEther("10"),
      });

      await feePool.checkpointToken();

      await time.increase(WEEK);

      await feePool.checkpointToken();

      let balanceAlice = await ethers.provider.getBalance(alice.address);
      let balanceBob = await ethers.provider.getBalance(bob.address);

      const txAlice = await feePool.connect(alice)["claim()"]();
      const txBob = await feePool.connect(bob)["claim()"]();

      balanceAlice = (await ethers.provider.getBalance(alice.address)).sub(balanceAlice).add(await gasCostOf(txAlice));
      balanceBob = (await ethers.provider.getBalance(bob.address)).sub(balanceBob).add(await gasCostOf(txBob));

      expect(balanceAlice).to.equal(balanceBob);
      expect(balanceAlice.add(balanceBob)).to.be.closeTo(
        ethers.utils.parseEther("10"),
        20
      );
    });
  });
});
