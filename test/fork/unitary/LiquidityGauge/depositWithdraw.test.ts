import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Contract } from "ethers";
import {
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { deployContracts } from "../../Helper";
import Constants from "../../Constants";

describe("LiquidityGauge depositWithdraw", function () {
  let accounts: SignerWithAddress;
  let mockLpToken: Contract;
  let threeGauges: String[];
  let gauges: Contract[];

  let snapshot: SnapshotRestorer;

  const ten_to_the_21 = Constants.ten_to_the_21;

  beforeEach(async () => {
    snapshot = await takeSnapshot();
    accounts = await ethers.getSigners();
    ({ mockLpToken, threeGauges, gauges } = await deployContracts());
    await mockLpToken.approve(threeGauges[0], ten_to_the_21.mul("2"));
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  it("should deposit tokens", async function () {
    const balance = await mockLpToken.balanceOf(accounts[0].address);
    const depositAmount = BigNumber.from(100000);
    await gauges[0].deposit(100000, accounts[0].address, false);

    expect(await mockLpToken.balanceOf(threeGauges[0])).to.equal(depositAmount);
    expect(await mockLpToken.balanceOf(accounts[0].address)).to.equal(
      balance.sub(depositAmount)
    );
    expect(await gauges[0].totalSupply()).to.equal(depositAmount);
    expect(await gauges[0].balanceOf(accounts[0].address)).to.equal(
      depositAmount
    );
  });

  it("should handle zero deposit", async function () {
    const balance = await mockLpToken.balanceOf(accounts[0].address);
    await gauges[0].deposit(0, accounts[0].address, false);

    expect(await mockLpToken.balanceOf(threeGauges[0])).to.equal(
      BigNumber.from(0)
    );
    expect(await mockLpToken.balanceOf(accounts[0].address)).to.equal(balance);
    expect(await gauges[0].totalSupply()).to.equal(BigNumber.from(0));
    expect(await gauges[0].balanceOf(accounts[0].address)).to.equal(
      BigNumber.from(0)
    );
  });

  it("should revert on deposit with insufficient balance", async function () {
    await expect(
      gauges[0].connect(accounts[1]).deposit(100000, accounts[0].address, false)
    ).to.be.reverted;
  });

  it("should withdraw tokens", async function () {
    const balance = await mockLpToken.balanceOf(accounts[0].address);
    const depositAmount = BigNumber.from(100000);

    await gauges[0].deposit(depositAmount, accounts[0].address, false);
    await gauges[0].withdraw(depositAmount, false);

    expect(await mockLpToken.balanceOf(threeGauges[0])).to.equal(0);
    expect(await mockLpToken.balanceOf(accounts[0].address)).to.equal(balance);
    expect(await gauges[0].totalSupply()).to.equal(0);
    expect(await gauges[0].balanceOf(accounts[0].address)).to.equal(0);
  });

  it("should handle zero withdrawal", async function () {
    const balance = await mockLpToken.balanceOf(accounts[0].address);
    const depositAmount = BigNumber.from(100000);

    await gauges[0].deposit(depositAmount, accounts[0].address, false);
    await gauges[0].withdraw(0, false);

    expect(await mockLpToken.balanceOf(threeGauges[0])).to.equal(depositAmount);
    expect(await mockLpToken.balanceOf(accounts[0].address)).to.equal(
      balance.sub(depositAmount)
    );
    expect(await gauges[0].totalSupply()).to.equal(depositAmount);
    expect(await gauges[0].balanceOf(accounts[0].address)).to.equal(
      depositAmount
    );
  });

  it("should withdraw tokens after a new epoch", async function () {
    const balance = await mockLpToken.balanceOf(accounts[0].address);
    const depositAmount = BigNumber.from(100000);

    await gauges[0].deposit(depositAmount, accounts[0].address, false);

    await ethers.provider.send("evm_increaseTime", [86400 * 400]);
    await ethers.provider.send("evm_mine");

    await gauges[0].withdraw(depositAmount, false);

    expect(await mockLpToken.balanceOf(threeGauges[0])).to.equal(0);
    expect(await mockLpToken.balanceOf(accounts[0].address)).to.equal(balance);
    expect(await gauges[0].totalSupply()).to.equal(0);
    expect(await gauges[0].balanceOf(accounts[0].address)).to.equal(0);
  });
});
