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

  describe("test_fee_distribution", () => {
    it("test_deposited_after", async function () {
      const amount = ethers.utils.parseEther("1000");
      await token.connect(alice).approve(votingEscrow.address, amount.mul(10));
      await coinA._mintForTesting(bob.address, ethers.utils.parseEther("100"));

      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 7; j++) {
          await coinA
            .connect(bob)
            .transfer(distributor.address, ethers.utils.parseEther("1"));
          await distributor.checkpointToken();
          await distributor.checkpointTotalSupply();
          await time.increase(DAY);
        }
      }

      await time.increase(WEEK);
      await votingEscrow
        .connect(alice)
        .createLock(amount, (await time.latest()) + 3 * WEEK);
      await time.increase(2 * WEEK);

      await distributor.connect(alice)["claim()"]();

      const balanceBefore = await coinA.balanceOf(alice.address);
      await distributor.connect(alice)["claim()"]();
      const balanceAfter = await coinA.balanceOf(alice.address);
      expect(balanceAfter.sub(balanceBefore)).to.be.eq(0);
    });

    it("test_deposited_during", async function () {
      const amount = ethers.utils.parseEther("1000");
      await token.connect(alice).approve(votingEscrow.address, amount.mul(10));
      await coinA._mintForTesting(bob.address, ethers.utils.parseEther("100"));

      await time.increase(WEEK);
      await votingEscrow
        .connect(alice)
        .createLock(amount, (await time.latest()) + 8 * WEEK);
      await time.increase(WEEK);

      const Distributor = await ethers.getContractFactory("FeeDistributor");
      distributor = await Distributor.deploy(
        votingEscrow.address,
        await time.latest(),
        coinA.address,
        alice.address,
        alice.address
      );
      await distributor.deployed();

      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 7; j++) {
          await coinA
            .connect(bob)
            .transfer(distributor.address, ethers.utils.parseEther("1"));
          await distributor.checkpointToken();
          await distributor.checkpointTotalSupply();
          await time.increase(DAY);
        }
      }

      await time.increase(WEEK);
      await distributor.checkpointToken();
      await distributor.connect(alice)["claim()"]();

      const balanceAlice = await coinA.balanceOf(alice.address);
      const diff = Math.abs(
        balanceAlice.sub(ethers.utils.parseEther("21")).toNumber()
      );
      expect(diff).to.be.lessThan(10);
    });

    it("test_deposited_before", async function () {
      const [alice, bob] = await ethers.getSigners();
      const amount = ethers.utils.parseEther("1000");

      await token.connect(alice).approve(votingEscrow.address, amount.mul(10));
      await coinA
        .connect(bob)
        ._mintForTesting(bob.address, ethers.utils.parseEther("100"));

      await votingEscrow
        .connect(alice)
        .createLock(amount, (await time.latest()) + 8 * WEEK);
      await time.increase(WEEK);
      const startTime = await time.latest();
      await time.increase(WEEK * 5);

      const Distributor = await ethers.getContractFactory("FeeDistributor");
      distributor = await Distributor.deploy(
        votingEscrow.address,
        startTime,
        coinA.address,
        alice.address,
        alice.address
      );
      await distributor.deployed();

      await coinA
        .connect(bob)
        .transfer(distributor.address, ethers.utils.parseEther("10"));
      await distributor.checkpointToken();
      await time.increase(WEEK);
      await distributor.checkpointToken();
      await distributor.connect(alice)["claim()"]();

      const balanceAlice = await coinA.balanceOf(alice.address);
      expect(
        Math.abs(balanceAlice.sub(ethers.utils.parseEther("10")).toNumber())
      ).to.be.lessThan(10);
    });

    it("test_deposited_twice", async function () {
      const amount = ethers.utils.parseEther("1000");

      await token.approve(votingEscrow.address, amount.mul(10));
      await coinA._mintForTesting(bob.address, ethers.utils.parseEther("100"));

      const currentTimestamp = await time.latest();
      await votingEscrow.createLock(amount, currentTimestamp + 4 * WEEK);

      await time.increase(WEEK);

      const startTime = await time.latest();

      await time.increase(3 * WEEK);

      await votingEscrow.connect(alice).withdraw();
      const excludeTime = Math.floor((await time.latest()) / WEEK) * WEEK;
      await votingEscrow
        .connect(alice)
        .createLock(amount, (await time.latest()) + 4 * WEEK);

      await time.increase(2 * WEEK);

      const Distributor = await ethers.getContractFactory("FeeDistributor");
      distributor = await Distributor.deploy(
        votingEscrow.address,
        startTime,
        coinA.address,
        alice.address,
        alice.address
      );
      await distributor.deployed();

      await coinA
        .connect(bob)
        .transfer(distributor.address, ethers.utils.parseEther("10"));
      await distributor.checkpointToken();

      await time.increase(WEEK);

      await distributor.checkpointToken();

      await distributor.connect(alice)["claim()"]();

      const tokensToExclude = await distributor.tokensPerWeek(excludeTime);

      expect(
        ethers.utils
          .parseEther("10")
          .sub(await coinA.balanceOf(alice.address))
          .sub(tokensToExclude)
      ).to.be.lt(10);
    });

    it("test_deposited_parallel", async function () {
      const amount = ethers.utils.parseEther("1000");

      await token.connect(alice).approve(votingEscrow.address, amount.mul(10));
      await token.connect(bob).approve(votingEscrow.address, amount.mul(10));
      await token.connect(alice).transfer(bob.address, amount);
      await coinA._mintForTesting(
        charlie.address,
        ethers.utils.parseEther("100")
      );

      const currentTimestamp = await time.latest();
      await votingEscrow
        .connect(alice)
        .createLock(amount, currentTimestamp + 8 * WEEK);
      await votingEscrow
        .connect(bob)
        .createLock(amount, currentTimestamp + 8 * WEEK);

      await time.increase(WEEK);

      const startTime = await time.latest();

      await time.increase(5 * WEEK);

      const Distributor = await ethers.getContractFactory("FeeDistributor");
      distributor = await Distributor.deploy(
        votingEscrow.address,
        startTime,
        coinA.address,
        alice.address,
        alice.address
      );
      await distributor.deployed();

      await coinA
        .connect(charlie)
        .transfer(distributor.address, ethers.utils.parseEther("10"));
      await distributor.checkpointToken();

      await time.increase(WEEK);

      await distributor.checkpointToken();

      await distributor.connect(alice)["claim()"]();
      await distributor.connect(bob)["claim()"]();

      const balanceAlice = await coinA.balanceOf(alice.address);
      const balanceBob = await coinA.balanceOf(bob.address);

      expect(balanceAlice).to.equal(balanceBob);
      expect(balanceAlice.add(balanceBob)).to.be.closeTo(
        ethers.utils.parseEther("10"),
        20
      );
    });
  });
});
