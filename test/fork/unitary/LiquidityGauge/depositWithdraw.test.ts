import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { EVMUtils, TestSetup } from "../../helper";

describe("LiquidityGauge depositWithdraw", function () {
  let setup: TestSetup;
  let evm: EVMUtils;
  let snapshotId: string;

  beforeEach(async () => {
    evm = new EVMUtils();
    snapshotId = await evm.snapshot();
    setup = new TestSetup();
    await setup.setup();
    await setup.mockLpToken.approve(setup.lg.address, setup.ten_to_the_21.mul("2"));
  });

  afterEach(async () => {
    await evm.restore(snapshotId);
  });

  it("should deposit tokens", async function () {
    const balance = await setup.mockLpToken.balanceOf(setup.creatorAddress);
    const depositAmount = BigNumber.from(100000);
    await setup.lg.connect(setup.creator).deposit(100000, setup.creatorAddress, false);

    expect(await setup.mockLpToken.balanceOf(setup.lg.address)).to.equal(depositAmount);
    expect(await setup.mockLpToken.balanceOf(setup.creatorAddress)).to.equal(balance.sub(depositAmount));
    expect(await setup.lg.totalSupply()).to.equal(depositAmount);
    expect(await setup.lg.balanceOf(setup.creatorAddress)).to.equal(depositAmount);
  });

  it("should handle zero deposit", async function () {
    const balance = await setup.mockLpToken.balanceOf(setup.creatorAddress);
    await setup.lg.deposit(0, setup.creatorAddress, false);

    expect(await setup.mockLpToken.balanceOf(setup.lg.address)).to.equal(BigNumber.from(0));
    expect(await setup.mockLpToken.balanceOf(setup.creatorAddress)).to.equal(balance);
    expect(await setup.lg.totalSupply()).to.equal(BigNumber.from(0));
    expect(await setup.lg.balanceOf(setup.creatorAddress)).to.equal(BigNumber.from(0));
  });

  it("should revert on deposit with insufficient balance", async function () {
    await expect(setup.lg.connect(setup.alice).deposit(100000, setup.creatorAddress, false)).to.be.reverted;
  });

  it("should withdraw tokens", async function () {
    const balance = await setup.mockLpToken.balanceOf(setup.creatorAddress);
    const depositAmount = BigNumber.from(100000);

    await setup.lg.deposit(depositAmount, setup.creatorAddress, false);
    await setup.lg.withdraw(depositAmount, false);

    expect(await setup.mockLpToken.balanceOf(setup.lg.address)).to.equal(0);
    expect(await setup.mockLpToken.balanceOf(setup.creatorAddress)).to.equal(balance);
    expect(await setup.lg.totalSupply()).to.equal(0);
    expect(await setup.lg.balanceOf(setup.creatorAddress)).to.equal(0);
  });

  it("should handle zero withdrawal", async function () {
    const balance = await setup.mockLpToken.balanceOf(setup.creatorAddress);
    const depositAmount = BigNumber.from(100000);

    await setup.lg.deposit(depositAmount, setup.creatorAddress, false);
    await setup.lg.withdraw(0, false);

    expect(await setup.mockLpToken.balanceOf(setup.lg.address)).to.equal(depositAmount);
    expect(await setup.mockLpToken.balanceOf(setup.creatorAddress)).to.equal(balance.sub(depositAmount));
    expect(await setup.lg.totalSupply()).to.equal(depositAmount);
    expect(await setup.lg.balanceOf(setup.creatorAddress)).to.equal(depositAmount);
  });

  it("should withdraw tokens after a new epoch", async function () {
    const balance = await setup.mockLpToken.balanceOf(setup.creatorAddress);
    const depositAmount = BigNumber.from(100000);

    await setup.lg.deposit(depositAmount, setup.creatorAddress, false);

    await ethers.provider.send("evm_increaseTime", [86400 * 400]);
    await ethers.provider.send("evm_mine");

    await setup.lg.withdraw(depositAmount, false);

    expect(await setup.mockLpToken.balanceOf(setup.lg.address)).to.equal(0);
    expect(await setup.mockLpToken.balanceOf(setup.creatorAddress)).to.equal(balance);
    expect(await setup.lg.totalSupply()).to.equal(0);
    expect(await setup.lg.balanceOf(setup.creatorAddress)).to.equal(0);
  });

  // Add additional tests as needed...
});
