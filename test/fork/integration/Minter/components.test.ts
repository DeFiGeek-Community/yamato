import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Contract } from "ethers";
import {
  time,
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

const ACCOUNT_NUM = 4;
const NUMBER_OF_ATTEMPTS = 30;
const SCALE = BigNumber.from((1e20).toString());
const WEEK = 86400 * 7;
const MONTH = 86400 * 30;

describe("Minter components", function () {
  let accounts: SignerWithAddress[];
  let gaugeController: Contract;
  let liquidityGauge: Contract;
  let mockLpToken: Contract;
  let minter: Contract;
  let token: Contract;
  let votingEscrow: Contract;
  let snapshot: SnapshotRestorer;

  beforeEach(async function () {
    snapshot = await takeSnapshot();
    accounts = await ethers.getSigners();
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

    liquidityGauge = await LiquidityGauge.deploy(
      mockLpToken.address,
      minter.address
    );
    await liquidityGauge.deployed();

    await token.setMinter(minter.address);
    await gaugeController.addType("Liquidity", ethers.utils.parseEther("1"));
    await gaugeController.addGauge(
      liquidityGauge.address,
      0,
      ethers.utils.parseEther("10")
    );

    for (let i = 0; i < ACCOUNT_NUM; i++) {
      await mockLpToken
        .connect(accounts[0])
        .transfer(accounts[i].address, ethers.utils.parseEther("1"));
      await mockLpToken
        .connect(accounts[i])
        .approve(liquidityGauge.address, ethers.utils.parseEther("1"));
    }
  });

  afterEach(async () => {
    await snapshot.restore();
  });

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

  function approx(value: BigNumber, target: BigNumber, tol: BigNumber) {
    if (value.isZero() && target.isZero()) {
      return true;
    }

    const diff = value.sub(target).abs();
    const sum = value.add(target);
    const ratio = diff.mul(2).mul(BigNumber.from(SCALE)).div(sum);

    // console.log(
    //   `Value: ${value.toString()}, Target: ${target.toString()}, Tol: ${tol.toString()}`
    // );
    // console.log(
    //   `Diff: ${diff.toString()}, Sum: ${sum.toString()}, Ratio: ${ratio.toString()}`
    // );

    return ratio.lte(tol);
  }

  async function showGaugeInfo() {
    console.log("Gauge info----");
    console.log(
      "GaugeWeight: ",
      (await gaugeController.getGaugeWeight(liquidityGauge.address)).toString()
    );
    console.log(
      "TypeWeight: ",
      (await gaugeController.getTypeWeight(0)).toString()
    );
    console.log(
      "TotalWeight: ",
      (await gaugeController.getTotalWeight()).toString()
    );
    console.log(
      "TypeWeightSum: ",
      (await gaugeController.getWeightsSumPerType(0)).toString()
    );
    console.log("TimeTotal: ", (await gaugeController.timeTotal()).toString());
    console.log(
      "pointsTotal: ",
      (
        await gaugeController.pointsTotal(
          (await gaugeController.timeTotal()).toString()
        )
      ).toString()
    );
    console.log(
      "gaugeRelativeWeight: ",
      (
        await gaugeController.gaugeRelativeWeight(
          liquidityGauge.address,
          await time.latest()
        )
      ).toString()
    );
    console.log(
      "TotalSupply: ",
      (await liquidityGauge.totalSupply()).toString()
    );
    console.log("----");
  }

  for (let i = 0; i < NUMBER_OF_ATTEMPTS; i++) {
    it(`tests duration ${i}`, async function () {
      const stDuration = generateUniqueRandomNumbers(3, WEEK, MONTH);
      const depositTime: number[] = [];

      await time.increase(WEEK);

      for (let i = 0; i < 3; i++) {
        await liquidityGauge
          .connect(accounts[i + 1])
          .deposit(
            ethers.utils.parseEther("1"),
            accounts[i + 1].address,
            false
          );
        depositTime.push(await time.latest());

        //   await showGaugeInfo();
      }

      const durations: number[] = [];
      const balances: BigNumber[] = [];
      for (let i = 0; i < 3; i++) {
        await time.increase(stDuration[i]);
        await liquidityGauge
          .connect(accounts[i + 1])
          .withdraw(ethers.utils.parseEther("1"), false);

        const duration = (await time.latest()) - depositTime[i];
        durations.push(duration);
        await minter.connect(accounts[i + 1]).mint(liquidityGauge.address);
        const balance = await token.balanceOf(accounts[i + 1].address);
        balances.push(balance);

        //   await showGaugeInfo();
      }

      const totalMinted: BigNumber = balances.reduce(
        (a: BigNumber, b: BigNumber) => a.add(b),
        ethers.BigNumber.from(0)
      );
      const weight1 = Math.floor(durations[0]);
      const weight2 = Math.floor(weight1 + (durations[1] - durations[0]) * 1.5);
      const weight3 = Math.floor(weight2 + (durations[2] - durations[1]) * 3);
      const totalWeight = weight1 + weight2 + weight3;

      console.log(
        `Total minted: ${totalMinted.toString()}, Total Weight: ${totalWeight.toString()}`
      );
      console.log(
        `Balance 1: ${balances[0]} (${balances[0]
          .mul(SCALE)
          .div(totalMinted)}) Weight 1: ${weight1.toString()} (${
          (100 * weight1) / totalWeight
        }%)`
      );
      console.log(
        `Balance 2: ${balances[1]} (${balances[1]
          .mul(SCALE)
          .div(totalMinted)}) Weight 2: ${weight2.toString()} (${
          (100 * weight2) / totalWeight
        }%)`
      );
      console.log(
        `Balance 3: ${balances[2]} (${balances[2]
          .mul(SCALE)
          .div(totalMinted)}) Weight 3: ${weight3.toString()} (${
          (100 * weight3) / totalWeight
        }%)`
      );

      expect(
        approx(
          balances[0].mul(SCALE).div(totalMinted),
          BigNumber.from(weight1).mul(SCALE).div(totalWeight),
          BigNumber.from(10).pow(16) // = (10 ** -4) * SCALE
        )
      ).to.be.true;
      expect(
        approx(
          balances[1].mul(SCALE).div(totalMinted),
          BigNumber.from(weight2).mul(SCALE).div(totalWeight),
          BigNumber.from(10).pow(16) // = (10 ** -4) * SCALE
        )
      ).to.be.true;
      expect(
        approx(
          balances[2].mul(SCALE).div(totalMinted),
          BigNumber.from(weight3).mul(SCALE).div(totalWeight),
          BigNumber.from(10).pow(16) // = (10 ** -4) * SCALE
        )
      ).to.be.true;
    });
  }

  for (let i = 0; i < NUMBER_OF_ATTEMPTS; i++) {
    it(`tests amounts ${i}`, async function () {
      const stAmounts = generateUniqueRandomNumbers(3, 1e17, 1e18);
      const depositTime: number[] = [];

      for (let i = 0; i < 3; i++) {
        await liquidityGauge
          .connect(accounts[i + 1])
          .deposit(stAmounts[i].toString(), accounts[i + 1].address, false);
        depositTime.push(await time.latest());
      }

      await time.increase(MONTH);

      const balances: BigNumber[] = [];
      for (let i = 0; i < 3; i++) {
        liquidityGauge
          .connect(accounts[i + 1])
          .withdraw(stAmounts[i].toString(), false);
      }

      for (let i = 0; i < 3; i++) {
        await minter.connect(accounts[i + 1]).mint(liquidityGauge.address);
        balances.push(await token.balanceOf(accounts[i + 1].address));
      }
      const totalDeposited: number = stAmounts.reduce(
        (a: number, b: number) => a + b,
        0
      );
      const totalMinted: BigNumber = balances.reduce(
        (a: BigNumber, b: BigNumber) => a.add(b),
        ethers.BigNumber.from(0)
      );

      console.log(
        `Total deposited: ${totalDeposited.toString()}, Total minted: ${totalMinted.toString()}`
      );
      console.log(
        `Balance 1: ${balances[0]} (${balances[0]
          .mul(SCALE)
          .div(totalMinted)}) Deposited 1: ${stAmounts[0].toString()} (${
          (100 * stAmounts[0]) / totalDeposited
        }%)`
      );
      console.log(
        `Balance 2: ${balances[1]} (${balances[1]
          .mul(SCALE)
          .div(totalMinted)}) Deposited 2: ${stAmounts[1].toString()} (${
          (100 * stAmounts[1]) / totalDeposited
        }%)`
      );
      console.log(
        `Balance 3: ${balances[2]} (${balances[2]
          .mul(SCALE)
          .div(totalMinted)}) Deposited 3: ${stAmounts[2].toString()} (${
          (100 * stAmounts[2]) / totalDeposited
        }%)`
      );

      expect(
        approx(
          balances[0].mul(SCALE).div(totalMinted),
          BigNumber.from(stAmounts[0].toString())
            .mul(SCALE)
            .div(totalDeposited.toString()),
          BigNumber.from(10).pow(16) // = (10 ** -4) * SCALE
        )
      ).to.be.true;
      expect(
        approx(
          balances[1].mul(SCALE).div(totalMinted),
          BigNumber.from(stAmounts[1].toString())
            .mul(SCALE)
            .div(totalDeposited.toString()),
          BigNumber.from(10).pow(16) // = (10 ** -4) * SCALE
        )
      ).to.be.true;
      expect(
        approx(
          balances[2].mul(SCALE).div(totalMinted),
          BigNumber.from(stAmounts[2].toString())
            .mul(SCALE)
            .div(totalDeposited.toString()),
          BigNumber.from(10).pow(16) // = (10 ** -4) * SCALE
        )
      ).to.be.true;
    });
  }
});
