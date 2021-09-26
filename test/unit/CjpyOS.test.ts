import { ethers } from "hardhat";
import { FakeContract, smock } from "@defi-wonderland/smock";
import chai, { expect } from "chai";
import { Signer } from "ethers";
import {
  CjpyOS,
  CJPY,
  YMT,
  VeYMT,
  PriceFeed,
  CjpyOS__factory,
} from "../../typechain";
import { Address } from "cluster";

chai.use(smock.matchers);

describe("CjpyOS", () => {
  let mockCJPY: FakeContract<CJPY>;
  let mockYMT: FakeContract<YMT>;
  let mockVeYMT: FakeContract<VeYMT>;
  let mockFeed: FakeContract<PriceFeed>;
  let cjpyOS: CjpyOS;
  let accounts: Signer[];
  let ownerAddress: string;
  let userAddress: string;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    ownerAddress = await accounts[0].getAddress();
    userAddress = await accounts[1].getAddress();
    mockCJPY = await smock.fake<CJPY>("CJPY", { address: ownerAddress });
    mockYMT = await smock.fake<YMT>("YMT", { address: ownerAddress });
    mockVeYMT = await smock.fake<VeYMT>("veYMT", {
      address: ownerAddress,
    });
    mockFeed = await smock.fake<PriceFeed>("PriceFeed", {
      address: ownerAddress,
    });

    cjpyOS = await (<CjpyOS__factory>(
      await ethers.getContractFactory("CjpyOS")
    )).deploy(
      mockCJPY.address,
      mockYMT.address,
      mockVeYMT.address,
      mockFeed.address
      // governance=deployer
    );

    mockCJPY.mint.returns(0);
    mockCJPY.burnFrom.returns(0);
  });

  describe("addYamato()", function () {
    it(`fails to add new Yamato for non-governer.`, async function () {
      await expect(
        cjpyOS.connect(userAddress).addYamato(userAddress)
      ).toBeReverted();
    });

    it(`succeeds to add new Yamato`, async function () {
      await cjpyOS.addYamato(ownerAddress); // onlyGovernance
      const _yamato = await cjpyOS.yamatoes(0);
      expect(_yamato).toBe(ownerAddress);
    });
  });

  describe("mintCJPY()", function () {
    it(`fails to mint CJPY`, async function () {
      await expect(cjpyOS.mintCJPY(ownerAddress, 10000)).toBeReverted();
    });

    it(`succeeds to mint CJPY`, async function () {
      await cjpyOS.addYamato(ownerAddress); // onlyGovernance
      await cjpyOS.mintCJPY(ownerAddress, 10000); // onlyYamato
      expect(mockCJPY.mint).to.be.calledOnce;
    });
  });

  describe("burnCJPY()", function () {
    it(`fails to burn CJPY`, async function () {
      await expect(cjpyOS.burnCJPY(ownerAddress, 10000)).toBeReverted();
    });

    it(`succeeds to burn CJPY`, async function () {
      await cjpyOS.addYamato(ownerAddress); // onlyGovernance
      await cjpyOS.burnCJPY(ownerAddress, 10000); // onlyYamato
      expect(mockCJPY.burnFrom).to.be.calledOnce;
    });
  });
});
