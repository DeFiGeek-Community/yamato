import { ethers } from 'hardhat'
import { smockit, smoddit, isMockContract } from 'optimism/packages/smock';
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
import { Yamato, Pool, ChainLinkMock, TellorCallerMock, PriceFeed } from '../../typechain'; 

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
let mockAggregatorV3EthUsd;
let mockAggregatorV3JpyUsd;
let mockTellorCaller;
let mockRoundCount = 0;

type ChainLinKNumberType = {
    ethInUsd: number;
    jpyInUsd: number;
}
type PriceType = {
    chainlink: ChainLinKNumberType;
    tellor: number;
}
type SilenceType = {
    chainlink: ChainLinKNumberType;
    tellor: number;
}
type MockConf = {
    price: PriceType;
    silentFor: SilenceType;
}
async function setMocks(conf: MockConf){
    const CHAINLINK_DIGITS = 8;
    const TELLOR_DIGITS = 6;
    let cPriceEthInUsd = BigNumber.from(conf.price.chainlink.ethInUsd).mul(BigNumber.from(10).pow(CHAINLINK_DIGITS));
    let cPriceJpyInUsd = BigNumber.from(conf.price.chainlink.jpyInUsd * (10 ** CHAINLINK_DIGITS));
    let tPrice = BigNumber.from(conf.price.tellor).mul(BigNumber.from(10).pow(TELLOR_DIGITS))
    let cDiffEthInUsd = conf.silentFor.chainlink.ethInUsd; // TIMEOUT = 14400 secs
    let cDiffJpyInUsd = conf.silentFor.chainlink.jpyInUsd;
    let tDiff = conf.silentFor.tellor;

    let now = Math.ceil(Date.now()/1000)
    if(feed){
        let block = await feed.provider.getBlock("latest")
        now = block.timestamp
    }


    mockRoundCount++;
    mockAggregatorV3EthUsd.smocked.decimals.will.return.with(CHAINLINK_DIGITS); // uint8
    mockAggregatorV3EthUsd.smocked.latestRoundData.will.return.with([mockRoundCount,cPriceEthInUsd,now-cDiffEthInUsd,now-cDiffEthInUsd,2]); // uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound
    mockAggregatorV3EthUsd.smocked['getRoundData(uint80)'].will.return.with([mockRoundCount,cPriceEthInUsd,now-cDiffEthInUsd,now-cDiffEthInUsd,mockRoundCount+1]); // uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound
    mockAggregatorV3JpyUsd.smocked.decimals.will.return.with(CHAINLINK_DIGITS); // uint8
    mockAggregatorV3JpyUsd.smocked.latestRoundData.will.return.with([mockRoundCount,cPriceJpyInUsd,now-cDiffJpyInUsd,now-cDiffJpyInUsd,2]); // uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound
    mockAggregatorV3JpyUsd.smocked['getRoundData(uint80)'].will.return.with([mockRoundCount,cPriceJpyInUsd,now-cDiffJpyInUsd,now-cDiffJpyInUsd,mockRoundCount+1]); // uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound
    mockTellorCaller.smocked.getTellorCurrentValue.will.return.with([true,tPrice,now-tDiff]); // bool ifRetrieve, uint256 value, uint256 _timestampRetrieved
}
describe("PriceFeed", function() {
  beforeEach(async () => {
    accounts = await getSharedSigners();
    const spec1 = await ethers.getContractFactory('ChainLinkMock')
    const spec2 = await ethers.getContractFactory('ChainLinkMock')
    const spec3 = await ethers.getContractFactory('TellorCallerMock')
    mockAggregatorV3EthUsd = await smockit(spec1) // https://github.com/liquity/dev/blob/main/packages/contracts/contracts/Dependencies/AggregatorV3Interface.sol
    mockAggregatorV3JpyUsd = await smockit(spec2)
    mockTellorCaller = await smockit(spec3) // https://github.com/liquity/dev/blob/main/packages/contracts/contracts/Interfaces/ITellorCaller.sol

    await setMocks({ price: { chainlink: { ethInUsd: 3200, jpyInUsd: 0.0091 }, tellor: 351648 }, silentFor: { chainlink: { ethInUsd: 7200, jpyInUsd: 7200 }, tellor: 7200} })

    feed = await (await ethers.getContractFactory('PriceFeed')).deploy(
        mockAggregatorV3EthUsd.address,
        mockAggregatorV3JpyUsd.address,
        mockTellorCaller.address
    );
  });

  describe("fetchPrice()", function() {
    it(`succeeds to get price from ChainLink`, async function() {
        let cPriceAtExecInEthUsd = 3201
        let cPriceAtExecInJpyUsd = 0.0091
        let tPriceAtExecInJpyUsd = 351649
        await setMocks({ price: { chainlink: { ethInUsd: cPriceAtExecInEthUsd, jpyInUsd: cPriceAtExecInJpyUsd }, tellor: tPriceAtExecInJpyUsd }, silentFor: { chainlink: { ethInUsd: 7200, jpyInUsd: 7200 }, tellor: 7200} })
        await (await feed.fetchPrice()).wait()
        const status = await feed.status()
        const lastGoodPrice = await feed.lastGoodPrice();
        betterexpect(Math.floor(cPriceAtExecInEthUsd/cPriceAtExecInJpyUsd)).toEqBN(`${lastGoodPrice}`.substr(0,6));
        betterexpect(status).toBe(0);
        /*
            enum Status {
                chainlinkWorking,
                usingTellorChainlinkUntrusted,
                bothOraclesUntrusted,
                usingTellorChainlinkFrozen,
                usingChainlinkTellorUntrusted
            }
        */
        });

    it(`succeeds to get price from Tellor because ChainLink is frozen`, async function() {
        feed.provider.send("evm_increaseTime", [7200])
        feed.provider.send("evm_mine")

        let cPriceAtExecInEthUsd = 3202
        let cPriceAtExecInJpyUsd = 0.0091
        let tPriceAtExecInJpyUsd = 351650
        await setMocks({ price: { chainlink: { ethInUsd: cPriceAtExecInEthUsd, jpyInUsd: cPriceAtExecInJpyUsd }, tellor: tPriceAtExecInJpyUsd }, silentFor: { chainlink: { ethInUsd: 14401, jpyInUsd: 14401 }, tellor: 3600} })
        await (await feed.fetchPrice()).wait()
        const status = await feed.status()
        const lastGoodPrice = await feed.lastGoodPrice();
        betterexpect(status).toBe(3);
        betterexpect(BigNumber.from(tPriceAtExecInJpyUsd).mul(BigNumber.from(10).pow(18))).toEqBN(lastGoodPrice);
    });

    it(`returns last good price as both oracles are untrusted`, async function() {
        // 1. Timeout setting
        feed.provider.send("evm_increaseTime", [7200])
        feed.provider.send("evm_mine")

        // 2. Set lastGoodPrice
        let cPriceAtLastTimeInEthUsd = 3203
        let cPriceAtLastTimeInJpyUsd = 0.0091
        let tPriceAtLastTimeInJpyUsd = 351651
        await setMocks({ price: { chainlink: { ethInUsd: cPriceAtLastTimeInEthUsd, jpyInUsd: cPriceAtLastTimeInJpyUsd }, tellor: tPriceAtLastTimeInJpyUsd }, silentFor: { chainlink: { ethInUsd: 2000, jpyInUsd: 2000 }, tellor: 2000} })
        await (await feed.fetchPrice()).wait()
        const status1 = await feed.status();
        const lastGoodPrice1 = await feed.lastGoodPrice();
        betterexpect(status1).toBe(0);
        betterexpect(Math.floor(cPriceAtLastTimeInEthUsd/cPriceAtLastTimeInJpyUsd)).toEqBN(`${lastGoodPrice1}`.substr(0,6));

        // 3. Exec
        let cPriceAtExecInEthUsd = 3204
        let cPriceAtExecInJpyUsd = 0.0091
        let tPriceAtExecInJpyUsd = 351652
        await setMocks({ price: { chainlink: { ethInUsd: cPriceAtExecInEthUsd, jpyInUsd: cPriceAtExecInJpyUsd }, tellor: tPriceAtExecInJpyUsd }, silentFor: { chainlink: { ethInUsd: 14401, jpyInUsd: 14401 }, tellor: 14401} })
        await (await feed.fetchPrice()).wait()
        const status2 = await feed.status();
        const lastGoodPrice2 = await feed.lastGoodPrice();
        betterexpect(status2).toBe(2);
        betterexpect(Math.floor(cPriceAtLastTimeInEthUsd/cPriceAtLastTimeInJpyUsd)).toEqBN(`${lastGoodPrice2}`.substr(0,6));
    });

  });


});

