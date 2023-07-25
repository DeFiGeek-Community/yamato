import { ethers } from "hardhat";
import { FakeContract, smock } from "@defi-wonderland/smock";
import chai, { expect } from "chai";
import { Signer, BigNumber } from "ethers";
import {
  ChainLinkMock,
  PriceFeedV3,
  PriceFeedV3__factory,
} from "../../typechain";
import { getProxy } from "../../src/testUtil";

chai.use(smock.matchers);

let feed: PriceFeedV3;
let accounts: Signer[];
let ownerAddress: string;
let mockAggregatorV3EthUsd: FakeContract<ChainLinkMock>;
let mockAggregatorV3JpyUsd: FakeContract<ChainLinkMock>;
let mockRoundCount = 2;
let lastChainLinkAnswer;

type ChainLinKNumberType = {
  ethInUsd: number;
  jpyInUsd: number;
};
type PriceType = {
  chainlink: ChainLinKNumberType;
};
type SilenceType = {
  chainlink: ChainLinKNumberType;
};
type MockConf = {
  price: PriceType;
  silentFor: SilenceType;
  resetFlag?: boolean;
};
const CHAINLINK_DIGITS = 8;
function assertChainlink(price, status, testData) {
  expect(status).to.not.eq(1);
  expect(status).to.not.eq(2);
  expect(status).to.not.eq(3);
  expect(price.toString().slice(0, 6)).to.eq(
    `${
      testData.price.chainlink.ethInUsd / testData.price.chainlink.jpyInUsd
    }`.slice(0, 6)
  );
}

