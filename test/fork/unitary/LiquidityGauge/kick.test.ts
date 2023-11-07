import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { EVMUtils, TestSetup } from "../../helper";

const MAX_UINT256 = ethers.constants.MaxUint256;
const WEEK = 7 * 86400;
const DEPOSIT_AMOUNT = BigNumber.from("10").pow("21"); // 10^21
const LOCK_AMOUNT = BigNumber.from("10").pow("20"); // 10^20

describe("LiquidityGauge kick", function () {
  let setup: TestSetup;
  let evm: EVMUtils;
  let snapshotId: string;

  beforeEach(async () => {
    evm = new EVMUtils();
    snapshotId = await evm.snapshot();
    setup = new TestSetup();
    await setup.setup();
    await setup.token.transfer(setup.aliceAddress, LOCK_AMOUNT);
    await setup.mockLpToken.transfer(setup.aliceAddress, DEPOSIT_AMOUNT);
  });

  afterEach(async () => {
    await evm.restore(snapshotId);
  });

  it("test kick functionality", async function () {
    // Forward time by 2 weeks + 5 seconds
    await ethers.provider.send("evm_increaseTime", [2 * WEEK + 5]);
    await ethers.provider.send("evm_mine");

    // Alice approves tokens to voting escrow and creates a lock
    await setup.token.connect(setup.alice).approve(setup.votingEscrow.address, MAX_UINT256);
    await setup.votingEscrow.connect(setup.alice).createLock(LOCK_AMOUNT, (await ethers.provider.getBlock('latest')).timestamp + 4 * WEEK);

    // Alice approves LP tokens to Gauge and deposits
    await setup.mockLpToken.connect(setup.alice).approve(setup.lg.address, MAX_UINT256);
    await setup.lg.connect(setup.alice).deposit(DEPOSIT_AMOUNT, setup.aliceAddress, false);

    // Check working balance of Alice in Gauge
    expect(await setup.lg.workingBalances(setup.aliceAddress)).to.equal(DEPOSIT_AMOUNT);

    // Forward time by 1 week
    await ethers.provider.send("evm_increaseTime", [WEEK]);
    await ethers.provider.send("evm_mine");

    // Bob tries to kick Alice but should fail because it's not allowed yet
    await expect(setup.lg.connect(setup.bob).kick(setup.aliceAddress)).to.be.revertedWith("Not allowed");

    // Forward time by 4 weeks
    await ethers.provider.send("evm_increaseTime", [4 * WEEK]);
    await ethers.provider.send("evm_mine");

    // Now Bob kicks Alice
    await setup.lg.connect(setup.bob).kick(setup.aliceAddress);

    // Check the working balance of Alice after kick
    expect(await setup.lg.workingBalances(setup.aliceAddress)).to.equal(LOCK_AMOUNT.mul(4));

    // Trying to kick again should fail as it's not needed
    await expect(setup.lg.connect(setup.bob).kick(setup.aliceAddress)).to.be.revertedWith("Not needed");
  });
});
