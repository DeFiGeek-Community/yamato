import { ethers } from "hardhat";
import { expect } from "chai";
import {
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { Contract } from "ethers";
import Constants from "../../Constants";

const YEAR = Constants.YEAR;

describe("YMT", function () {
  let token: Contract;
  let snapshot: SnapshotRestorer;

  before(async function () {
    const Token = await ethers.getContractFactory("YMT");
    token = await Token.deploy();
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  describe("YMT InflationDelay", function () {
    it("test_rate", async function () {
      expect(await token.rate()).to.equal(0);

      await ethers.provider.send("evm_increaseTime", [86401]);
      await ethers.provider.send("evm_mine", []);

      await token.updateMiningParameters();

      expect(await token.rate()).to.be.gt(0);
    });

    it("test_start_epoch_time", async function () {
      const creationTime = await token.startEpochTime();
      // const now = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);
      // expect(creationTime).to.equal(now.add("86392").sub(YEAR));

      await ethers.provider.send("evm_increaseTime", [86401]);
      await ethers.provider.send("evm_mine", []);

      await token.updateMiningParameters();

      expect(await token.startEpochTime()).to.equal(creationTime.add(YEAR));
    });

    it("test_mining_epoch", async function () {
      expect(await token.miningEpoch()).to.equal(-1);

      await ethers.provider.send("evm_increaseTime", [86401]);
      await ethers.provider.send("evm_mine", []);

      await token.updateMiningParameters();

      expect(await token.miningEpoch()).to.equal(0);
    });

    it("test_available_supply", async function () {
      expect(await token.availableSupply()).to.equal(
        ethers.utils.parseEther("450000000")
      );

      await ethers.provider.send("evm_increaseTime", [86401]);
      await ethers.provider.send("evm_mine", []);

      await token.updateMiningParameters();

      expect(await token.availableSupply()).to.be.gt(
        ethers.utils.parseEther("450000000")
      );
    });
  });
});
