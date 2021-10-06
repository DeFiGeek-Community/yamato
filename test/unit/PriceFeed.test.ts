import { ethers } from "hardhat";
import { FakeContract, smock } from "@defi-wonderland/smock";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { Signer, BigNumber } from "ethers";
import {
  ChainLinkMock,
  PriceFeed,
  PriceFeed__factory,
  TellorCallerMock,
} from "../../typechain";

chai.use(smock.matchers);
chai.use(solidity);

let feed: PriceFeed;
let accounts: Signer[];
let ownerAddress: string;
let mockAggregatorV3EthUsd: FakeContract<ChainLinkMock>;
let mockAggregatorV3JpyUsd: FakeContract<ChainLinkMock>;
let mockTellorCaller: FakeContract<TellorCallerMock>;
let mockRoundCount = 0;

type ChainLinKNumberType = {
  ethInUsd: number;
  jpyInUsd: number;
};
type PriceType = {
  chainlink: ChainLinKNumberType;
  tellor: number;
};
type SilenceType = {
  chainlink: ChainLinKNumberType;
  tellor: number;
};
type MockConf = {
  price: PriceType;
  silentFor: SilenceType;
};
const CHAINLINK_DIGITS = 8;
const TELLOR_DIGITS = 6;
async function setMocks(conf: MockConf) {
  let cPriceEthInUsd = BigNumber.from(conf.price.chainlink.ethInUsd).mul(
    BigNumber.from(10).pow(CHAINLINK_DIGITS)
  );
  let cPriceJpyInUsd = BigNumber.from(
    conf.price.chainlink.jpyInUsd * 10 ** CHAINLINK_DIGITS
  );
  let tPrice = BigNumber.from(conf.price.tellor).mul(
    BigNumber.from(10).pow(TELLOR_DIGITS)
  );
  let cDiffEthInUsd = conf.silentFor.chainlink.ethInUsd; // TIMEOUT = 14400 secs
  let cDiffJpyInUsd = conf.silentFor.chainlink.jpyInUsd;
  let tDiff = conf.silentFor.tellor;

  let now = Math.ceil(Date.now() / 1000);
  if (feed) {
    let block = await feed.provider.getBlock("latest");
    now = block.timestamp;
  }

  mockRoundCount++;
  mockAggregatorV3EthUsd.decimals.returns(CHAINLINK_DIGITS); // uint8
  mockAggregatorV3EthUsd.latestRoundData.returns([
    mockRoundCount,
    cPriceEthInUsd,
    now - cDiffEthInUsd,
    now - cDiffEthInUsd,
    2,
  ]); // uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound
  mockAggregatorV3EthUsd.getRoundData.returns([
    mockRoundCount,
    cPriceEthInUsd,
    now - cDiffEthInUsd,
    now - cDiffEthInUsd,
    mockRoundCount + 1,
  ]); // uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound
  mockAggregatorV3JpyUsd.decimals.returns(CHAINLINK_DIGITS); // uint8
  mockAggregatorV3JpyUsd.latestRoundData.returns([
    mockRoundCount,
    cPriceJpyInUsd,
    now - cDiffJpyInUsd,
    now - cDiffJpyInUsd,
    2,
  ]); // uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound
  mockAggregatorV3JpyUsd.getRoundData.returns([
    mockRoundCount,
    cPriceJpyInUsd,
    now - cDiffJpyInUsd,
    now - cDiffJpyInUsd,
    mockRoundCount + 1,
  ]); // uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound
  mockTellorCaller.getTellorCurrentValue.returns([true, tPrice, now - tDiff]); // bool ifRetrieve, uint256 value, uint256 _timestampRetrieved
}
describe("PriceFeed", function () {
  beforeEach(async () => {
    accounts = await ethers.getSigners();
    ownerAddress = await accounts[0].getAddress();
    // https://github.com/liquity/dev/blob/main/packages/contracts/contracts/Dependencies/AggregatorV3Interface.sol
    mockAggregatorV3EthUsd = await smock.fake<ChainLinkMock>("ChainLinkMock");
    mockAggregatorV3JpyUsd = await smock.fake<ChainLinkMock>("ChainLinkMock");
    // https://github.com/liquity/dev/blob/main/packages/contracts/contracts/Interfaces/ITellorCaller.sol
    mockTellorCaller = await smock.fake<TellorCallerMock>("TellorCallerMock");

    await setMocks({
      price: {
        chainlink: { ethInUsd: 3200, jpyInUsd: 0.0091 },
        tellor: 351648,
      },
      silentFor: {
        chainlink: { ethInUsd: 7200, jpyInUsd: 7200 },
        tellor: 7200,
      },
    });

    feed = await (<PriceFeed__factory>(
      await ethers.getContractFactory("PriceFeed")
    )).deploy(
      mockAggregatorV3EthUsd.address,
      mockAggregatorV3JpyUsd.address,
      mockTellorCaller.address
    );
  });

  describe("fetchPrice()", function () {
    it(`succeeds to get dec18 price from ChainLink`, async function () {
      let cPriceAtExecInEthUsd = 3201;
      let cPriceAtExecInJpyUsd = 0.0091;
      let tPriceAtExecInJpyUsd = 351649;
      await setMocks({
        price: {
          chainlink: {
            ethInUsd: cPriceAtExecInEthUsd,
            jpyInUsd: cPriceAtExecInJpyUsd,
          },
          tellor: tPriceAtExecInJpyUsd,
        },
        silentFor: {
          chainlink: { ethInUsd: 7200, jpyInUsd: 7200 },
          tellor: 7200,
        },
      });
      await (await feed.fetchPrice()).wait();
      const status = await feed.status();
      const lastGoodPrice = await feed.lastGoodPrice();
      const localPrice = BigNumber.from(cPriceAtExecInEthUsd).mul(BigNumber.from(10).pow(18 - CHAINLINK_DIGITS + CHAINLINK_DIGITS)).div(BigNumber.from(cPriceAtExecInJpyUsd*10000)).mul(10000);
      expect(status).to.eq(0);
      expect(lastGoodPrice.toString().length).to.eq(localPrice.toString().length)
      expect(`${localPrice}`.slice(0, 6)).to.eq(`${lastGoodPrice}`.slice(0, 6));
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

    it(`succeeds to get price from Tellor because ChainLink is frozen`, async function () {
      (<any>feed.provider).send("evm_increaseTime", [7200]);
      (<any>feed.provider).send("evm_mine");

      let cPriceAtExecInEthUsd = 3202;
      let cPriceAtExecInJpyUsd = 0.0091;
      let tPriceAtExecInJpyUsd = 351650;
      await setMocks({
        price: {
          chainlink: {
            ethInUsd: cPriceAtExecInEthUsd,
            jpyInUsd: cPriceAtExecInJpyUsd,
          },
          tellor: tPriceAtExecInJpyUsd,
        },
        silentFor: {
          chainlink: { ethInUsd: 14401, jpyInUsd: 14401 },
          tellor: 3600,
        },
      });
      await (await feed.fetchPrice()).wait();
      const status = await feed.status();
      const lastGoodPrice = await feed.lastGoodPrice();
      expect(status).to.eq(3);
      expect(
        BigNumber.from(tPriceAtExecInJpyUsd).mul(1e18+"")
      ).to.eq(lastGoodPrice);
    });

    it(`returns last good price as both oracles are untrusted`, async function () {
      // 1. Timeout setting
      (<any>feed.provider).send("evm_increaseTime", [7200]);
      (<any>feed.provider).send("evm_mine");

      // 2. Set lastGoodPrice
      let cPriceAtLastTimeInEthUsd = 3203;
      let cPriceAtLastTimeInJpyUsd = 0.0091;
      let tPriceAtLastTimeInJpyUsd = 351651;
      await setMocks({
        price: {
          chainlink: {
            ethInUsd: cPriceAtLastTimeInEthUsd,
            jpyInUsd: cPriceAtLastTimeInJpyUsd,
          },
          tellor: tPriceAtLastTimeInJpyUsd,
        },
        silentFor: {
          chainlink: { ethInUsd: 2000, jpyInUsd: 2000 },
          tellor: 2000,
        },
      });
      await (await feed.fetchPrice()).wait();
      const status1 = await feed.status();
      const lastGoodPrice1 = await feed.lastGoodPrice();
      expect(status1).to.eq(0);
      expect(
        Math.floor(
          cPriceAtLastTimeInEthUsd / cPriceAtLastTimeInJpyUsd
        ).toString()
      ).to.eq(`${lastGoodPrice1}`.substr(0, 6));

      // 3. Exec
      let cPriceAtExecInEthUsd = 3204;
      let cPriceAtExecInJpyUsd = 0.0091;
      let tPriceAtExecInJpyUsd = 351652;
      await setMocks({
        price: {
          chainlink: {
            ethInUsd: cPriceAtExecInEthUsd,
            jpyInUsd: cPriceAtExecInJpyUsd,
          },
          tellor: tPriceAtExecInJpyUsd,
        },
        silentFor: {
          chainlink: { ethInUsd: 14401, jpyInUsd: 14401 },
          tellor: 14401,
        },
      });
      await (await feed.fetchPrice()).wait();
      const status2 = await feed.status();
      const lastGoodPrice2 = await feed.lastGoodPrice();
      expect(status2).to.eq(2);
      expect(
        Math.floor(
          cPriceAtLastTimeInEthUsd / cPriceAtLastTimeInJpyUsd
        ).toString()
      ).to.eq(`${lastGoodPrice2}`.substr(0, 6));
    });
  });
});
