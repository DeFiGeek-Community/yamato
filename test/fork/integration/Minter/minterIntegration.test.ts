import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Contract } from "ethers";
import {
  time,
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

const SCALE = BigNumber.from(10).pow(20);
const WEEK = 86400 * 7;
const MONTH = 86400 * 30;
const W = BigNumber.from(10).pow(18);

describe("Minter integration", function () {
  let admin, bob, charlie, dan: SignerWithAddress;
  let gaugeController: Contract;
  let threeGauges: Contract[3] = [];
  let mockLpToken: Contract;
  let minter: Contract;
  let token: Contract;
  let votingEscrow: Contract;
  let snapshot: SnapshotRestorer;

  beforeEach(async function () {
    snapshot = await takeSnapshot();
    [admin, bob, charlie, dan] = await ethers.getSigners();
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
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  function approx(value: BigNumber, target: BigNumber, tol: BigNumber) {
    if (value.isZero() && target.isZero()) {
      return true;
    }

    const diff = value.sub(target).abs();
    const sum = value.add(target);
    const ratio = diff.mul(2).mul(BigNumber.from(SCALE)).div(sum);

    console.log(
      `Value: ${value.toString()}, Target: ${target.toString()}, Tol: ${tol.toString()}`
    );
    console.log(
      `Diff: ${diff.toString()}, Sum: ${sum.toString()}, Ratio: ${ratio.toString()}`
    );

    return ratio.lte(tol);
  }

  it(`tests mint`, async function () {
    const amount = ethers.utils.parseEther("1");
    await token.connect(admin).setMinter(minter.address);

    const typeWeights = [W.div(2), W.mul(2)];
    const gaugeWeights = [W.mul(2), W.mul(1), W.div(2)];
    const gaugeTypes = [0, 0, 1];

    // Set up types
    for (let i = 0; i < typeWeights.length; i++) {
      await gaugeController.connect(admin).addType("Liquidity", 0);
      await gaugeController.connect(admin).changeTypeWeight(i, typeWeights[i]);
    }

    // Set up gauges
    for (let i = 0; i < threeGauges.length; i++) {
      await gaugeController
        .connect(admin)
        .addGauge(threeGauges[i].address, gaugeTypes[i], gaugeWeights[i]);
    }

    // Transfer tokens to Bob, Charlie and Dan
    await mockLpToken.transfer(bob.address, amount);
    await mockLpToken.transfer(charlie.address, amount);
    await mockLpToken.transfer(dan.address, amount);

    // For weights to activate
    await time.increase(WEEK);

    // Bob and Charlie deposit to gauges with different weights
    await mockLpToken.connect(bob).approve(threeGauges[1].address, amount);
    await threeGauges[1].connect(bob).deposit(amount, bob.address, false);
    await mockLpToken.connect(charlie).approve(threeGauges[2].address, amount);
    await threeGauges[2]
      .connect(charlie)
      .deposit(amount, charlie.address, false);

    await time.increase(MONTH);

    await mockLpToken.connect(dan).approve(threeGauges[1].address, amount);
    await threeGauges[1].connect(dan).deposit(amount, dan.address, false);

    await time.increase(MONTH);

    // cannot withdraw too much
    await expect(threeGauges[1].connect(bob).withdraw(amount.add(1), false)).to
      .be.reverted;

    // Withdraw
    await threeGauges[1].connect(bob).withdraw(amount, false);
    await threeGauges[2].connect(charlie).withdraw(amount, false);
    await threeGauges[1].connect(dan).withdraw(amount, false);

    // Balances after withdrawal
    expect(await mockLpToken.balanceOf(bob.address)).to.equal(amount);
    expect(await mockLpToken.balanceOf(charlie.address)).to.equal(amount);
    expect(await mockLpToken.balanceOf(dan.address)).to.equal(amount);

    // Claim for Bob now
    await minter.connect(bob).mint(threeGauges[1].address);
    const bobTokens = await token.balanceOf(bob.address);

    await time.increase(MONTH);

    // This won't give anything
    await minter.connect(bob).mint(threeGauges[1].address);
    expect(await token.balanceOf(bob.address)).to.equal(bobTokens);

    await minter.connect(charlie).mint(threeGauges[2].address);
    const charlieTokens = await token.balanceOf(charlie.address);
    await minter.connect(dan).mint(threeGauges[1].address);
    const danTokens = await token.balanceOf(dan.address);

    const S = bobTokens.add(charlieTokens).add(danTokens);
    const ww = gaugeWeights.map((w, i) => w.mul(typeWeights[gaugeTypes[i]]));
    const Sw = ww[1].add(ww[2]); // Gauge 0 not used

    // Bob and Charlie were there for full time, gauges 1 and 2
    // Dan was in gauge 1 for half the time
    expect(
      approx(
        bobTokens.mul(SCALE).div(S),
        ww[1].mul(SCALE).mul(3).div(4).div(Sw), // 0.75 * ww[1] / Sw
        BigNumber.from(10).pow(14).mul(2) // = 2e-6 * SCALE
      )
    ).to.be.true;
    expect(
      approx(
        charlieTokens.mul(SCALE).div(S),
        ww[2].mul(SCALE).div(Sw), // ww[2] / Sw
        BigNumber.from(10).pow(14).mul(2) // = 2e-6 * SCALE
      )
    ).to.be.true;
    expect(
      approx(
        danTokens.mul(SCALE).div(S),
        ww[1].mul(SCALE).div(4).div(Sw), // 0.25 * ww[1] / Sw
        BigNumber.from(10).pow(14).mul(2) // = 2e-6 * SCALE
      )
    ).to.be.true;
  });
});
