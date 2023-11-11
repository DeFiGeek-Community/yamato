import { ethers } from "hardhat";
import { expect } from "chai";
import {
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { BigNumber, Contract } from "ethers";
import { deployContracts } from "../../helper";
import Constants from "../../Constants";

describe("ERC20CRV", function () {
  let accounts: Signer[];
  let token: Contract;
  let snapshot: SnapshotRestorer;

  const WEEK = Constants.WEEK;
  const week = Constants.week;
  const YEAR = Constants.YEAR;
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

  beforeEach(async function () {
    snapshot = await takeSnapshot();
    accounts = await ethers.getSigners();
    const Token = await ethers.getContractFactory("CRV");
    token = await Token.deploy();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  describe("ERC20CRV Setters", function () {
    it("should revert when non-admin tries to set minter", async function () {
      await expect(token.connect(accounts[1]).setMinter(accounts[2].address)).to.be.revertedWith("dev: admin only");
    });

    it("should revert when non-admin tries to set admin", async function () {
      await expect(token.connect(accounts[1]).setAdmin(accounts[2].address)).to.be.revertedWith("dev: admin only");
    });

    it("should allow admin to set minter", async function () {
      await token.connect(accounts[0]).setMinter(accounts[1].address);
      expect(await token.minter()).to.equal(accounts[1].address);
    });

    it("should allow admin to set admin", async function () {
      await token.connect(accounts[0]).setAdmin(accounts[1].address);
      expect(await token.admin()).to.equal(accounts[1].address);
    });
  });
});
