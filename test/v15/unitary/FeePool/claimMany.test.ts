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
import Constants from "../../Constants";

const week = Constants.week;

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
      value: ethers.utils.parseEther("10"),
    });
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

  describe("test_claim_many", () => {
    it("test_claim_many", async function () {
      await feePool.checkpointToken();
      await time.increase(week);
      await feePool.checkpointToken();

      const snapshot = await takeSnapshot();

      const tx1 = await feePool
        .connect(alice)
        .claimMany(
          [alice.address, bob.address, charlie.address].concat(
            Array(17).fill(ethers.constants.AddressZero)
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
    it("test_claim_many_same_account", async function () {
      await feePool.checkpointToken();
      await time.increase(week);
      await feePool.checkpointToken();

      const expected = await feePool.connect(alice).callStatic["claim()"]();

      expect(expected).to.above(0);

      const balanceBefore = await ethers.provider.getBalance(alice.address);
      const tx = await feePool.connect(alice).claimMany(Array(20).fill(alice.address));

      const balanceAfter = await ethers.provider.getBalance(alice.address);
      const gas = await gasCostOf(tx);
      expect(balanceAfter.sub(balanceBefore).add(gas)).to.be.eq(expected);
    });
  });
});
