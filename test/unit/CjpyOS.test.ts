import { ethers } from "hardhat";
import { FakeContract, smock } from "@defi-wonderland/smock";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { Signer } from "ethers";
import {
  CjpyOS,
  CJPY,
  FeePool,
  YMT,
  VeYMT,
  Yamato,
  YamatoHelper,
  PriceFeed,
  CjpyOS__factory,
  FeePool__factory,
} from "../../typechain";
import { getFakeProxy } from "../../src/testUtil";

chai.use(smock.matchers);
chai.use(solidity);

describe("CjpyOS", () => {
  let mockCJPY: FakeContract<CJPY>;
  let mockYMT: FakeContract<YMT>;
  let mockVeYMT: FakeContract<VeYMT>;
  let mockFeed: FakeContract<PriceFeed>;
  let mockFeePool: FakeContract<FeePool>;
  let mockYamato: FakeContract<Yamato>;
  let mockYamatoHelper: FakeContract<YamatoHelper>;
  let cjpyOS: CjpyOS;
  let accounts: Signer[];
  let ownerAddress: string;
  let userAddress: string;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    ownerAddress = await accounts[0].getAddress();
    userAddress = await accounts[1].getAddress();
    mockCJPY = await smock.fake<CJPY>("CJPY");
    mockFeed = await getFakeProxy<PriceFeed>("PriceFeed");
    mockFeePool = await getFakeProxy<FeePool>("FeePool");
    mockYamato = await getFakeProxy<Yamato>("Yamato");
    mockYamatoHelper = await getFakeProxy<YamatoHelper>("YamatoHelper");
    mockYamato.yamatoHelper.returns(mockYamatoHelper.address);
    mockYamatoHelper.permitDeps.returns(true);

    cjpyOS = await (<CjpyOS__factory>(
      await ethers.getContractFactory("CjpyOS")
    )).deploy(
      mockCJPY.address,
      mockFeed.address,
      mockFeePool.address
      // governance=deployer
    );

    mockCJPY.mint.returns(0);
    mockCJPY.burn.returns(0);
  });

  describe("addYamato()", function () {
    it(`fails to add new Yamato for non-governer.`, async function () {
      await expect(
        cjpyOS.connect(accounts[1]).addYamato(mockYamato.address)
      ).to.be.revertedWith("You are not the governer.");
    });

    it(`succeeds to add new Yamato`, async function () {
      await cjpyOS.addYamato(mockYamato.address); // onlyGovernance
      const _yamato = await cjpyOS.yamatoes(0);
      expect(_yamato).to.equal(mockYamato.address);
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
      await cjpyOS.addYamato(mockYamato.address); // onlyGovernance
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
      await cjpyOS.addYamato(mockYamato.address); // onlyGovernance
      await cjpyOS.burnCJPY(ownerAddress, 10000); // onlyYamato
      expect(mockCJPY.burn).to.be.calledOnce;
    });
  });
});