async function setMocks(conf: MockConf) {
  if (conf.resetFlag) {
    mockRoundCount = 2;
    lastChainLinkAnswer = undefined;
  }

  let cPriceEthInUsd = BigNumber.from(conf.price.chainlink.ethInUsd).mul(
    BigNumber.from(10).pow(CHAINLINK_DIGITS)
  );
  if (conf.price.chainlink.ethInUsd == 0) {
    cPriceEthInUsd = BigNumber.from(0);
  }
  let cPriceJpyInUsd = BigNumber.from(
    conf.price.chainlink.jpyInUsd * 10 ** CHAINLINK_DIGITS
  );
  if (conf.price.chainlink.jpyInUsd == 0) {
    cPriceJpyInUsd = BigNumber.from(0);
  }

  let cDiffEthInUsd = conf.silentFor.chainlink.ethInUsd; // TIMEOUT = 3600 secs
  let cDiffJpyInUsd = conf.silentFor.chainlink.jpyInUsd;

  let now = Math.ceil(Date.now() / 1000);
  let block = await (<any>accounts[0].provider).getBlock("latest");
  now = block.timestamp;

  mockAggregatorV3EthUsd.decimals.returns(CHAINLINK_DIGITS); // uint8
  mockAggregatorV3EthUsd.latestRoundData.returns([
    mockRoundCount,
    cPriceEthInUsd,
    now - cDiffEthInUsd /* unused */,
    now - cDiffEthInUsd,
    2 /* unused */,
  ]); // uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound
  mockAggregatorV3EthUsd.getRoundData
    .whenCalledWith(mockRoundCount - 1)
    .returns([
      mockRoundCount - 1,
      lastChainLinkAnswer ? lastChainLinkAnswer : cPriceEthInUsd,
      now - cDiffEthInUsd /* unused */,
      now - cDiffEthInUsd,
      mockRoundCount - 1 /* unused */,
    ]); // uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound
  mockAggregatorV3JpyUsd.decimals.returns(CHAINLINK_DIGITS); // uint8
  mockAggregatorV3JpyUsd.latestRoundData.returns([
    mockRoundCount,
    cPriceJpyInUsd,
    now - cDiffJpyInUsd /* unused */,
    now - cDiffJpyInUsd,
    mockRoundCount /* unused */,
  ]); // uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound
  mockAggregatorV3JpyUsd.getRoundData
    .whenCalledWith(mockRoundCount - 1)
    .returns([
      mockRoundCount - 1,
      cPriceJpyInUsd,
      now - cDiffJpyInUsd /* unused */,
      now - cDiffJpyInUsd,
      mockRoundCount - 1 /* unused */,
    ]); // uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound

  lastChainLinkAnswer = cPriceEthInUsd;
  mockRoundCount++;
}
describe("PriceFeed", function () {
  let lastMockInput;
  beforeEach(async () => {
    accounts = await ethers.getSigners();
    ownerAddress = await accounts[0].getAddress();
    // https://github.com/liquity/dev/blob/main/packages/contracts/contracts/Dependencies/AggregatorV3Interface.sol
    mockAggregatorV3EthUsd = await smock.fake<ChainLinkMock>("ChainLinkMock");
    mockAggregatorV3JpyUsd = await smock.fake<ChainLinkMock>("ChainLinkMock");

    lastMockInput = {
      price: {
        chainlink: { ethInUsd: 3200, jpyInUsd: 0.0091 },
      },
      silentFor: {
        chainlink: { ethInUsd: 1200, jpyInUsd: 7200 },
      },
      resetFlag: true,
    };
    await setMocks(lastMockInput);
    (<any>accounts[0].provider).send("evm_increaseTime", [1200]);
    (<any>accounts[0].provider).send("evm_mine");

    lastMockInput.silentFor.chainlink.ethInUsd = 1000; // Note: To avoid frozen response due to other depending specs
    lastMockInput.silentFor.chainlink.jpyInUsd = 1000;
    lastMockInput.resetFlag = false;
    await setMocks(lastMockInput);

    feed = await getProxy<PriceFeedV3, PriceFeedV3__factory>(
      "PriceFeed",
      [mockAggregatorV3EthUsd.address, mockAggregatorV3JpyUsd.address],
      3
    );

    assertChainlink(
      await feed.getPrice(),
      await feed.getStatus(),
      lastMockInput
    );
  });

  describe("constructor()", function () {
    it(`should NOT revoke ownership`, async function () {
      expect(await feed.governance()).to.eq(await feed.signer.getAddress());
    });
  });

  describe("getPrice()", function () {
    it(`should get chainlink data`, async function () {
      (<any>feed.provider).send("evm_increaseTime", [3200]);
      (<any>feed.provider).send("evm_mine");

      lastMockInput = {
        price: {
          chainlink: { ethInUsd: 3200, jpyInUsd: 0.0091 }, // 362637
        },
        silentFor: {
          chainlink: { ethInUsd: 1800, jpyInUsd: 14400 },
        },
      };
      await setMocks(lastMockInput);
      assertChainlink(
        await feed.getPrice(),
        await feed.getStatus(),
        lastMockInput
      );
    });
    it(`should revert by ethusd broken(zero price)`, async function () {
      (<any>feed.provider).send("evm_increaseTime", [3200]);
      (<any>feed.provider).send("evm_mine");

      lastMockInput = {
        price: {
          chainlink: { ethInUsd: 0, jpyInUsd: 0.0091 }, // 362637
        },
        silentFor: {
          chainlink: { ethInUsd: 1800, jpyInUsd: 14400 },
        },
      };
      await setMocks(lastMockInput);
      await expect(feed.getPrice()).to.be.revertedWith("chainlink is broken");
    });
    it(`should revert by ethusd broken(minus price)`, async function () {
      (<any>feed.provider).send("evm_increaseTime", [3200]);
      (<any>feed.provider).send("evm_mine");

      lastMockInput = {
        price: {
          chainlink: { ethInUsd: -3200, jpyInUsd: 0.0091 }, // 362637
        },
        silentFor: {
          chainlink: { ethInUsd: 1800, jpyInUsd: 14400 },
        },
      };
      await setMocks(lastMockInput);
      await expect(feed.getPrice()).to.be.revertedWithPanic(0x11);
    });
    it(`should revert by ethusd broken(future timestamp)`, async function () {
      (<any>feed.provider).send("evm_increaseTime", [3200]);
      (<any>feed.provider).send("evm_mine");

      lastMockInput = {
        price: {
          chainlink: { ethInUsd: 3200, jpyInUsd: 0.0091 }, // 362637
        },
        silentFor: {
          chainlink: { ethInUsd: -1800, jpyInUsd: 14400 },
        },
      };
      await setMocks(lastMockInput);
      await expect(feed.getPrice()).to.be.revertedWith("chainlink is broken");
    });
    it(`should revert by ethusd frozen`, async function () {
      (<any>feed.provider).send("evm_increaseTime", [3200]);
      (<any>feed.provider).send("evm_mine");

      lastMockInput = {
        price: {
          chainlink: { ethInUsd: 3200, jpyInUsd: 0.0091 }, // 362637
        },
        silentFor: {
          chainlink: { ethInUsd: 3601, jpyInUsd: 14400 },
        },
      };
      await setMocks(lastMockInput);
      await expect(feed.getPrice()).to.be.revertedWith("chainlink is frozen");
    });
    it(`should revert by usdjpy broken(zero price)`, async function () {
      (<any>feed.provider).send("evm_increaseTime", [3200]);
      (<any>feed.provider).send("evm_mine");

      lastMockInput = {
        price: {
          chainlink: { ethInUsd: 3200, jpyInUsd: 0 }, // 362637
        },
        silentFor: {
          chainlink: { ethInUsd: 1800, jpyInUsd: 14400 },
        },
      };
      await setMocks(lastMockInput);
      await expect(feed.getPrice()).to.be.revertedWithPanic(0x12);
    });
    it(`should revert by usdjpy broken(minus price)`, async function () {
      (<any>feed.provider).send("evm_increaseTime", [3200]);
      (<any>feed.provider).send("evm_mine");

      lastMockInput = {
        price: {
          chainlink: { ethInUsd: 3200, jpyInUsd: -0.0091 }, // 362637
        },
        silentFor: {
          chainlink: { ethInUsd: 1800, jpyInUsd: 14400 },
        },
      };
      await setMocks(lastMockInput);
      await expect(feed.getPrice()).to.be.revertedWith("chainlink is broken");
    });
    it(`should revert by usdjpy broken(future timestamp)`, async function () {
      (<any>feed.provider).send("evm_increaseTime", [3200]);
      (<any>feed.provider).send("evm_mine");

      lastMockInput = {
        price: {
          chainlink: { ethInUsd: 3200, jpyInUsd: 0 }, // 362637
        },
        silentFor: {
          chainlink: { ethInUsd: 1800, jpyInUsd: -14400 },
        },
      };
      await setMocks(lastMockInput);
      await expect(feed.getPrice()).to.be.revertedWithPanic(0x12);
    });
    it(`should revert by usdjpy frozen`, async function () {
      (<any>feed.provider).send("evm_increaseTime", [3200]);
      (<any>feed.provider).send("evm_mine");

      lastMockInput = {
        price: {
          chainlink: { ethInUsd: 3200, jpyInUsd: 0.0091 }, // 362637
        },
        silentFor: {
          chainlink: { ethInUsd: 1800, jpyInUsd: 86401 },
        },
      };
      await setMocks(lastMockInput);
      await expect(feed.getPrice()).to.be.revertedWith("chainlink is frozen");
    });
    it(`should get chainlink data with a less-fructuated chainlink`, async function () {
      (<any>feed.provider).send("evm_increaseTime", [3200]);
      (<any>feed.provider).send("evm_mine");

      lastMockInput = {
        price: {
          chainlink: {
            ethInUsd: lastMockInput.price.chainlink.ethInUsd * 1.5,
            jpyInUsd: 0.0091,
          },
        },
        silentFor: {
          chainlink: { ethInUsd: 1800, jpyInUsd: 14400 },
        },
      };
      await setMocks(lastMockInput);
      assertChainlink(
        await feed.getPrice(),
        await feed.getStatus(),
        lastMockInput
      );
    });
  });

  describe("fetchPrice()", function () {
    it(`succeeds to get dec18 price from ChainLink`, async function () {
      let cPriceAtExecInEthUsd = 3201;
      let cPriceAtExecInJpyUsd = 0.0091;
      await setMocks({
        price: {
          chainlink: {
            ethInUsd: cPriceAtExecInEthUsd,
            jpyInUsd: cPriceAtExecInJpyUsd,
          },
        },
        silentFor: {
          chainlink: { ethInUsd: 1800, jpyInUsd: 7200 },
        },
      });
      await (await feed.fetchPrice()).wait();
      const status = await feed.status();
      const lastGoodPrice = await feed.lastGoodPrice();
      const localPrice = BigNumber.from(cPriceAtExecInEthUsd)
        .mul(BigNumber.from(10).pow(18 - CHAINLINK_DIGITS + CHAINLINK_DIGITS))
        .div(BigNumber.from(cPriceAtExecInJpyUsd * 10000))
        .mul(10000);
      expect(status).to.eq(0);
      expect(lastGoodPrice.toString().length).to.eq(
        localPrice.toString().length
      );
      expect(`${localPrice}`.slice(0, 6)).to.eq(`${lastGoodPrice}`.slice(0, 6));
    });
  });
});
