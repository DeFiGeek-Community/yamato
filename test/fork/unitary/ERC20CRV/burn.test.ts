import { ethers } from "hardhat";
import { expect } from "chai";
import {
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { BigNumber, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { deployContracts } from "../../Helper";

describe("ERC20CRV", function () {
  let accounts: SignerWithAddress[];
  let token: Contract;
  let snapshot: SnapshotRestorer;

  beforeEach(async function () {
    snapshot = await takeSnapshot();
    accounts = await ethers.getSigners();
    ({ token } = await deployContracts());
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  describe("ERC20CRV EpochTimeSupply", function () {
    it("test_burn", async function () {
      const balance: BigNumber = await token.balanceOf(accounts[0].address);
      const initialSupply: BigNumber = await token.totalSupply();

      await token.connect(accounts[0]).burn(31337);

      expect(await token.balanceOf(accounts[0].address)).to.equal(
        balance.sub(31337)
      );
      expect(await token.totalSupply()).to.equal(initialSupply.sub(31337));
    });

    it("test_burn_not_admin", async function () {
      const initialSupply: BigNumber = await token.totalSupply();

      await token.transfer(accounts[1].address, 1000000);
      await token.connect(accounts[1]).burn(31337);

      expect(await token.balanceOf(accounts[1].address)).to.equal(
        1000000 - 31337
      );
      expect(await token.totalSupply()).to.equal(initialSupply.sub(31337));
    });

    it("test_burn_all", async function () {
      const initialSupply: BigNumber = await token.totalSupply();

      await token.connect(accounts[0]).burn(initialSupply);

      expect(await token.balanceOf(accounts[0].address)).to.equal(0);
      expect(await token.totalSupply()).to.equal(0);
    });

    it("test_overburn", async function () {
      const initialSupply: BigNumber = await token.totalSupply();

      await expect(
        token.connect(accounts[0]).burn(initialSupply.add(1))
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });
  });
});
