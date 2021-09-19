import { ethers } from 'hardhat'
import { smockit, smoddit, isMockContract } from 'optimism/packages/smock';
import { BigNumber, utils } from 'ethers';
const { AbiCoder, ParamType } = utils;
import chai from "chai";
import { solidity } from "ethereum-waffle";
chai.use(solidity);

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
import { ChainLinkMock, TellorCallerMock } from '../../typechain'; 

import { genABI } from '@src/genABI';

let chainlinkMockEthUsd;
let chainlinkMockJpyUsd;
let tellorCallerMockEthJpy;
let ethUsdDefaultPrice = 300000000000
let jpyUsdDefaultPrice = 1000000
let ethJpyDefaultPrice = 300000000000
let chainlinkInitialRoundId = "30000000000000000001"
let priceDeviationRange = 0.01
let tellorMock;
let accounts;
let mockRoundCount = 0;

describe("OracleMockBase", function() {
  beforeEach(async () => {
    const spec1 = await ethers.getContractFactory('ChainLinkMock')
    chainlinkMockEthUsd = await spec1.deploy("ETH/USD");
  });

  describe("setLastPrice()", function() {
    it (`succeeds to set a last price for arbitrary number`, async function() {
      const ethUsdLastPrice = 320000000000;
      await chainlinkMockEthUsd.setLastPrice(ethUsdLastPrice);
      let [roundId, answerEthUsd, startedAt, updatedAt, answeredInRound] = await chainlinkMockEthUsd.latestRoundData()
      betterexpect(answerEthUsd.toNumber()).toBe(ethUsdLastPrice);
    });
  });
});

describe("ChainlinkMock", function() {
  beforeEach(async () => {
    const spec1 = await ethers.getContractFactory('ChainLinkMock')
    const spec2 = await ethers.getContractFactory('ChainLinkMock')
    chainlinkMockEthUsd = await spec1.deploy("ETH/USD");
    chainlinkMockJpyUsd = await spec2.deploy("JPY/USD");
  });

  describe("decimals()", function() {
    it (`succeeds to get decimals from Chainlink`, async function() {
      // decimals for both ETH/USD and JPY/USD should be 8
      const decimalsEthUsd = await chainlinkMockEthUsd.decimals()
      betterexpect(decimalsEthUsd).toBe(8);
      const decimalsJpyUsd = await chainlinkMockJpyUsd.decimals()
      betterexpect(decimalsJpyUsd).toBe(8);
    });
  });

  describe("setPriceToDefault()", function() {
    it (`succeeds to set a default price for the two Chainlink instances`, async function() {
      // change the last price then call the set to default function
      const ethUsdLastPrice = 320000000000;
      await chainlinkMockEthUsd.setLastPrice(ethUsdLastPrice);
      await chainlinkMockEthUsd.setPriceToDefault();

      let [roundId, answerEthUsd, startedAt, updatedAt, answeredInRound] = await chainlinkMockEthUsd.latestRoundData()
      betterexpect(answerEthUsd.toNumber()).toBe(ethUsdDefaultPrice);
      betterexpect(roundId.toString()).toBe(chainlinkInitialRoundId);

      const jpyUsdLastPrice = 1100000;
      await chainlinkMockJpyUsd.setLastPrice(jpyUsdLastPrice);
      await chainlinkMockJpyUsd.setPriceToDefault();

      let [roundId2, answerJpyUsd, startedAt2, updatedAt2, answeredInRound2] = await chainlinkMockJpyUsd.latestRoundData()
      betterexpect(answerJpyUsd.toNumber()).toBe(jpyUsdDefaultPrice);
      betterexpect(roundId2.toString()).toBe(chainlinkInitialRoundId);
    });
  });

  describe("latestRoundData()", function() {
    it (`succeeds to get a price from Chainlink`, async function() {
      // the prices shall be equal to the default prices
      let [roundId, answerEthUsd, startedAt, updatedAt, answeredInRound] = await chainlinkMockEthUsd.latestRoundData()
      betterexpect(answerEthUsd.toNumber()).toBe(ethUsdDefaultPrice);
      betterexpect(roundId.toString()).toBe(chainlinkInitialRoundId);

      let [roundId2, answerJpyUsd, startedAt2, updatedAt2, answeredInRound2] = await chainlinkMockJpyUsd.latestRoundData()
      betterexpect(answerJpyUsd.toNumber()).toBe(jpyUsdDefaultPrice);
      betterexpect(roundId2.toString()).toBe(chainlinkInitialRoundId);
    });
  });

  describe("simulatePriceMove()", function() {
    it (`succeeds to update a price for Chainlink`, async function() {
      // the price deviation shall be within 1% range.
      // the roundId shall be incremented.
      let nextRoundId = BigNumber.from(chainlinkInitialRoundId).add(1).toString()

      await chainlinkMockEthUsd.simulatePriceMove()
      let [roundId, answerEthUsd, startedAt, updatedAt, answeredInRound] = await chainlinkMockEthUsd.latestRoundData()
      const lowerRangeEthUsd = ethUsdDefaultPrice * (1 - priceDeviationRange)
      const upperRangeEthUsd = ethUsdDefaultPrice * (1 + priceDeviationRange)
      chai.expect(answerEthUsd).to.be.within(lowerRangeEthUsd, upperRangeEthUsd);
      betterexpect(roundId.toString()).toBe(nextRoundId);

      await chainlinkMockJpyUsd.simulatePriceMove()
      let [roundId2, answerJpyUsd, startedAt2, updatedAt2, answeredInRound2] = await chainlinkMockJpyUsd.latestRoundData()
      const lowerRangeJpyUsd = jpyUsdDefaultPrice * (1 - priceDeviationRange)
      const upperRangeJpyUsd = jpyUsdDefaultPrice * (1 + priceDeviationRange)
      chai.expect(answerJpyUsd).to.be.within(lowerRangeJpyUsd, upperRangeJpyUsd);
      betterexpect(roundId2.toString()).toBe(nextRoundId);
    });
  });
});

