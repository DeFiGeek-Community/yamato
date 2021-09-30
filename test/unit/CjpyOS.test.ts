import { ethers } from 'hardhat'
import { smockit, isMockContract } from 'optimism/packages/smock';

const { waffleJest } = require("@ethereum-waffle/jest");
expect.extend(waffleJest);
const betterexpect = (<any>expect); // TODO: better typing for waffleJest
import { getSharedSigners } from "@test/param/helper";

/* Parameterized Test (Testcases are in /test/parameterizedSpecs.ts) */
describe("Smock for CjpyOS", function() {
  it(`succeeds to make a mock`, async function() {
    const spec = await ethers.getContractFactory('CjpyOS')
    const mock = await smockit(spec)
    betterexpect(isMockContract(mock)).toBe(true);
  });
});

describe("CjpyOS", function() {
  let mockCJPY;
  let mockYMT;
  let mockVeYMT;
  let mockFeed;
  let cjpyOS;
  let accounts;

  beforeEach(async () => {
    accounts = await getSharedSigners();
    const spec1 = await ethers.getContractFactory('CJPY')
    const spec2 = await ethers.getContractFactory('YMT')
    const spec3 = await ethers.getContractFactory('veYMT')
    const spec4 = await ethers.getContractFactory('PriceFeed')
    mockCJPY = await smockit(spec1)
    mockYMT = await smockit(spec2)
    mockVeYMT = await smockit(spec3)
    mockFeed = await smockit(spec4)

    cjpyOS = await (await ethers.getContractFactory('CjpyOS')).deploy(
      mockCJPY.address,
      mockYMT.address,
      mockVeYMT.address,
      mockFeed.address,
      // governance=deployer
    );

    mockCJPY.smocked['mint(address,uint256)'].will.return.with(0);
    mockCJPY.smocked['burnFrom(address,uint256)'].will.return.with(0);

  });

  describe("addYamato()", function() {
    it(`fails to add new Yamato for non-governer.`, async function() {
      await betterexpect( cjpyOS.connect(accounts[1].address).addYamato(accounts[1].address) ).toBeReverted()
    });

    it(`succeeds to add new Yamato`, async function() {
      await cjpyOS.addYamato(accounts[0].address); // onlyGovernance
      const _yamato = await cjpyOS.yamatoes(0);
      betterexpect(_yamato).toBe(accounts[0].address);
    });
  });

  describe("mintCJPY()", function() {
    it(`fails to mint CJPY`, async function() {
      await betterexpect( cjpyOS.mintCJPY(accounts[0].address, 10000) ).toBeReverted()
    });

    it(`succeeds to mint CJPY`, async function() {
      await cjpyOS.addYamato(accounts[0].address); // onlyGovernance
      await cjpyOS.mintCJPY(accounts[0].address, 10000); // onlyYamato
      betterexpect(mockCJPY.smocked['mint(address,uint256)'].calls.length).toBe(1);
    });
  });

  describe("burnCJPY()", function() {
    it(`fails to burn CJPY`, async function() {
      await betterexpect( cjpyOS.burnCJPY(accounts[0].address, 10000) ).toBeReverted()
    });

    it(`succeeds to burn CJPY`, async function() {
      await cjpyOS.addYamato(accounts[0].address); // onlyGovernance
      await cjpyOS.burnCJPY(accounts[0].address, 10000); // onlyYamato
      betterexpect(mockCJPY.smocked['burnFrom(address,uint256)'].calls.length).toBe(1);
    });
  });


});
