import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Contract } from "ethers";
import {
  time,
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

const WEEK = 86400 * 7;
const MAX_EXAMPLES = 10;
const SCALE = 1e20;

type SlopeData = {
  initialBias: BigNumber;
  duration: number;
};

describe("GaugeController", function () {
  let accounts: SignerWithAddress[];
  let otherAccount: SignerWithAddress;
  let gaugeController: Contract;
  let threeGauges: Contract[3] = [];
  let mockLpToken: Contract;
  let minter: Contract;
  let token: Contract;
  let votingEscrow: Contract;
  let snapshot: SnapshotRestorer;

  beforeEach(async function () {
    snapshot = await takeSnapshot();
    accounts = (await ethers.getSigners()).slice(0, 3);
    otherAccount = (await ethers.getSigners())[4];

    const MockLpToken = await ethers.getContractFactory("TestLP");
    const Token = await ethers.getContractFactory("CRV");
    const Minter = await ethers.getContractFactory("Minter");
    const LiquidityGauge = await ethers.getContractFactory("LiquidityGaugeV6");
    const GaugeController = await ethers.getContractFactory("GaugeController");
    const VotingEscrow = await ethers.getContractFactory("VotingEscrow");

    token = await Token.deploy();
    await token.deployed();

    votingEscrow = await VotingEscrow.deploy(
      token.address,
      "Voting-escrowed token",
      "vetoken",
      "v1"
    );
    await votingEscrow.deployed();

    gaugeController = await GaugeController.deploy(
      token.address,
      votingEscrow.address
    );
    await gaugeController.deployed();

    minter = await Minter.deploy(token.address, gaugeController.address);
    await minter.deployed();

    mockLpToken = await MockLpToken.deploy(
      "Curve LP token",
      "usdCrv",
      18,
      ethers.utils.parseEther("10")
    );
    await mockLpToken.deployed();

    for (let i = 0; i < 3; i++) {
      threeGauges.push(
        await LiquidityGauge.deploy(mockLpToken.address, minter.address)
      );
    }

    await gaugeController.addType("Liquidity", ethers.utils.parseEther("1"));
    for (let i = 0; i < 3; i++) {
      await gaugeController.addGauge(threeGauges[i].address, 0, 0);
    }

    for (let i = 0; i < 3; i++) {
      await token
        .connect(accounts[0])
        .transfer(accounts[i].address, ethers.utils.parseEther("100000"));
      await token
        .connect(accounts[i])
        .approve(votingEscrow.address, ethers.utils.parseEther("100000"));
    }
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  // Helper functions to generate random variables ----->
  function randomBigValue(min: BigNumber, max: BigNumber): BigNumber {
    return BigNumber.from(ethers.utils.randomBytes(32))
      .mod(max.sub(min))
      .add(min);
  }
  function randomValue(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min) + min);
  }
  function getRandomDeposits(): BigNumber[] {
    // Corresponds strategy("uint256[3]", min_value=10 ** 21, max_value=10 ** 23)
    return [
      randomBigValue(
        ethers.utils.parseEther("1000"),
        ethers.utils.parseEther("100000")
      ),
      randomBigValue(
        ethers.utils.parseEther("1000"),
        ethers.utils.parseEther("100000")
      ),
      randomBigValue(
        ethers.utils.parseEther("1000"),
        ethers.utils.parseEther("100000")
      ),
    ];
  }
  function getRandomLength(): number[] {
    // Corresponds strategy("uint256[3]", min_value=52, max_value=100)
    return [randomValue(52, 100), randomValue(52, 100), randomValue(52, 100)];
  }
  function getRandomVotes(): number[][] {
    // Corresponds strategy("uint[2][3]", min_value=0, max_value=5)
    return [
      [randomValue(0, 5), randomValue(0, 5)],
      [randomValue(0, 5), randomValue(0, 5)],
      [randomValue(0, 5), randomValue(0, 5)],
    ];
  }
  // ------------------------------------------------

  function generateUniqueRandomNumbers(
    count: number,
    min: number,
    max: number
  ): number[] {
    const set = new Set<number>();
    while (set.size < count) {
      const randomValue = Math.floor(Math.random() * (max - min + 1)) + min;
      set.add(randomValue);
    }
    return Array.from(set);
  }

  for (let iteration = 0; iteration < MAX_EXAMPLES; iteration++) {
    it(`tests vote weight ${iteration}`, async function () {
      // Test that gauge weights correctly adjust over time.
      // Strategies
      // ---------
      // stDeposits : [int, int, int]
      //     Number of coins to be deposited per account
      // stLength : [int, int, int]
      //     Policy duration in weeks
      // stVotes : [(int, int), (int, int), (int, int)]
      //     (vote for gauge 0, vote for gauge 1) for each account, in units of 10%

      const stDeposits = getRandomDeposits();
      const stLength = getRandomLength();
      const stVotes = getRandomVotes();

      // Dammy fixed data for debug
      //   const stDeposits = [
      //     BigNumber.from("41798790756112223739711"),
      //     BigNumber.from("6086480295267465049249"),
      //     BigNumber.from("18446478515299272788115"),
      //   ];
      //   const stLength = [67, 75, 55];
      //   const stVotes = [
      //     [3, 2],
      //     [0, 2],
      //     [3, 1],
      //   ];
      // Init 10 s before the week change
      let t0 = await time.latest();
      let t1 = Math.floor((t0 + 2 * WEEK) / WEEK) * WEEK - 10;
      //   console.log(`t0: ${t0}, t1: ${t1}`);
      await ethers.provider.send("evm_increaseTime", [t1 - t0]);
      // Deposit for voting
      let timestamp = t1;
      for (let i = 0; i < accounts.length; i++) {
        await votingEscrow
          .connect(accounts[i])
          .createLock(stDeposits[i], timestamp + stLength[i] * WEEK);
      }

      let tx;
      let txReceipt;
      // Place votes
      let votes: number[][] = [];
      for (let i = 0; i < accounts.length; i++) {
        votes.push(stVotes[i].map((x) => x * 1000));
        votes[i].push(10000 - votes[i].reduce((a, b) => a + b, 0));
        for (let x = 0; x < accounts.length; x++) {
          tx = await gaugeController
            .connect(accounts[i])
            .voteForGaugeWeights(threeGauges[x].address, votes[i][x]);
        }
        txReceipt = await tx.wait();
      }
      // Vote power assertions - everyone used all voting power
      for (let i = 0; i < accounts.length; i++) {
        expect(
          await gaugeController.voteUserPower(accounts[i].address)
        ).to.equal(10000);
      }
      // Calculate slope data, build model functions
      let slopeData: SlopeData[] = [];
      for (let i = 0; i < accounts.length; i++) {
        const initialBias: BigNumber = (
          await votingEscrow.getLastUserSlope(accounts[i].address)
        ).mul(
          (await votingEscrow.locked(accounts[i].address)).end.sub(timestamp)
        );
        const duration =
          Math.floor((timestamp + stLength[i] * WEEK) / WEEK) * WEEK -
          timestamp;
        slopeData.push({ initialBias, duration });
      }
      const maxDuration = Math.max(
        ...slopeData.map(({ duration }) => duration)
      );
      const models = (idx: number, relativeTime: number) => {
        const { initialBias, duration } = slopeData[idx];
        // console.log(
        //   "model data: ",
        //   initialBias.toString(),
        //   duration,
        //   relativeTime
        // );
        const coef = 1 - (relativeTime * maxDuration) / duration;
        const relBias = initialBias
          .mul(BigNumber.from(Math.floor(coef * SCALE).toString()))
          .div(SCALE.toString());
        return relBias.lt(0) ? BigNumber.from("0") : relBias;
      };
      await time.increase(WEEK * 4);
      let txTimestamp = (await ethers.provider.getBlock(txReceipt.blockNumber))
        .timestamp;
      while (txTimestamp < timestamp + 1.5 * maxDuration) {
        // console.log(
        //   "blockNumber txTimestamp: ",
        //   txReceipt.blockNumber,
        //   txTimestamp
        // );
        for (let i = 0; i < 3; i++) {
          tx = await gaugeController
            .connect(otherAccount)
            .checkpointGauge(threeGauges[i].address);
        }
        txReceipt = await tx.wait();
        txTimestamp = (await ethers.provider.getBlock(txReceipt.blockNumber))
          .timestamp;
        const relativeTime =
          Math.floor((txTimestamp / WEEK) * WEEK - timestamp) / maxDuration;
        // console.log(
        //   `Calculating relative time... txTimestamp: ${txTimestamp}, timestamp: ${timestamp}, maxDuration: ${maxDuration}`
        // );
        const weights: BigNumber[] = await Promise.all(
          threeGauges.map(async (gauge, i) => {
            return await gaugeController.gaugeRelativeWeight(
              gauge.address,
              await time.latest()
            );
          })
        );
        let theoreticalWeights: BigNumber[] = [];
        if (relativeTime < 1) {
          //   console.log(
          //     `vote: [${votes[0]}], [${votes[1]}], [${votes[2]}], relativeTime: ${relativeTime}`
          //   );
          //   console.log(`models: ${models(0, relativeTime).toString()}`);
          theoreticalWeights = [
            votes.reduce(
              (sum, vote, i) =>
                sum.add(
                  BigNumber.from(vote[0].toString()).mul(
                    models(i, relativeTime)
                  )
                ),
              BigNumber.from(0)
            ),
            votes.reduce(
              (sum, vote, i) =>
                sum.add(
                  BigNumber.from(vote[1].toString()).mul(
                    models(i, relativeTime)
                  )
                ),
              BigNumber.from(0)
            ),
            votes.reduce(
              (sum, vote, i) =>
                sum.add(
                  BigNumber.from(vote[2].toString()).mul(
                    models(i, relativeTime)
                  )
                ),
              BigNumber.from(0)
            ),
          ];
          const totalTheoreticalWeight = theoreticalWeights.reduce(
            (sum, weight) => sum.add(weight),
            BigNumber.from(0)
          );
          theoreticalWeights = theoreticalWeights.map((w) =>
            w.isZero()
              ? w
              : w.mul(BigNumber.from(10).pow(18)).div(totalTheoreticalWeight)
          );
        } else {
          theoreticalWeights = [
            BigNumber.from(0),
            BigNumber.from(0),
            BigNumber.from(0),
          ];
        }
        if (relativeTime !== 1) {
          for (let i = 0; i < 3; i++) {
            const weightDiff = weights[i].sub(theoreticalWeights[i]).abs();
            const maxAllowedDiff = BigNumber.from(txTimestamp - timestamp)
              .div(WEEK)
              .add(1)
              .mul(BigNumber.from(10).pow(18)); // Adjust scale
            // console.log(
            //   "weightDiff & maxAllowedDiff: ",
            //   weightDiff.toString(),
            //   maxAllowedDiff.toString()
            // );
            expect(weightDiff.lte(maxAllowedDiff)).to.be.true;
          }
        }
        await time.increase(WEEK * 4);
      }
    });
  }
});
