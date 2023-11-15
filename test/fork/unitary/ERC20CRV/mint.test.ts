import { ethers } from "hardhat";
import { expect } from "chai";
import {
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { BigNumber, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import Constants from "../../Constants";

describe("ERC20CRV", function () {
  let accounts: SignerWithAddress[];
  let token: Contract;
  let snapshot: SnapshotRestorer;

  const week = Constants.week;
  const ZERO_ADDRESS = Constants.ZERO_ADDRESS;

  beforeEach(async function () {
    snapshot = await takeSnapshot();
    accounts = await ethers.getSigners();
    const Token = await ethers.getContractFactory("CRV");
    token = await Token.deploy();
    await ethers.provider.send("evm_increaseTime", [86401]);
    await token.updateMiningParameters();
  });

  afterEach(async () => {
    await snapshot.restore();
  });
  describe("ERC20CRV Mint", function () {
    it("test_available_supply", async function () {
      const creationTime = await token.startEpochTime();
      const initialSupply = await token.totalSupply();
      const rate = await token.rate();

      await ethers.provider.send("evm_increaseTime", [week]);
      await ethers.provider.send("evm_mine", []);

      const currentBlock = BigNumber.from(
        (await ethers.provider.getBlock("latest")).timestamp
      );
      // const currentBlock = await ethers.provider.getBlock('latest');
      const expected = initialSupply.add(
        currentBlock.sub(creationTime).mul(rate)
      );
      expect(await token.availableSupply()).to.equal(expected);
    });

    it("test_mint", async function () {
      await token.setMinter(accounts[0].address);
      const creationTime = await token.startEpochTime();
      const initialSupply = await token.totalSupply();
      const rate = await token.rate();

      await ethers.provider.send("evm_increaseTime", [week]);

      const currentTime = BigNumber.from(
        (await ethers.provider.getBlock("latest")).timestamp
      );
      const amount = currentTime.sub(creationTime).mul(rate);
      await token.mint(accounts[1].address, amount);

      expect(await token.balanceOf(accounts[1].address)).to.equal(amount);
      expect(await token.totalSupply()).to.equal(initialSupply.add(amount));
    });

    it("test_overmint", async function () {
      await token.setMinter(accounts[0].address);
      const creationTime = await token.startEpochTime();
      const rate = await token.rate();

      await ethers.provider.send("evm_increaseTime", [week]);
      await ethers.provider.send("evm_mine", []);

      const currentTime = BigNumber.from(
        (await ethers.provider.getBlock("latest")).timestamp
      );
      const amount = currentTime.sub(creationTime).add(2).mul(rate);
      await expect(token.mint(accounts[1].address, amount)).to.be.revertedWith(
        "dev: exceeds allowable mint amount"
      );
    });

    it("test_minter_only", async function () {
      await token.setMinter(accounts[0].address);
      await expect(
        token.connect(accounts[1]).mint(accounts[1].address, 0)
      ).to.be.revertedWith("dev: minter only");
    });

    it("test_zero_address", async function () {
      await token.setMinter(accounts[0].address);
      await expect(token.mint(ZERO_ADDRESS, 0)).to.be.revertedWith(
        "dev: zero address"
      );
    });
  });
});
