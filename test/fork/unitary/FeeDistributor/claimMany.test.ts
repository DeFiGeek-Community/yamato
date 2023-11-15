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
  let snapshot: SnapshotRestorer;
  let alice: SignerWithAddress,
    bob: SignerWithAddress,
    charlie: SignerWithAddress;

  let distributor: Contract;
  let votingEscrow: Contract;
  let token: Contract;
  let coinA: Contract;

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

  describe("test_claim_many", () => {
    const amount = ethers.utils.parseEther("1000");
    it("test_claim_many", async function () {
      for (let acct of [alice, bob, charlie]) {
        await token.connect(acct).approve(votingEscrow.address, amount.mul(10));
        await token.connect(alice).transfer(acct.address, amount);
        await votingEscrow
          .connect(acct)
          .createLock(amount, (await time.latest()) + 8 * WEEK);
      }
      await time.increase(WEEK);
      let startTime = await time.latest();
      await time.increase(WEEK * 5);
      const Distributor = await ethers.getContractFactory("FeeDistributor");
      distributor = await Distributor.deploy(
        votingEscrow.address,
        startTime,
        coinA.address,
        alice.address,
        alice.address
      );
      await coinA._mintForTesting(
        distributor.address,
        ethers.utils.parseEther("10")
      );
      await distributor.checkpointToken();
      await time.increase(WEEK);
      await distributor.checkpointToken();

      const snapshot = await takeSnapshot();

      await distributor
        .connect(alice)
        .claimMany(
          [alice.address, bob.address, charlie.address].concat(
            Array(17).fill(ethers.constants.AddressZero)
          )
        );
      let balances = [
        await coinA.balanceOf(alice.address),
        await coinA.balanceOf(bob.address),
        await coinA.balanceOf(charlie.address),
      ];

      await snapshot.restore();

      await distributor.connect(alice)["claim()"]();
      await distributor.connect(bob)["claim()"]();
      await distributor.connect(charlie)["claim()"]();
      expect(balances).to.deep.equal([
        await coinA.balanceOf(alice.address),
        await coinA.balanceOf(bob.address),
        await coinA.balanceOf(charlie.address),
      ]);
    });
    it("test_claim_many_same_account", async function () {
      for (let acct of [alice, bob, charlie]) {
        await token.connect(acct).approve(votingEscrow.address, amount.mul(10));
        await token.connect(alice).transfer(acct.address, amount);
        await votingEscrow
          .connect(acct)
          .createLock(amount, (await time.latest()) + 8 * WEEK);
      }
      await time.increase(WEEK);
      let startTime = await time.latest();
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

      await coinA._mintForTesting(
        distributor.address,
        ethers.utils.parseEther("10")
      );
      await distributor.checkpointToken();
      await time.increase(WEEK);
      await distributor.checkpointToken();

      const expected = await distributor.connect(alice).callStatic["claim()"]();

      expect(expected).to.above(0);

      const balanceBefore = await coinA.balanceOf(alice.address);
      await distributor.connect(alice).claimMany(Array(20).fill(alice.address));
      const balanceAfter = await coinA.balanceOf(alice.address);
      expect(balanceAfter.sub(balanceBefore)).to.be.eq(expected);
    });
  });
});
