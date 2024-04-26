import { ethers } from "hardhat";
import { FakeContract, smock } from "@defi-wonderland/smock";
import chai, { expect } from "chai";
import { Signer, BigNumber } from "ethers";
import {
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import {
  ChainLinkMock,
  PriceFeedUSD,
  PriceFeedUSD__factory,
} from "../../typechain";
import { getProxy } from "../../src/testUtil";

chai.use(smock.matchers);

let feed: PriceFeedUSD;
let accounts: Signer[];
let ownerAddress: string;
let mockAggregatorV3EthUsd: FakeContract<ChainLinkMock>;
let mockRoundCount = 2;
let lastChainLinkAnswer;

type ChainLinKNumberType = {
  ethInUsd: number;
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
  expect(price).to.eq(
    BigNumber.from(testData.price.chainlink.ethInUsd).mul(
      BigNumber.from(10).pow(18)
    )
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

  let cDiffEthInUsd = conf.silentFor.chainlink.ethInUsd; // TIMEOUT = 3600 secs

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

  lastChainLinkAnswer = cPriceEthInUsd;
  mockRoundCount++;
}
describe.only("PriceFeedUSD", function () {
  let lastMockInput;
  let snapshot: SnapshotRestorer;

  before(async () => {
    accounts = await ethers.getSigners();
    ownerAddress = await accounts[0].getAddress();
    // https://github.com/liquity/dev/blob/main/packages/contracts/contracts/Dependencies/AggregatorV3Interface.sol
    mockAggregatorV3EthUsd = await smock.fake<ChainLinkMock>("ChainLinkMock");

    lastMockInput = {
      price: {
        chainlink: { ethInUsd: 3200 },
      },
      silentFor: {
        chainlink: { ethInUsd: 1200 },
      },
      resetFlag: false,
    };
    await setMocks(lastMockInput);
    (<any>accounts[0].provider).send("evm_increaseTime", [1200]);
    (<any>accounts[0].provider).send("evm_mine");

    lastMockInput.silentFor.chainlink.ethInUsd = 1000; // Note: To avoid frozen response due to other depending specs
    lastMockInput.resetFlag = false;
    await setMocks(lastMockInput);

    feed = await getProxy<PriceFeedUSD, PriceFeedUSD__factory>("PriceFeedUSD", [
      mockAggregatorV3EthUsd.address,
    ]);

    assertChainlink(
      await feed.getPrice(),
      await feed.getStatus(),
      lastMockInput
    );
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
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
          chainlink: { ethInUsd: 3200 }, // 362637
        },
        silentFor: {
          chainlink: { ethInUsd: 1800 },
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
          chainlink: { ethInUsd: 0 }, // 362637
        },
        silentFor: {
          chainlink: { ethInUsd: 1800 },
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
          chainlink: { ethInUsd: -3200 }, // 362637
        },
        silentFor: {
          chainlink: { ethInUsd: 1800 },
        },
      };
      await setMocks(lastMockInput);
      await expect(feed.getPrice()).to.be.revertedWith("chainlink is broken");
    });
    it(`should revert by ethusd broken(future timestamp)`, async function () {
      (<any>feed.provider).send("evm_increaseTime", [3200]);
      (<any>feed.provider).send("evm_mine");

      lastMockInput = {
        price: {
          chainlink: { ethInUsd: 3200 }, // 362637
        },
        silentFor: {
          chainlink: { ethInUsd: -1800 },
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
          chainlink: { ethInUsd: 3200 }, // 362637
        },
        silentFor: {
          chainlink: { ethInUsd: 3601 },
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
          },
        },
        silentFor: {
          chainlink: { ethInUsd: 1800 },
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
    it(`succeeds to get dec18 price from ChainLink for ETH in USD`, async function () {
      let cPriceAtExecInEthUsd = 3201;
      await setMocks({
        price: {
          chainlink: {
            ethInUsd: cPriceAtExecInEthUsd,
          },
        },
        silentFor: {
          chainlink: { ethInUsd: 1800 },
        },
      });
      await (await feed.fetchPrice()).wait();
      const status = await feed.status();
      const lastGoodPrice = await feed.lastGoodPrice();
      const localPrice = BigNumber.from(cPriceAtExecInEthUsd).mul(
        BigNumber.from(10).pow(18)
      ); // ChainLinkの価格をdec18形式に変換

      expect(status).to.eq(0);
      expect(lastGoodPrice).to.eq(localPrice);
    });
  });
});
