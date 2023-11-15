import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import {
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { deployContracts } from "../../Helper";
import Constants from "../../Constants";

describe("LiquidityGauge kick", function () {
  let accounts: SignerWithAddress[];
  let token: Contract;
  let votingEscrow: Contract;
  let mockLpToken: Contract;
  let gauges: Contract[];

  let snapshot: SnapshotRestorer;

  const MAX_UINT256 = Constants.MAX_UINT256;
  const week = Constants.week;
  const DEPOSIT_AMOUNT = Constants.ten_to_the_21; // 10^21
  const LOCK_AMOUNT = Constants.ten_to_the_20; // 10^20

  beforeEach(async () => {
    snapshot = await takeSnapshot();
    accounts = await ethers.getSigners();
    ({ token, votingEscrow, mockLpToken, gauges } = await deployContracts());
    await token.transfer(accounts[1].address, LOCK_AMOUNT);
    await mockLpToken.transfer(accounts[1].address, DEPOSIT_AMOUNT);
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  it("test kick functionality", async function () {
    // Forward time by 2 weeks + 5 seconds
    await ethers.provider.send("evm_increaseTime", [2 * week + 5]);
    await ethers.provider.send("evm_mine");

    // Alice approves tokens to voting escrow and creates a lock
    await token.connect(accounts[1]).approve(votingEscrow.address, MAX_UINT256);
    await votingEscrow
      .connect(accounts[1])
      .createLock(
        LOCK_AMOUNT,
        (await ethers.provider.getBlock("latest")).timestamp + 4 * week
      );

    // Alice approves LP tokens to Gauge and deposits
    await mockLpToken
      .connect(accounts[1])
      .approve(gauges[0].address, MAX_UINT256);
    await gauges[0]
      .connect(accounts[1])
      .deposit(DEPOSIT_AMOUNT, accounts[1].address, false);

    // Check working balance of Alice in Gauge
    expect(await gauges[0].workingBalances(accounts[1].address)).to.equal(
      DEPOSIT_AMOUNT
    );

    // Forward time by 1 week
    await ethers.provider.send("evm_increaseTime", [week]);
    await ethers.provider.send("evm_mine");

    // Bob tries to kick Alice but should fail because it's not allowed yet
    await expect(
      gauges[0].connect(accounts[1]).kick(accounts[1].address)
    ).to.be.revertedWith("Not allowed");

    // Forward time by 4 weeks
    await ethers.provider.send("evm_increaseTime", [4 * week]);
    await ethers.provider.send("evm_mine");

    // Now Bob kicks Alice
    await gauges[0].connect(accounts[1]).kick(accounts[1].address);

    // Check the working balance of Alice after kick
    expect(await gauges[0].workingBalances(accounts[1].address)).to.equal(
      LOCK_AMOUNT.mul(4)
    );

    // Trying to kick again should fail as it's not needed
    await expect(
      gauges[0].connect(accounts[1]).kick(accounts[1].address)
    ).to.be.revertedWith("Not needed");
  });
});
