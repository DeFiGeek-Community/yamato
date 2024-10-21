import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Contract } from "ethers";
import {
  time,
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { FakeContract } from "@defi-wonderland/smock";
import {
  YmtVesting,
  YMT,
  VeYMT,
  ScoreWeightControllerV2,
  ScoreRegistry,
  YmtVesting__factory,
  YMT__factory,
  VeYMT__factory,
  ScoreWeightControllerV2__factory,
} from "../../../../typechain";
import { upgradeProxy } from "../../../../src/upgradeUtil";
import { getFakeProxy, getProxy } from "../../../../src/testUtil";
import { contractVersion } from "../../../param/version";
import Constants from "../../Constants";

const MAX_EXAMPLES = 10;
const SCALE = 1e20;
const week = Constants.week;

type SlopeData = {
  initialBias: BigNumber;
  duration: number;
};

describe("scoreWeightController", function () {
  let accounts: SignerWithAddress[];
  let otherAccount: SignerWithAddress;
  let veYMT: VeYMT;
  let YMT: YMT;
  let YmtVesting: YmtVesting;
  let scoreRegistrys: FakeContract<ScoreRegistry>[];
  let scoreWeightController: ScoreWeightControllerV2;
  let snapshot: SnapshotRestorer;

  before(async function () {
    accounts = (await ethers.getSigners()).slice(0, 3);
    otherAccount = (await ethers.getSigners())[4];
    scoreRegistrys = [];

    for (let i = 0; i < 3; i++) {
      const mockScoreRegistryInstance = await getFakeProxy<ScoreRegistry>(
        contractVersion["ScoreRegistry"]
      );
      scoreRegistrys.push(mockScoreRegistryInstance);
    }
    YmtVesting = await (<YmtVesting__factory>(
      await ethers.getContractFactory("YmtVesting")
    )).deploy();

    YMT = await (<YMT__factory>await ethers.getContractFactory("YMT")).deploy(
      YmtVesting.address,
      accounts[0].address
    );
    veYMT = await (<VeYMT__factory>(
      await ethers.getContractFactory("veYMT")
    )).deploy(YMT.address);

    scoreWeightController = await getProxy<
      ScoreWeightControllerV2,
      ScoreWeightControllerV2__factory
    >("ScoreWeightController", [YMT.address, veYMT.address]);
    scoreWeightController = await upgradeProxy(
      scoreWeightController.address,
      "ScoreWeightControllerV2",
      undefined,
      {
        call: { fn: "initializeV2" },
      }
    );

    for (let i = 0; i < 3; i++) {
      await scoreWeightController.addScore(scoreRegistrys[i].address, 0);
    }

    for (let i = 0; i < 3; i++) {
      await YMT.connect(accounts[0]).transfer(
        accounts[i].address,
        ethers.utils.parseEther("100000")
      );
      await YMT.connect(accounts[i]).approve(
        veYMT.address,
        ethers.utils.parseEther("100000")
      );
    }
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
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
      let t1 = Math.floor((t0 + 2 * week) / week) * week - 10;
      //   console.log(`t0: ${t0}, t1: ${t1}`);
      await ethers.provider.send("evm_increaseTime", [t1 - t0]);
      // Deposit for voting
      let timestamp = t1;
      for (let i = 0; i < accounts.length; i++) {
        await veYMT
          .connect(accounts[i])
          .createLock(stDeposits[i], timestamp + stLength[i] * week);
      }

      let tx;
      let txReceipt;
      // Place votes
      let votes: number[][] = [];
      for (let i = 0; i < accounts.length; i++) {
        votes.push(stVotes[i].map((x) => x * 1000));
        votes[i].push(10000 - votes[i].reduce((a, b) => a + b, 0));
        for (let x = 0; x < accounts.length; x++) {
          tx = await scoreWeightController
            .connect(accounts[i])
            .voteForScoreWeights(scoreRegistrys[x].address, votes[i][x]);
        }
        txReceipt = await tx.wait();
      }
      // Vote power assertions - everyone used all voting power
      for (let i = 0; i < accounts.length; i++) {
        expect(
          await scoreWeightController.voteUserPower(accounts[i].address)
        ).to.equal(10000);
      }
      // Calculate slope data, build model functions
      let slopeData: SlopeData[] = [];
      for (let i = 0; i < accounts.length; i++) {
        const initialBias: BigNumber = (
          await veYMT.getLastUserSlope(accounts[i].address)
        ).mul((await veYMT.locked(accounts[i].address)).end.sub(timestamp));
        const duration =
          Math.floor((timestamp + stLength[i] * week) / week) * week -
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
      await time.increase(week * 4);
      let txTimestamp = (await ethers.provider.getBlock(txReceipt.blockNumber))
        .timestamp;
      while (txTimestamp < timestamp + 1.5 * maxDuration) {
        // console.log(
        //   "blockNumber txTimestamp: ",
        //   txReceipt.blockNumber,
        //   txTimestamp
        // );
        for (let i = 0; i < 3; i++) {
          tx = await scoreWeightController
            .connect(otherAccount)
            .checkpointScore(scoreRegistrys[i].address);
        }
        txReceipt = await tx.wait();
        txTimestamp = (await ethers.provider.getBlock(txReceipt.blockNumber))
          .timestamp;
        const relativeTime =
          Math.floor((txTimestamp / week) * week - timestamp) / maxDuration;
        // console.log(
        //   `Calculating relative time... txTimestamp: ${txTimestamp}, timestamp: ${timestamp}, maxDuration: ${maxDuration}`
        // );
        const weights: BigNumber[] = await Promise.all(
          scoreRegistrys.map(async (scoreRegistry, i) => {
            return await scoreWeightController.scoreRelativeWeight(
              scoreRegistry.address,
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
              .div(week)
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
        await time.increase(week * 4);
      }
    });
  }
});
