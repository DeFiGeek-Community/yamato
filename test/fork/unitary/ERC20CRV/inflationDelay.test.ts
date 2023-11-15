import { ethers } from "hardhat";
import { expect } from "chai";
import {
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { deployContracts } from "../../Helper";
import Constants from "../../Constants";

describe("ERC20CRV", function () {
  let accounts: SignerWithAddress[];
  let token: Contract;
  let snapshot: SnapshotRestorer;

  const YEAR = Constants.YEAR;

  beforeEach(async function () {
    snapshot = await takeSnapshot();
    accounts = await ethers.getSigners();
    ({ token } = await deployContracts());
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  describe("ERC20CRV InflationDelay", function () {
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
        ethers.utils.parseEther("1303030303")
      );

      await ethers.provider.send("evm_increaseTime", [86401]);
      await ethers.provider.send("evm_mine", []);

      await token.updateMiningParameters();

      expect(await token.availableSupply()).to.be.gt(
        ethers.utils.parseEther("1303030303")
      );
    });
  });
});
