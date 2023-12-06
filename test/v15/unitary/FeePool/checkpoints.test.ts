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
const year = Constants.year;

describe("FeePoolV2", () => {
  let alice, bob, charlie: SignerWithAddress;

  let feePool: Contract;
  let veYMT: Contract;
  let token: Contract;
  let snapshot: SnapshotRestorer;

  before(async function () {
    [alice, bob, charlie] = await ethers.getSigners();

    const YMT = await ethers.getContractFactory("YMT");
    const VeYMT = await ethers.getContractFactory("veYMT");

    token = await YMT.deploy();
    await token.deployed();

    veYMT = await VeYMT.deploy(token.address);
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

  // TODO
  // 下記の観点のテストを追加
  // https://discord.com/channels/729808684359876718/729812922649542758/1162241240360816730

  describe("test_checkpoints", () => {
    beforeEach(async function () {
      await token.approve(veYMT.address, ethers.constants.MaxUint256);
      await veYMT.createLock(
        ethers.utils.parseEther("1000"),
        (await time.latest()) + week * 52
      );
    });
    it("test_checkpoint_total_supply", async function () {
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

    it("test_advance_time_cursor", async function () {
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

    it("test_claim_checkpoints_total_supply", async function () {
      const start_time = (await feePool.timeCursor()).toNumber();

      await feePool.connect(alice)["claim()"]();

      expect((await feePool.timeCursor()).toNumber()).to.equal(
        start_time + week
      );
    });

    it("test_toggle_allow_checkpoint", async function () {
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
