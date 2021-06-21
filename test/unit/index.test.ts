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

const YAMATO_ABI = genABI('Yamato');

/* Parameterized Test (Testcases are in /test/parameterizedSpecs.ts) */
describe("Smock", function() {
  it(`succeeds to make a mock`, async function() {
    const spec = await ethers.getContractFactory('Yamato')
    const mock = await smockit(spec)
    betterexpect(isMockContract(mock)).toBe(true);
  });
});

describe("Yamato", function() {
  describe("issue()", function() {
    it(`succeeds to make a pledge with ICR=110%, and the TCR will be 110%`, async function() {
      const PRICE = 260000;
      const MCR = 1.1;
      const spec1 = await ethers.getContractFactory('Pool')
      const spec2 = await ethers.getContractFactory('PriceFeed')
      const spec3 = await ethers.getContractFactory('YMT')
      const spec4 = await ethers.getContractFactory('CJPY')
      const mockPool = await smockit(spec1)
      const mockFeed = await smockit(spec2)
      const mockYMT = await smockit(spec3)
      const mockCJPY = await smockit(spec4)
      const yamato:Yamato = await (await ethers.getContractFactory('Yamato')).deploy(
        mockPool.address,
        mockFeed.address,
        mockYMT.address,
        mockCJPY.address
      );

      mockPool.smocked['depositRedemptionReserve(uint256)'].will.return.with(0);
      mockPool.smocked['depositRedemptionReserve(uint256)'].will.return.with(0);
      mockPool.smocked['depositDebtCancelReserve(uint256)'].will.return.with(0);
      mockPool.smocked['lockETH(uint256)'].will.return.with(0);
      mockFeed.smocked.fetchPrice.will.return.with(PRICE);
      

      const toCollateralize = 1;
      const toBorrow = (PRICE * toCollateralize) / MCR;
      await yamato.issue(toERC20(toBorrow+""), {value:toERC20(toCollateralize+"")});
      const TCR = await yamato.getTCR(PRICE);

      betterexpect(TCR.toString()).toBe("110");


      const pledge = await yamato.pledges(await yamato.signer.getAddress());

      betterexpect(pledge.coll.toString()).toBe("1000000000000000000");
      betterexpect(pledge.debt.toString()).toBe("236363636363636350000000");

    });

    it.todo(`should run depositRedemptionReserve() of Pool.sol`);
    it.todo(`should run depositDebtCancelReserve() of Pool.sol`);
    it.todo(`should run lockETH() of Pool.sol`);

  });
  describe("repay()", function() {
    it(`should reduce debt`, async function() {
    });
    it(`should improve TCR`, async function() {
    });
    it(`can't be executed in the TCR < MCR`, async function() {
    });
  });
  describe("withdraw()", function() {
    it(`should reduce coll`, async function() {
    });
    it(`should decrease TCR`, async function() {
    });
    it(`can't be executed in the TCR < MCR nor make TCR < MCR`, async function() {
    });
    it.todo(`should run sendETH() of Pool.sol`);
  });

  describe("redeem()", function() {
    it(`should reduce debt of lowest ICR pledges`, async function() {
    });
    it(`should return colls from them and it goes to RedemptionReserve`, async function() {
    });
    it(`should keep TCR(??)`, async function() {
    });
    it(`doesn't care how much TCR is. (compare to MCR)`, async function() {
    });
    it(`doesn't remain any sorted Trove state in the contract`, async function() {
    });
    it(`can remain coll=0 debt>0 pledge in the storage`, async function() {
    });
    it.todo(`[poolFlag:false] should NOT run useRedemptionReserve() of Pool.sol`);
    it.todo(`[poolFlag:true] should run useRedemptionReserve() of Pool.sol`);
    it.todo(`should run accumulateDividendReserve() of Pool.sol`);
  });

  describe("sweep()", function() {
    it(`should improve TCR`, async function() {
    });
    it(`doesn't care how much TCR is. (compare to MCR)`, async function() {
    });
    it(`should remove coll=0 pledges from the smallest debt`, async function() {
    });
    it.todo(`should run useDebtCancelReserve() of Pool.sol`);
  });

});