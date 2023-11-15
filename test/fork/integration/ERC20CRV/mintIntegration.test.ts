import { ethers } from "hardhat";
import { expect } from "chai";
import {
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "ethers";

// Assuming you have a helper function to increase blockchain time
async function increaseTime(duration: number) {
  await ethers.provider.send("evm_increaseTime", [duration]);
  await ethers.provider.send("evm_mine", []);
}

const YEAR = 365 * 24 * 60 * 60; // seconds in a year

describe("ERC20CRV", function () {
  let accounts: SignerWithAddress[];
  let token: Contract;
  let snapshot: SnapshotRestorer;

  beforeEach(async function () {
    snapshot = await takeSnapshot();
    accounts = await ethers.getSigners();
    const Token = await ethers.getContractFactory("CRV");
    token = await Token.deploy();

    await increaseTime(86401);
    await token.updateMiningParameters();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  describe("ERC20CRV MintIntegration", function () {
    it("should mint the correct amount", async function () {
      const duration = YEAR; // Replace with dynamic value as needed
      await token.setMinter(accounts[0].address);
      const creationTime = await token.startEpochTime();
      const initialSupply = await token.totalSupply();
      const rate = await token.rate();

      await increaseTime(duration);

      const currentTime = BigNumber.from(
        (await ethers.provider.getBlock("latest")).timestamp
      );
      const amount = currentTime.sub(creationTime).mul(rate);
      await token.mint(accounts[1].address, amount);

      expect(await token.balanceOf(accounts[1].address)).to.equal(amount);
      expect(await token.totalSupply()).to.equal(initialSupply.add(amount));
    });

    it("should revert on overmint", async function () {
      const duration = YEAR; // Replace with dynamic value as needed
      await token.setMinter(accounts[0].address);
      const creationTime = await token.startEpochTime();
      const rate = await token.rate();

      await increaseTime(duration);

      const currentTime = BigNumber.from(
        (await ethers.provider.getBlock("latest")).timestamp
      );
      const amount = currentTime.sub(creationTime).add(2).mul(rate);
      await expect(token.mint(accounts[1].address, amount)).to.be.revertedWith(
        "dev: exceeds allowable mint amount"
      );
    });

    it("should mint multiple times correctly", async function () {
      await token.setMinter(accounts[0].address);
      let totalSupply = await token.totalSupply();
      let balance = BigNumber.from(0);
      let epochStart = await token.startEpochTime();

      const durations = [YEAR * 0.33, YEAR * 0.5, YEAR * 0.7]; // Replace with dynamic values as needed

      for (const time of durations) {
        await increaseTime(time);

        if (
          (await ethers.provider.getBlock("latest")).timestamp - epochStart >
          YEAR
        ) {
          await token.updateMiningParameters();
          epochStart = await token.startEpochTime();
        }

        const amount = (await token.availableSupply()).sub(totalSupply);
        await token.mint(accounts[1].address, amount);

        balance = balance.add(amount);
        totalSupply = totalSupply.add(amount);

        expect(await token.balanceOf(accounts[1].address)).to.equal(balance);
        expect(await token.totalSupply()).to.equal(totalSupply);
      }
    });
  });
});
