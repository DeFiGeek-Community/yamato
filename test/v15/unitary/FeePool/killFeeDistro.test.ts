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
  FeePoolV2,
  FeePoolV2__factory,
  YMT,
  YMT__factory,
  VeYMT,
  VeYMT__factory,
} from "../../../../typechain";
import { getProxy } from "../../../../src/testUtil";
import { contractVersion } from "../../../param/version";
import { gasCostOf } from "../../testHelpers";

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
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  describe("test_kill_fee_distro", () => {
    let accounts: SignerWithAddress[];
    beforeEach(async () => {
      accounts = await ethers.getSigners();
    });

    it("test_assumptions", async function () {
      expect(await feePool.isKilled()).to.be.false;
      expect(await feePool.governance()).to.equal(alice.address);
    });

    it("test_kill", async function () {
      await feePool.connect(alice).killMe();
      expect(await feePool.isKilled()).to.be.true;
    });

    it("test_multi_kill", async function () {
      await feePool.connect(alice).killMe();
      await feePool.connect(alice).killMe();
      expect(await feePool.isKilled()).to.be.true;
    });

    it("test_killing_transfers_tokens", async function () {
      await alice.sendTransaction({
        to: feePool.address,
        value: 31337,
      });

      let balance = await ethers.provider.getBalance(alice.address);
      const tx = await feePool.connect(alice).killMe();
      balance = balance.sub(await gasCostOf(tx));

      expect(await feePool.governance()).to.equal(alice.address);
      expect(await ethers.provider.getBalance(alice.address)).to.equal(balance.add(31337));
    });

    it("test_multi_kill_token_transfer", async function () {
      await bob.sendTransaction({
        to: feePool.address,
        value: 10000,
      });
      let balance = await ethers.provider.getBalance(alice.address);

      const tx1 = await feePool.connect(alice).killMe();
      balance = balance.sub(await gasCostOf(tx1));

      await bob.sendTransaction({
        to: feePool.address,
        value: 30000,
      });

      const tx2 = await feePool.connect(alice).killMe();
      balance = balance.sub(await gasCostOf(tx2));

      expect(await feePool.governance()).to.equal(alice.address);
      expect(await ethers.provider.getBalance(alice.address)).to.equal(balance.add(40000));
    });

    for (let idx = 1; idx <= 2; idx++) {
      it(`test_only_admin_for_account_index_${idx}`, async function () {
        await expect(feePool.connect(accounts[idx]).killMe()).to.be.reverted;
      });

      it(`test_cannot_claim_after_killed_for_account_index_${idx}`, async function () {
        await feePool.connect(alice).killMe();
        await expect(feePool.connect(accounts[idx])["claim()"]()).to.be
          .reverted;
      });

      it(`test_cannot_claim_for_after_killed_for_account_index_${idx}`, async function () {
        await feePool.connect(alice).killMe();
        await expect(
          feePool.connect(accounts[idx])["claim(address)"](alice.address)
        ).to.be.reverted;
      });

      it(`test_cannot_claim_many_after_killed_for_account_index_${idx}`, async function () {
        await feePool.connect(alice).killMe();
        await expect(
          feePool
            .connect(accounts[idx])
            .claimMany(new Array(20).fill(alice.address))
        ).to.be.reverted;
      });
    }
  });
});
