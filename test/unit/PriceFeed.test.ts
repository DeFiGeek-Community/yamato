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

const PriceFeed_ABI = genABI('PriceFeed');

/* Parameterized Test (Testcases are in /test/parameterizedSpecs.ts) */
describe("Smock for PriceFeed", function() {
  it(`succeeds to make a mock`, async function() {
    const spec = await ethers.getContractFactory('PriceFeed')
    const mock = await smockit(spec)
    betterexpect(isMockContract(mock)).toBe(true);
  });
});



let feed;
let accounts;
let mockAggregatorV3;
let mockTellorCaller;
let mockRoundCount = 0;
async function setMocks(conf){
    let cPrice = conf.price.chainlink
    let tPrice = conf.price.tellor
    let now = Math.ceil(Date.now()/1000)
    if(feed){
        let block = await feed.provider.getBlock("latest")
        now = block.timestamp
    }

    let cDiff = conf.silentFor.chainlink; // TIMEOUT = 14400 secs
    let tDiff = conf.silentFor.tellor;

    mockRoundCount++;
    const CHAINLINK_DIGITS = 8;
    const chainlinkPrice = BigNumber.from(cPrice).mul(BigNumber.from(10).pow(CHAINLINK_DIGITS));
    mockAggregatorV3.smocked.decimals.will.return.with(CHAINLINK_DIGITS); // uint8
    mockAggregatorV3.smocked.latestRoundData.will.return.with([mockRoundCount,chainlinkPrice,now-cDiff,now-cDiff,2]); // uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound
    mockAggregatorV3.smocked['getRoundData(uint80)'].will.return.with([mockRoundCount,chainlinkPrice,now-cDiff,now-cDiff,mockRoundCount+1]); // uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound
    const TELLOR_DIGITS = 6;
    const tellorPrice = BigNumber.from(tPrice).mul(BigNumber.from(10).pow(TELLOR_DIGITS));
    mockTellorCaller.smocked.getTellorCurrentValue.will.return.with([true,tellorPrice,now-tDiff]); // bool ifRetrieve, uint256 value, uint256 _timestampRetrieved
}
describe("PriceFeed", function() {
  beforeEach(async () => {
    accounts = await getSharedSigners();
    const spec1 = await ethers.getContractFactory('ChainlinkMock')
    const spec2 = await ethers.getContractFactory('TellorCallerMock')
    mockAggregatorV3 = await smockit(spec1) // https://github.com/liquity/dev/blob/main/packages/contracts/contracts/Dependencies/AggregatorV3Interface.sol
    mockTellorCaller = await smockit(spec2) // https://github.com/liquity/dev/blob/main/packages/contracts/contracts/Interfaces/ITellorCaller.sol

    await setMocks({ price: { chainlink: 110, tellor: 110 }, silentFor: { chainlink: 7200, tellor: 7200} })

    feed = await (await ethers.getContractFactory('PriceFeed')).deploy(
        mockAggregatorV3.address,
        mockTellorCaller.address
    );
  });

  describe("fetchPrice()", function() {
    it(`succeeds to get price from ChainLink`, async function() {
        await setMocks({ price: { chainlink: 111, tellor: 112 }, silentFor: { chainlink: 7200, tellor: 7200} })
        let tx = await feed.fetchPrice();
        let res = await tx.wait();
        betterexpect(BigNumber.from(res.logs[0].data).div(BigNumber.from(10).pow(18))).toEqBN(111);
    });

    it(`succeeds to get price from Tellor because ChainLink is frozen`, async function() {
        feed.provider.send("evm_increaseTime", [7200])
        feed.provider.send("evm_mine")
        await setMocks({ price: { chainlink: 111, tellor: 113 }, silentFor: { chainlink: 14401, tellor: 3600} })
        let tx = await feed.fetchPrice();
        let res = await tx.wait();
        betterexpect(BigNumber.from(res.logs[1].data).div(BigNumber.from(10).pow(18))).toEqBN(113);
    });

    it(`returns last good price as both oracles are untrusted`, async function() {
        feed.provider.send("evm_increaseTime", [7200])
        feed.provider.send("evm_mine")
        await setMocks({ price: { chainlink: 109, tellor: 109 }, silentFor: { chainlink: 14401, tellor: 14401} })
        let tx = await feed.fetchPrice();
        let res = await tx.wait();
        betterexpect(BigNumber.from(res.logs[0].data).div(BigNumber.from(10).pow(18))).toEqBN(0);
    });

  });


});
