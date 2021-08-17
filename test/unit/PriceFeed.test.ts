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
  let mockAggregatorV3;
  let mockTellorCaller;
  let feed;
  let accounts;

  beforeEach(async () => {
    accounts = await getSharedSigners();
    const spec1 = await ethers.getContractFactory('ChainLinkMock')
    mockAggregatorV3 = await smockit(spec1) // https://github.com/liquity/dev/blob/main/packages/contracts/contracts/Dependencies/AggregatorV3Interface.sol
    mockTellorCaller = await smockit(spec1) // https://github.com/liquity/dev/blob/main/packages/contracts/contracts/Interfaces/ITellorCaller.sol

    feed = await (await ethers.getContractFactory('PriceFeed')).deploy(
        mockAggregatorV3.address,
        mockTellorCaller.address
    );

    mockAggregatorV3.smocked.decimals.will.return.with(0);
    mockAggregatorV3.smocked.latestRoundData.will.return.with(0);
    mockAggregatorV3.smocked['getRoundData(uint256)'].will.return.with(0);
    mockTellorCaller.smocked['getTellorCurrentValue(uint256)'].will.return.with(0);
  });

  describe("fetchPrice()", function() {
    it.skip(`succeeds to fetch`, async function() {
        // TODO: Liquity's PriceFeed test is very good example https://github.com/liquity/dev/blob/main/packages/contracts/test/PriceFeedTest.js
    });

    it.skip(`fails fetch`, async function() {
    });

  });


});
