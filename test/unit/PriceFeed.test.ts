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
async function setMocks(_price, conf){
    let now = Math.ceil(Date.now()/1000); 
    if(feed){
        let block = await feed.provider.getBlock("latest")
        now = block.timestamp
    }

    let cDiff = 0; // TIMEOUT = 14400 secs
    let tDiff = 0;
    if(conf.length > 0){
        let confs = conf.split("&")
        for(var i = 0; i < confs.length; i++){
            let arr = confs[i].split("=");
            if (arr[0] == "chainlink") {
                cDiff += parseInt(arr[1]);
            } else if (arr[0] == "tellor") {
                tDiff += parseInt(arr[1]);
            } else {
                throw new Error("Weird conf");
            }    
        }
    }

    mockRoundCount++;
    mockAggregatorV3.smocked.decimals.will.return.with(18); // uint8
    mockAggregatorV3.smocked.latestRoundData.will.return.with([mockRoundCount,_price,now-cDiff,now-cDiff,2]); // uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound
    mockAggregatorV3.smocked['getRoundData(uint80)'].will.return.with([mockRoundCount,_price,now-cDiff,now-cDiff,mockRoundCount+1]); // uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound
    mockTellorCaller.smocked.getTellorCurrentValue.will.return.with([true,_price,now-tDiff]); // bool ifRetrieve, uint256 value, uint256 _timestampRetrieved
}
describe("PriceFeed", function() {
  beforeEach(async () => {
    accounts = await getSharedSigners();
    const spec1 = await ethers.getContractFactory('ChainlinkMock')
    const spec2 = await ethers.getContractFactory('TellorCallerMock')
    mockAggregatorV3 = await smockit(spec1) // https://github.com/liquity/dev/blob/main/packages/contracts/contracts/Dependencies/AggregatorV3Interface.sol
    mockTellorCaller = await smockit(spec2) // https://github.com/liquity/dev/blob/main/packages/contracts/contracts/Interfaces/ITellorCaller.sol

    await setMocks(110, "chainlink=7200&tellor=7200")

    feed = await (await ethers.getContractFactory('PriceFeed')).deploy(
        mockAggregatorV3.address,
        mockTellorCaller.address
    );
  });

  describe("fetchPrice()", function() {
    it(`succeeds to get price from ChainLink`, async function() {
        await setMocks(111, "chainlink=7200&tellor=7200")
        let tx = await feed.fetchPrice();
        let res = await tx.wait();
        console.log(BigNumber.from(res.logs[0].data).toString());
    });

    it(`succeeds to get price from Tellor because of `, async function() {
        feed.provider.send("evm_increaseTime", [7200])
        feed.provider.send("evm_mine")
        await setMocks(112, "chainlink=14401&tellor=3600")
        let tx = await feed.fetchPrice();
        let res = await tx.wait();
        console.log(BigNumber.from(res.logs[1].data).toString());
    });

  });


});
