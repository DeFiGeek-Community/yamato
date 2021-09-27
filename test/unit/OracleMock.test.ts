import { ethers } from "hardhat";
import { smock } from "@defi-wonderland/smock";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { BigNumber } from "ethers";
import {
  ChainLinkMock,
  ChainLinkMock__factory,
  TellorCallerMock,
  TellorCallerMock__factory,
} from "../../typechain";

chai.use(smock.matchers);
chai.use(solidity);

let chainlinkMockEthUsd: ChainLinkMock;
let chainlinkMockJpyUsd: ChainLinkMock;
let tellorCallerMockEthJpy: TellorCallerMock;
let ethUsdDefaultPrice = 300000000000;
let jpyUsdDefaultPrice = 1000000;
let ethJpyDefaultPrice = 300000000000;
let chainlinkInitialRoundId = "30000000000000000001";
let priceDeviationRange = 0.01;

describe("OracleMockBase", function () {
  beforeEach(async () => {
    const spec1 = <ChainLinkMock__factory>(
      await ethers.getContractFactory("ChainLinkMock")
    );
    chainlinkMockEthUsd = await spec1.deploy("ETH/USD");
  });

  describe("setLastPrice()", function () {
    it(`succeeds to set a last price for arbitrary number`, async function () {
      const ethUsdLastPrice = 320000000000;
      await chainlinkMockEthUsd.setLastPrice(ethUsdLastPrice);
      let [roundId, answerEthUsd, startedAt, updatedAt, answeredInRound] =
        await chainlinkMockEthUsd.latestRoundData();
      expect(answerEthUsd.toNumber()).to.eq(ethUsdLastPrice);
    });
  });
});

describe("ChainlinkMock", function () {
  beforeEach(async () => {
    const spec1 = <ChainLinkMock__factory>(
      await ethers.getContractFactory("ChainLinkMock")
    );
    const spec2 = <ChainLinkMock__factory>(
      await ethers.getContractFactory("ChainLinkMock")
    );
    chainlinkMockEthUsd = await spec1.deploy("ETH/USD");
    chainlinkMockJpyUsd = await spec2.deploy("JPY/USD");
  });

  describe("decimals()", function () {
    it(`succeeds to get decimals from Chainlink`, async function () {
      // decimals for both ETH/USD and JPY/USD should be 8
      const decimalsEthUsd = await chainlinkMockEthUsd.decimals();
      expect(decimalsEthUsd).to.eq(8);
      const decimalsJpyUsd = await chainlinkMockJpyUsd.decimals();
      expect(decimalsJpyUsd).to.eq(8);
    });
  });

  describe("setPriceToDefault()", function () {
    it(`succeeds to set a default price for the two Chainlink instances`, async function () {
      // change the last price then call the set to default function
      const ethUsdLastPrice = 320000000000;
      await chainlinkMockEthUsd.setLastPrice(ethUsdLastPrice);
      await chainlinkMockEthUsd.setPriceToDefault();

      let [roundId, answerEthUsd, startedAt, updatedAt, answeredInRound] =
        await chainlinkMockEthUsd.latestRoundData();
      expect(answerEthUsd.toNumber()).to.eq(ethUsdDefaultPrice);
      expect(roundId.toString()).to.eq(chainlinkInitialRoundId);

      const jpyUsdLastPrice = 1100000;
      await chainlinkMockJpyUsd.setLastPrice(jpyUsdLastPrice);
      await chainlinkMockJpyUsd.setPriceToDefault();

      let [roundId2, answerJpyUsd, startedAt2, updatedAt2, answeredInRound2] =
        await chainlinkMockJpyUsd.latestRoundData();
      expect(answerJpyUsd.toNumber()).to.eq(jpyUsdDefaultPrice);
      expect(roundId2.toString()).to.eq(chainlinkInitialRoundId);
    });
  });

  describe("latestRoundData()", function () {
    it(`succeeds to get a price from Chainlink`, async function () {
      // the prices shall be equal to the default prices
      let [roundId, answerEthUsd, startedAt, updatedAt, answeredInRound] =
        await chainlinkMockEthUsd.latestRoundData();
      expect(answerEthUsd.toNumber()).to.eq(ethUsdDefaultPrice);
      expect(roundId.toString()).to.eq(chainlinkInitialRoundId);

      let [roundId2, answerJpyUsd, startedAt2, updatedAt2, answeredInRound2] =
        await chainlinkMockJpyUsd.latestRoundData();
      expect(answerJpyUsd.toNumber()).to.eq(jpyUsdDefaultPrice);
      expect(roundId2.toString()).to.eq(chainlinkInitialRoundId);
    });
  });

  describe("simulatePriceMove()", function () {
    it(`succeeds to update a price for Chainlink`, async function () {
      // the price deviation shall be within 1% range.
      // the roundId shall be incremented.
      let nextRoundId = BigNumber.from(chainlinkInitialRoundId)
        .add(1)
        .toString();

      await chainlinkMockEthUsd.simulatePriceMove();
      let [roundId, answerEthUsd, startedAt, updatedAt, answeredInRound] =
        await chainlinkMockEthUsd.latestRoundData();
      const lowerRangeEthUsd = ethUsdDefaultPrice * (1 - priceDeviationRange);
      const upperRangeEthUsd = ethUsdDefaultPrice * (1 + priceDeviationRange);
      chai
        .expect(answerEthUsd)
        .to.be.within(lowerRangeEthUsd, upperRangeEthUsd);
      expect(roundId.toString()).to.eq(nextRoundId);

      await chainlinkMockJpyUsd.simulatePriceMove();
      let [roundId2, answerJpyUsd, startedAt2, updatedAt2, answeredInRound2] =
        await chainlinkMockJpyUsd.latestRoundData();
      const lowerRangeJpyUsd = jpyUsdDefaultPrice * (1 - priceDeviationRange);
      const upperRangeJpyUsd = jpyUsdDefaultPrice * (1 + priceDeviationRange);
      chai
        .expect(answerJpyUsd)
        .to.be.within(lowerRangeJpyUsd, upperRangeJpyUsd);
      expect(roundId2.toString()).to.eq(nextRoundId);
    });
  });
});

