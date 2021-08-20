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
function setMocks(_price){
    const now = Math.ceil(Date.now()/1000) - 14400/2; // TIMEOUT = 14400 secs
    mockAggregatorV3.smocked.decimals.will.return.with(18); // uint8
    mockAggregatorV3.smocked.latestRoundData.will.return.with([2,_price,now,now,2]); // uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound
    mockAggregatorV3.smocked['getRoundData(uint80)'].will.return.with([2,_price,now,now,2]); // uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound
    mockTellorCaller.smocked['getTellorCurrentValue(uint256)'].will.return.with([true,_price,now]); // bool ifRetrieve, uint256 value, uint256 _timestampRetrieved

}
describe("PriceFeed", function() {
  beforeEach(async () => {
    accounts = await getSharedSigners();
    const spec1 = await ethers.getContractFactory('ChainlinkMock')
    const spec2 = await ethers.getContractFactory('TellorCallerMock')
    mockAggregatorV3 = await smockit(spec1) // https://github.com/liquity/dev/blob/main/packages/contracts/contracts/Dependencies/AggregatorV3Interface.sol
    mockTellorCaller = await smockit(spec2) // https://github.com/liquity/dev/blob/main/packages/contracts/contracts/Interfaces/ITellorCaller.sol

    setMocks(110)

    feed = await (await ethers.getContractFactory('PriceFeed')).deploy(
        mockAggregatorV3.address,
        mockTellorCaller.address
    );

  });

  describe("fetchPrice()", function() {
    it(`succeeds to fetch`, async function() {
        setMocks(111)
        let tx = await feed.fetchPrice();
        let res = await tx.wait();
        console.log(BigNumber.from(res.logs[1].data).toString());
    });

    it.skip(`fails fetch`, async function() {
    });

  });


});
