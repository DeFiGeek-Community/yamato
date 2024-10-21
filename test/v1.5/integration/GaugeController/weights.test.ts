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

// 参考) brownie Stateful Tests
// https://eth-brownie.readthedocs.io/en/stable/tests-hypothesis-stateful.html

type GaugeInfo = {
  contract: FakeContract<ScoreRegistry>;
  weight: BigNumber;
};
const ACCOUNT_NUM = 5;
const MAX_EXAMPLES = 50;
const STATEFUL_STEP_COUNT = 10;
const WEEK = 86400 * 7;

// Validate gauge weights and gauge weight sum.

// Strategies
// ----------
// st_type : Decimal
//     Gauge type, multiplied by `len(self.scores)` to choose a value
// st_gauge_weight : int
//     Gauge weight
// st_type_wiehgt : int
//     Type weight

// Helper functions to generate random variables ----->
function randomBigValue(min: number, max: number): BigNumber {
  return BigNumber.from(
    Math.floor(Math.random() * (max - min) + min).toString()
  );
}
function randomValue(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min) + min);
}
function getRandomWeight(): BigNumber {
  // Corresponds strategy("uint", min_value=10 ** 17, max_value=10 ** 19)
  return randomBigValue(10 ** 17, 10 ** 19);
}
// ------------------------------------------------

describe("scoreWeightController", function () {
  let accounts: SignerWithAddress[];
  let veYMT: VeYMT;
  let YMT: YMT;
  let YmtVesting: YmtVesting;
  let scoreWeightController: ScoreWeightControllerV2;

  let scores: GaugeInfo[] = [];

  let snapshot: SnapshotRestorer;

  before(async () => {
    accounts = (await ethers.getSigners()).slice(0, ACCOUNT_NUM);

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
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
    scores = [];
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  //--------------------------------------------- helper functions -----------------------------------------------------------//

  function _gaugeWeight(): BigNumber {
    return scores.reduce((sum, gauge) => {
      return sum.add(gauge.weight);
    }, BigNumber.from("0"));
  }

  //--------------------------------------------- randomly exceuted functions -----------------------------------------------------------//

  async function ruleAddScore(stGaugeWeight?: BigNumber) {
    /*
    Add a new gauge.

    If no types have been added, this rule has not effect.
    */
    stGaugeWeight = stGaugeWeight || getRandomWeight();

    const gauge = await getFakeProxy<ScoreRegistry>(
      contractVersion["ScoreRegistry"]
    );

    await scoreWeightController
      .connect(accounts[0])
      .addScore(gauge.address, stGaugeWeight);

    scores.push({ contract: gauge, weight: stGaugeWeight });

    // Check
    await checkInvariants();
  }

  async function checkInvariants() {
    await invariantGaugeWeightSums();
    await invariantRelativeGaugeWeight();
  }

  async function invariantGaugeWeightSums() {
    // Validate the gauge weight sums per type.
    const gaugeWeightSum = _gaugeWeight();
    expect(await scoreWeightController.getTotalWeight()).to.be.eq(
      gaugeWeightSum
    );
  }

  async function invariantRelativeGaugeWeight() {
    // Validate the relative gauge weights.
    await ethers.provider.send("evm_increaseTime", [WEEK]);

    const totalWeight = _gaugeWeight();

    for (let i = 0; i < scores.length; i++) {
      await scoreWeightController
        .connect(accounts[0])
        .checkpointScore(scores[i].contract.address);
      const expected = BigNumber.from("10")
        .pow(18)
        .mul(scores[i].weight)
        .div(totalWeight);
      expect(
        await scoreWeightController.scoreRelativeWeight(
          scores[i].contract.address,
          await time.latest()
        )
      ).to.be.eq(expected);
    }
  }

  let func = ["ruleAddScore"];

  describe("gauge weights and gauge weight sum", function () {
    for (let i = 0; i < MAX_EXAMPLES; i++) {
      it(`tests gauge weights and gauge weight sum ${i}`, async () => {
        const steps = randomValue(1, STATEFUL_STEP_COUNT);
        for (let x = 0; x < steps; x++) {
          let n = randomValue(0, func.length);
          await eval(func[n])();
        }
      });
    }
  });
});
