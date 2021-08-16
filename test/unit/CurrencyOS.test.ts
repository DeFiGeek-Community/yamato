import { ethers } from 'hardhat'
import { smockit, smoddit, isMockContract } from '@eth-optimism/smock';
import { BigNumber, utils } from 'ethers';
const { AbiCoder, ParamType } = utils;

const { waffleJest } = require("@ethereum-waffle/jest");
expect.extend(waffleJest);
const betterexpect = (<any>expect); // TODO: better typing for waffleJest
import { summon, forge, create, getSharedProvider, getSharedSigners, 
  parseAddr, parseBool, parseInteger, getLogs,
  encode, decode, increaseTime,
  toERC20, toFloat, onChainNow } from "@test/param/helper";
import { getBulksaleAbiArgs, getTokenAbiArgs, sendEther } from "@test/param/scenarioHelper";
import { State } from '@test/param/parameterizedSpecs';
import { parameterizedSpecs } from '@test/param/paramSpecEntrypoint';
import { suite, test } from '@testdeck/jest'
import fs from 'fs';
import { BalanceLogger } from '@src/BalanceLogger';
import { Yamato, Pool } from '../../typechain'; 

import { genABI } from '@src/genABI';

const CJPY_OS_ABI = genABI('CjpyOS');

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
      const rewardAllocation = 1000;
      const isL2 = false;
      const isFilled = true;
      await betterexpect( cjpyOS.connect(accounts[1].address).addYamato([accounts[1].address, rewardAllocation, isL2, isFilled]) ).toBeReverted()
    });

    it(`succeeds to add new Yamato`, async function() {
      const rewardAllocation = 1000;
      const isL2 = false;
      const isFilled = true;
      await cjpyOS.addYamato([accounts[0].address, rewardAllocation, isL2, isFilled]); // onlyYamato
      const state = await cjpyOS.yamatoes(accounts[0].address);
      betterexpect(state[0]).toBe(accounts[0].address);
      betterexpect(state[2]).toBe(false);
      betterexpect(state[3]).toBe(true);
    });
  });

  describe("mintCJPY()", function() {
    it(`fails to mint CJPY`, async function() {
      await betterexpect( cjpyOS.mintCJPY(accounts[0].address, 10000) ).toBeReverted()
    });

    it(`succeeds to mint CJPY`, async function() {
      const rewardAllocation = 1000;
      const isL2 = false;
      const isFilled = true;
      await cjpyOS.addYamato([accounts[0].address, rewardAllocation, isL2, isFilled]); // onlyGovernance
      await cjpyOS.mintCJPY(accounts[0].address, 10000); // onlyYamato
      betterexpect(mockCJPY.smocked['mint(address,uint256)'].calls.length).toBe(1);
    });
  });

  describe("burnCJPY()", function() {
    it(`fails to burn CJPY`, async function() {
      await betterexpect( cjpyOS.burnCJPY(accounts[0].address, 10000) ).toBeReverted()
    });

    it(`succeeds to burn CJPY`, async function() {
      const rewardAllocation = 1000;
      const isL2 = false;
      const isFilled = true;
      await cjpyOS.addYamato([accounts[0].address, rewardAllocation, isL2, isFilled]); // onlyGovernance
      await cjpyOS.burnCJPY(accounts[0].address, 10000); // onlyYamato
      betterexpect(mockCJPY.smocked['burnFrom(address,uint256)'].calls.length).toBe(1);
    });
  });


});
