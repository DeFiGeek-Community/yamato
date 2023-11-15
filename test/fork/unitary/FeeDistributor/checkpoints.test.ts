import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import {
  time,
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

const DAY = 86400;
const WEEK = DAY * 7;
const YEAR = DAY * 365;

describe("FeeDistributor", () => {
  let alice: SignerWithAddress,
    bob: SignerWithAddress,
    charlie: SignerWithAddress;

  let distributor: Contract;
  let votingEscrow: Contract;
  let token: Contract;
  let coinA: Contract;
  let snapshot: SnapshotRestorer;

  beforeEach(async function () {
    snapshot = await takeSnapshot();
    [alice, bob, charlie] = await ethers.getSigners();

    const Distributor = await ethers.getContractFactory("FeeDistributor");
    const CRV = await ethers.getContractFactory("CRV");
    const Token = await ethers.getContractFactory("MockToken");
    const VotingEscrow = await ethers.getContractFactory("VotingEscrow");

    token = await CRV.deploy();
    await token.deployed();

    coinA = await Token.deploy("Coin A", "USDA", 18);
    await coinA.deployed();

    votingEscrow = await VotingEscrow.deploy(
      token.address,
      "Voting-escrowed token",
      "vetoken",
      "v1"
    );
    await votingEscrow.deployed();

    distributor = await Distributor.deploy(
      votingEscrow.address,
      await time.latest(),
      coinA.address,
      alice.address,
      alice.address
    );
    await distributor.deployed();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  // TODO
  // 下記の観点のテストを追加
  // https://discord.com/channels/729808684359876718/729812922649542758/1162241240360816730

  describe("test_checkpoints", () => {
    beforeEach(async function () {
      await token.approve(votingEscrow.address, ethers.constants.MaxUint256);
      await votingEscrow.createLock(
        ethers.utils.parseEther("1000"),
        (await time.latest()) + WEEK * 52
      );
    });
    it("test_checkpoint_total_supply", async function () {
      const startTime = await distributor.timeCursor();
      const weekEpoch =
        Math.floor(((await time.latest()) + WEEK) / WEEK) * WEEK;

      await time.increaseTo(weekEpoch);

      const weekBlock = await time.latestBlock();

      await distributor.checkpointTotalSupply();

      expect(await distributor.veSupply(startTime)).to.equal(0);
      expect(await distributor.veSupply(weekEpoch)).to.equal(
        await votingEscrow.totalSupplyAt(weekBlock)
      );
    });

    it("test_advance_time_cursor", async function () {
      const startTime = (await distributor.timeCursor()).toNumber();
      await time.increase(YEAR);
      await distributor.checkpointTotalSupply();
      const newTimeCursor = (await distributor.timeCursor()).toNumber();
      expect(newTimeCursor).to.equal(startTime + WEEK * 20);
      expect(await distributor.veSupply(startTime + WEEK * 19)).to.be.above(0);
      expect(await distributor.veSupply(startTime + WEEK * 20)).to.equal(0);

      await distributor.checkpointTotalSupply();

      expect(await distributor.timeCursor()).to.equal(startTime + WEEK * 40);
      expect(await distributor.veSupply(startTime + WEEK * 20)).to.be.above(0);
      expect(await distributor.veSupply(startTime + WEEK * 39)).to.be.above(0);
      expect(await distributor.veSupply(startTime + WEEK * 40)).to.equal(0);
    });

    it("test_claim_checkpoints_total_supply", async function () {
      const start_time = (await distributor.timeCursor()).toNumber();

      await distributor.connect(alice)["claim()"]();

      expect((await distributor.timeCursor()).toNumber()).to.equal(
        start_time + WEEK
      );
    });

    it("test_toggle_allow_checkpoint", async function () {
      const lastTokenTime = (await distributor.lastTokenTime()).toNumber();

      await time.increase(WEEK);

      await distributor.connect(alice)["claim()"]();
      expect((await distributor.lastTokenTime()).toNumber()).to.equal(
        lastTokenTime
      );

      await distributor.toggleAllowCheckpointToken();
      const tx = await distributor.connect(alice)["claim()"]();
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      expect((await distributor.lastTokenTime()).toNumber()).to.equal(
        block.timestamp
      );
    });
  });
});
