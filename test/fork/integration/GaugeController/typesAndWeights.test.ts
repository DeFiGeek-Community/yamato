import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Contract } from "ethers";
import {
  time,
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

// 参考) brownie Stateful Tests
// https://eth-brownie.readthedocs.io/en/stable/tests-hypothesis-stateful.html

type GaugeInfo = {
  contract: Contract;
  type: number;
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
//     Gauge type, multiplied by `len(self.gauges)` to choose a value
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
function getRandomType(): number {
  // Corresponds strategy("decimal", min_value=0, max_value="0.99999999")
  return randomValue(0, 99999999) / 100000000;
}
function getRandomWeight(): BigNumber {
  // Corresponds strategy("uint", min_value=10 ** 17, max_value=10 ** 19)
  return randomBigValue(10 ** 17, 10 ** 19);
}
// ------------------------------------------------

describe("GaugeController", function () {
  let accounts: SignerWithAddress[];
  let votingEscrow: Contract;
  let gaugeController: Contract;
  let mockLpToken: Contract;
  let token: Contract;
  let minter: Contract;

  let typeWeights: BigNumber[] = [];
  let gauges: GaugeInfo[] = [];

  let snapshot: SnapshotRestorer;

  beforeEach(async () => {
    snapshot = await takeSnapshot();
    accounts = (await ethers.getSigners()).slice(0, ACCOUNT_NUM);

    const MockLpToken = await ethers.getContractFactory("TestLP");
    const Token = await ethers.getContractFactory("CRV");
    const Minter = await ethers.getContractFactory("Minter");
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

    typeWeights = [];
    gauges = [];
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  //--------------------------------------------- helper functions -----------------------------------------------------------//

  function _gaugeWeight(idx: number): BigNumber {
    return gauges.reduce((sum, gauge) => {
      return gauge.type === idx ? sum.add(gauge.weight) : sum;
    }, BigNumber.from("0"));
  }

  //--------------------------------------------- Initializer functions -----------------------------------------------------------//
  async function initializeAddType() {
    await ruleAddType();

    // Check
    await checkInvariants();
  }
  //--------------------------------------------- randomly exceuted functions -----------------------------------------------------------//
  async function ruleAddType(stTypeWeight?: BigNumber) {
    /*
    Add a new gauge type.
    */
    stTypeWeight = stTypeWeight || getRandomWeight();
    await gaugeController.connect(accounts[0]).addType("Type!", stTypeWeight);
    typeWeights.push(stTypeWeight);

    console.log(`ruleAddType --- stTypeWeight: ${stTypeWeight.toString()}`);

    // Check
    await checkInvariants();
  }

  async function ruleAddGauge(gaugeType?: number, stGaugeWeight?: BigNumber) {
    /*
    Add a new gauge.

    If no types have been added, this rule has not effect.
    */
    const stType = getRandomType();
    stGaugeWeight = stGaugeWeight || getRandomWeight();

    if (typeWeights.length === 0) return;

    gaugeType = gaugeType || Math.floor(stType * typeWeights.length);
    console.log(
      `ruleAddGauge --- gaugeType: ${gaugeType}, stGaugeWeight: ${stGaugeWeight.toString()}`
    );
    const LiquidityGauge = await ethers.getContractFactory("LiquidityGaugeV6");
    const gauge = await LiquidityGauge.deploy(
      mockLpToken.address,
      minter.address
    );
    await gauge.deployed();

    await gaugeController
      .connect(accounts[0])
      .addGauge(gauge.address, gaugeType, stGaugeWeight);

    gauges.push({ contract: gauge, type: gaugeType, weight: stGaugeWeight });

    // Check
    await checkInvariants();
  }

  async function checkInvariants() {
    await invariantGaugeWeightSums();
    await invariantTotalTypeWeight();
    await invariantRelativeGaugeWeight();
  }

  async function invariantGaugeWeightSums() {
    // Validate the gauge weight sums per type.
    for (let i = 0; i < typeWeights.length; i++) {
      const gaugeWeightSum = _gaugeWeight(i);
      expect(await gaugeController.getWeightsSumPerType(i)).to.be.eq(
        gaugeWeightSum
      );
    }
  }

  async function invariantTotalTypeWeight() {
    // Validate the total weight.
    const totalWeight = typeWeights.reduce((total, weight, idx) => {
      return total.add(_gaugeWeight(idx).mul(weight));
    }, BigNumber.from("0"));

    expect(await gaugeController.getTotalWeight()).to.be.eq(totalWeight);
  }

  async function invariantRelativeGaugeWeight() {
    // Validate the relative gauge weights.
    await ethers.provider.send("evm_increaseTime", [WEEK]);

    const totalWeight = typeWeights.reduce((total, weight, idx) => {
      return total.add(_gaugeWeight(idx).mul(weight));
    }, BigNumber.from("0"));

    for (let i = 0; i < gauges.length; i++) {
      await gaugeController
        .connect(accounts[0])
        .checkpointGauge(gauges[i].contract.address);
      const expected = BigNumber.from("10")
        .pow(18)
        .mul(typeWeights[gauges[i].type])
        .mul(gauges[i].weight)
        .div(totalWeight);
      expect(
        await gaugeController.gaugeRelativeWeight(
          gauges[i].contract.address,
          await time.latest()
        )
      ).to.be.eq(expected);
    }
  }

  async function showStates() {
    console.log("States ------------------------");
    console.log("typeWeights.length: ", typeWeights.length);
    console.log("gauges.length: ", gauges.length);
    for (let i = 0; i < typeWeights.length; i++) {
      console.log(
        `getWeightsSumPerType(${i}): ${(
          await gaugeController.getWeightsSumPerType(i)
        ).toString()}`
      );
    }
    const totalWeight = typeWeights.reduce((total, weight, idx) => {
      return total.add(_gaugeWeight(idx).mul(weight));
    }, BigNumber.from("0"));
    console.log(`totalWeight: ${totalWeight.toString()}`);

    for (let i = 0; i < gauges.length; i++) {
      console.log(
        `gaugeRelativeWeight(${gauges[i].contract.address}): ${(
          await gaugeController.gaugeRelativeWeight(
            gauges[i].contract.address,
            await time.latest()
          )
        ).toString()}`
      );
    }
    console.log("------------------------");
  }

  let func = ["ruleAddType", "ruleAddGauge"];

  describe("gauge weights and gauge weight sum", function () {
    for (let i = 0; i < MAX_EXAMPLES; i++) {
      it(`tests gauge weights and gauge weight sum ${i}`, async () => {
        await initializeAddType();

        const steps = randomValue(1, STATEFUL_STEP_COUNT);
        for (let x = 0; x < steps; x++) {
          let n = randomValue(0, func.length);
          await eval(func[n])();
        }

        // await showStates();
      });
    }
  });
});
