import { ethers } from "hardhat";
import { FakeContract, smock } from "@defi-wonderland/smock";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { Signer } from "ethers";
import {
  CjpyOS,
  CJPY,
  FeePoolProxy,
  YMT,
  VeYMT,
  PriceFeed,
  CjpyOS__factory,
  FeePoolProxy__factory
} from "../../typechain";

chai.use(smock.matchers);
chai.use(solidity);

describe("CjpyOS", () => {
  let mockCJPY: FakeContract<CJPY>;
  let mockYMT: FakeContract<YMT>;
  let mockVeYMT: FakeContract<VeYMT>;
  let mockFeed: FakeContract<PriceFeed>;
  let mockFeePoolProxy: FakeContract<FeePoolProxy>;
  let cjpyOS: CjpyOS;
  let accounts: Signer[];
  let ownerAddress: string;
  let userAddress: string;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    ownerAddress = await accounts[0].getAddress();
    userAddress = await accounts[1].getAddress();
    mockCJPY = await smock.fake<CJPY>("CJPY");
    mockFeed = await smock.fake<PriceFeed>("PriceFeed");
    mockFeePoolProxy = await smock.fake<FeePoolProxy>("FeePoolProxy");

    cjpyOS = await (<CjpyOS__factory>(
      await ethers.getContractFactory("CjpyOS")
    )).deploy(
      mockCJPY.address,
      mockFeed.address,
      mockFeePoolProxy.address
      // governance=deployer
    );

    mockCJPY.mint.returns(0);
    mockCJPY.burn.returns(0);
  });

  describe("addYamato()", function () {
    it(`fails to add new Yamato for non-governer.`, async function () {
      await expect(
        cjpyOS.connect(accounts[1]).addYamato(await accounts[1].getAddress())
      ).to.be.revertedWith("You are not the governer.");
    });

    it(`succeeds to add new Yamato`, async function () {
      await cjpyOS.addYamato(ownerAddress); // onlyGovernance
      const _yamato = await cjpyOS.yamatoes(0);
      expect(_yamato).to.equal(ownerAddress);
    });
  });

  describe("mintCJPY()", function () {
    it(`fails to mint CJPY`, async function () {
      // await cjpyOS.mintCJPY(ownerAddress, 10000);
      await expect(cjpyOS.mintCJPY(ownerAddress, 10000)).to.be.revertedWith(
        "No Yamato is registered."
      );
    });

    it(`succeeds to mint CJPY`, async function () {
      await cjpyOS.addYamato(ownerAddress); // onlyGovernance
      await cjpyOS.mintCJPY(ownerAddress, 10000); // onlyYamato
      expect(mockCJPY.mint).to.be.calledOnce;
    });
  });

  describe("burnCJPY()", function () {
    it(`fails to burn CJPY`, async function () {
      await expect(cjpyOS.burnCJPY(ownerAddress, 10000)).to.be.revertedWith(
        "No Yamato is registered."
      );
    });

    it(`succeeds to burn CJPY`, async function () {
      await cjpyOS.addYamato(ownerAddress); // onlyGovernance
      await cjpyOS.burnCJPY(ownerAddress, 10000); // onlyYamato
      expect(mockCJPY.burn).to.be.calledOnce;
    });
  });
});
