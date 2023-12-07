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
  YMT,
  YMT__factory,
  VeYMT,
  VeYMT__factory,
} from "../../../../typechain";
import { getProxy } from "../../../../src/testUtil";
import { contractVersion } from "../../../param/version";
import Constants from "../../Constants";
import { gasCostOf } from "../../testHelpers";

const week = Constants.week;
const ten_to_the_19 = Constants.ten_to_the_19;
const ZERO_ADDRESS = Constants.ZERO_ADDRESS;

describe("FeePoolV2", () => {
  let alice, bob, charlie: SignerWithAddress;

  let feePool: FeePoolV2;
  let veYMT: VeYMT;
  let YMT: YMT;
  let snapshot: SnapshotRestorer;

  before(async function () {
    [alice, bob, charlie] = await ethers.getSigners();

    YMT = await (<YMT__factory>await ethers.getContractFactory("YMT")).deploy();

    veYMT = await (<VeYMT__factory>(
      await ethers.getContractFactory("veYMT")
    )).deploy(YMT.address);

    feePool = await getProxy<FeePoolV2, FeePoolV2__factory>(
      contractVersion["FeePool"],
      [await time.latest()]
    );
    await feePool.setVeYMT(veYMT.address);
    const amount = ethers.utils.parseEther("1000");
    for (let acct of [alice, bob, charlie]) {
      await YMT.connect(acct).approve(veYMT.address, amount.mul(10));
      await YMT.connect(alice).transfer(acct.address, amount);
      await veYMT
        .connect(acct)
        .createLock(amount, (await time.latest()) + 8 * week);
    }
    await time.increase(week);
    await alice.sendTransaction({
      to: feePool.address,
      value: ten_to_the_19,
    });
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  describe("test_claim_many", () => {
    it("should correctly claim for multiple accounts", async function () {
      // 複数アカウントからclaimを行うテスト
      await feePool.checkpointToken();
      await time.increase(week);
      await feePool.checkpointToken();

      const snapshot = await takeSnapshot();

      const tx1 = await feePool
        .connect(alice)
        .claimMany(
          [alice.address, bob.address, charlie.address].concat(
            Array(17).fill(ZERO_ADDRESS)
          )
        );
      let balances = [
        (await ethers.provider.getBalance(alice.address)).add(await gasCostOf(tx1)),
        await ethers.provider.getBalance(bob.address),
        await ethers.provider.getBalance(charlie.address),
      ];

      await snapshot.restore();

      const gas = [];
      for (let acct of [alice, bob, charlie]) {
        const tx2 = await feePool.connect(acct)["claim()"]();
        gas.push(await gasCostOf(tx2))
      }

      expect((await ethers.provider.getBalance(alice.address)).add(gas[0])).to.be.eq(balances[0]);
      expect((await ethers.provider.getBalance(bob.address)).add(gas[1])).to.be.eq(balances[1]);
      expect((await ethers.provider.getBalance(charlie.address)).add(gas[2])).to.be.eq(balances[2]);

    });

    it("should correctly claim multiple times for the same account", async function () {
      // 同じアカウントから複数回のclaimを行うテスト
      await feePool.checkpointToken();
      await time.increase(week);
      await feePool.checkpointToken();

      const expected = await feePool.connect(alice).callStatic["claim()"]();

      expect(expected).to.above(0);

      const balanceBefore = await ethers.provider.getBalance(alice.address);
      const tx3 = await feePool.connect(alice).claimMany(Array(20).fill(alice.address));

      const balanceAfter = await ethers.provider.getBalance(alice.address);
      const gas = await gasCostOf(tx3);
      expect(balanceAfter.sub(balanceBefore).add(gas)).to.be.eq(expected);
    });
  });
});