describe("TellorCallerMock", function() {
    beforeEach(async () => {
      const spec = await ethers.getContractFactory('TellorCallerMock')
      tellorCallerMockEthJpy = await spec.deploy();
    });
  
    describe("setPriceToDefault()", function() {
      it (`succeeds to set a default price for the Tellor instance`, async function() {
        // change the last price then call the set to default function
        const ethJpyLastPrice = 320000000000;
        await tellorCallerMockEthJpy.setLastPrice(ethJpyLastPrice);

        await tellorCallerMockEthJpy.setPriceToDefault();
  
        let [ifRetrieve, ethJpyValue, timestampRetrieved] = await tellorCallerMockEthJpy.getTellorCurrentValue(59)
        betterexpect(ethJpyValue.toNumber()).toBe(ethJpyDefaultPrice);
      });
    });
  
    describe("getTellorCurrentValue()", function() {
      it (`succeeds to get a price from Tellor`, async function() {
        // the prices shall be equal to the default prices
        let [ifRetrieve, ethJpyValue, timestampRetrieved] = await tellorCallerMockEthJpy.getTellorCurrentValue(59)
        betterexpect(ethJpyValue.toNumber()).toBe(ethJpyDefaultPrice);
      });
    });
  
    describe("simulatePriceMove()", function() {
      it (`succeeds to update a price for Chainlink`, async function() {
        // the price deviation shall be within 1% range.
        await tellorCallerMockEthJpy.simulatePriceMove()
        let [ifRetrieve, ethJpyValue, timestampRetrieved] = await tellorCallerMockEthJpy.getTellorCurrentValue(59)
        const lowerRangeEthJpy = ethJpyDefaultPrice * (1 - priceDeviationRange)
        const upperRangeEthJpy = ethJpyDefaultPrice * (1 + priceDeviationRange)
        chai.expect(ethJpyValue).to.be.within(lowerRangeEthJpy, upperRangeEthJpy);
      });
    });
});