describe("PriceFeed - Scenario test", function() {
  beforeEach(async () => {
    accounts = await getSharedSigners();
    const spec1 = await ethers.getContractFactory('ChainLinkMock')
    const spec2 = await ethers.getContractFactory('ChainLinkMock')
    const spec3 = await ethers.getContractFactory('TellorCallerMock')

    const ChainLinkMockEthUsd:ChainLinkMock = await create<ChainLinkMock>("ChainLinkMock", genABI("ChainLinkMock"), ["ETH/USD"], accounts[0]);
    const ChainLinkMockJpyUsd:ChainLinkMock = await create<ChainLinkMock>("ChainLinkMock", genABI("ChainLinkMock"), ["JPY/USD"], accounts[0]);
    const TellorCallerMock:TellorCallerMock = await create<TellorCallerMock>("TellorCallerMock", genABI("TellorCallerMock"), [], accounts[0]);

    await ChainLinkMockEthUsd.connect(accounts[0]).latestRoundData({gasLimit:15000000});
    await ChainLinkMockJpyUsd.connect(accounts[0]).latestRoundData({gasLimit:15000000});

    feed = await (await ethers.getContractFactory('PriceFeed')).deploy(
      ChainLinkMockEthUsd.address,
      ChainLinkMockJpyUsd.address,
      TellorCallerMock.address
    );
  });

  describe("fetchPrice()", function() {
    it(`succeeds to get price from ChainLink`, async function() {
        await (await feed.connect(accounts[0]).fetchPrice({gasLimit:15000000})).wait()
        const status = await feed.status()
        const lastGoodPrice = await feed.lastGoodPrice();
        betterexpect(lastGoodPrice).toBeGtBN(0);
        betterexpect(status).toBe(0);
        /*
            enum Status {
                chainlinkWorking,
                usingTellorChainlinkUntrusted,
                bothOraclesUntrusted,
                usingTellorChainlinkFrozen,
                usingChainlinkTellorUntrusted
            }
        */
      });

    });

});