describe("TellorCallerMock", function () {
  beforeEach(async () => {
    const spec = <TellorCallerMock__factory>(
      await ethers.getContractFactory("TellorCallerMock")
    );
    tellorCallerMockEthJpy = await spec.deploy();
  });

  describe("setPriceToDefault()", function () {
    it(`succeeds to set a default price for the Tellor instance`, async function () {
      // change the last price then call the set to default function
      const ethJpyLastPrice = 320000000000;
      await tellorCallerMockEthJpy.setLastPrice(ethJpyLastPrice);

      await tellorCallerMockEthJpy.setPriceToDefault();

      let [ifRetrieve, ethJpyValue, timestampRetrieved] =
        await tellorCallerMockEthJpy.getTellorCurrentValue(59);
      expect(ethJpyValue.toNumber()).to.eq(ethJpyDefaultPrice);
    });
  });

  describe("getTellorCurrentValue()", function () {
    it(`succeeds to get a price from Tellor`, async function () {
      // the prices shall be equal to the default prices
      let [ifRetrieve, ethJpyValue, timestampRetrieved] =
        await tellorCallerMockEthJpy.getTellorCurrentValue(59);
      expect(ethJpyValue.toNumber()).to.eq(ethJpyDefaultPrice);
    });
  });

  describe("simulatePriceMove()", function () {
    it(`succeeds to update a price for Tellor`, async function () {
      // the price deviation shall be within 1% range.
      await tellorCallerMockEthJpy.simulatePriceMove();
      let [ifRetrieve, ethJpyValue, timestampRetrieved] =
        await tellorCallerMockEthJpy.getTellorCurrentValue(59);
      const lowerRangeEthJpy = ethJpyDefaultPrice * (1 - priceDeviationRange);
      const upperRangeEthJpy = ethJpyDefaultPrice * (1 + priceDeviationRange);
      expect(ethJpyValue).to.be.within(lowerRangeEthJpy, upperRangeEthJpy);
    });
  });
});
