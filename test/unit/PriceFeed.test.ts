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
import { getProxy } from "../../src/testUtil";
import { assert } from "console";

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
function assertChainlink(price, status, testData){
  expect(status).to.not.eq(1);
  expect(status).to.not.eq(2);
  expect(status).to.not.eq(3);
  expect(price.toString().slice(0,6)).to.eq(`${testData.price.chainlink.ethInUsd/testData.price.chainlink.jpyInUsd}`.slice(0,6));
}
function assertTellor(price, status, testData){
  expect(status).to.not.eq(0);
  expect(status).to.not.eq(2);
  expect(status).to.not.eq(4);
  expect(price.toString().slice(0,6)).to.eq(`${testData.price.tellor}`.slice(0,6));
}
function assertUnchange(price, status, lastGoodPrice){
  expect(status).to.not.eq(0);
  expect(status).to.not.eq(1);
  expect(status).to.not.eq(3);
  expect(status).to.not.eq(4);
  expect(price.toString().slice(0,6)).to.eq(`${lastGoodPrice}`.slice(0,6));
}

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
    now - cDiffEthInUsd, /* unused */
    now - cDiffEthInUsd,
    2, /* unused */
  ]); // uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound
  mockAggregatorV3EthUsd.getRoundData.returns([
    mockRoundCount,
    cPriceEthInUsd,
    now - cDiffEthInUsd, /* unused */
    now - cDiffEthInUsd,
    mockRoundCount + 1, /* unused */
  ]); // uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound
  mockAggregatorV3JpyUsd.decimals.returns(CHAINLINK_DIGITS); // uint8
  mockAggregatorV3JpyUsd.latestRoundData.returns([
    mockRoundCount,
    cPriceJpyInUsd,
    now - cDiffJpyInUsd, /* unused */
    now - cDiffJpyInUsd,
    2, /* unused */
  ]); // uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound
  mockAggregatorV3JpyUsd.getRoundData.returns([
    mockRoundCount,
    cPriceJpyInUsd,
    now - cDiffJpyInUsd, /* unused */
    now - cDiffJpyInUsd,
    mockRoundCount + 1, /* unused */
  ]); // uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound
  mockTellorCaller.getTellorCurrentValue.returns([true, tPrice, now - tDiff]); // bool ifRetrieve, uint256 value, uint256 _timestampRetrieved
}
describe("PriceFeed", function () {
  let lastMockInput;
  beforeEach(async () => {
    accounts = await ethers.getSigners();
    ownerAddress = await accounts[0].getAddress();
    // https://github.com/liquity/dev/blob/main/packages/contracts/contracts/Dependencies/AggregatorV3Interface.sol
    mockAggregatorV3EthUsd = await smock.fake<ChainLinkMock>("ChainLinkMock");
    mockAggregatorV3JpyUsd = await smock.fake<ChainLinkMock>("ChainLinkMock");
    // https://github.com/liquity/dev/blob/main/packages/contracts/contracts/Interfaces/ITellorCaller.sol
    mockTellorCaller = await smock.fake<TellorCallerMock>("TellorCallerMock");

    lastMockInput = {
      price: {
        chainlink: { ethInUsd: 3200, jpyInUsd: 0.0091 },
        tellor: 351650,
      },
      silentFor: {
        chainlink: { ethInUsd: 7200, jpyInUsd: 7200 },
        tellor: 7200,
      },
    };
    await setMocks(lastMockInput);
    feed = await getProxy<PriceFeed, PriceFeed__factory>("PriceFeed", [
      mockAggregatorV3EthUsd.address,
      mockAggregatorV3JpyUsd.address,
      mockTellorCaller.address,
    ]);

    assertChainlink(await feed.getPrice(), await feed.getStatus(), lastMockInput);

  });

  describe("constructor()", function () {
    it(`should NOT revoke ownership`, async function () {
      expect(await feed.governance()).to.eq(await feed.signer.getAddress());
    });
  });

  describe("getPrice()", function () {
    it(`should get chainlink data with a good chainlink and a good tellor`, async function () {
      (<any>feed.provider).send("evm_increaseTime", [3200]);
      (<any>feed.provider).send("evm_mine");

      lastMockInput = {
        price: {
          chainlink: { ethInUsd: 3220, jpyInUsd: 0.0091 }, // 362637
          tellor: 351648,
        },
        silentFor: {
          chainlink: { ethInUsd: 14400, jpyInUsd: 14400 },
          tellor: 14400, // 14401 and tellor will be frozen
        }
      }
      await setMocks(lastMockInput);
      assertChainlink(await feed.getPrice(), await feed.getStatus(), lastMockInput);
    });
    it(`should get tellor data with a good chainlink and a frozen tellor`, async function () {
      (<any>feed.provider).send("evm_increaseTime", [3200]);
      (<any>feed.provider).send("evm_mine");
  
      lastMockInput = {
        price: {
          chainlink: { ethInUsd: 3220, jpyInUsd: 0.0091 }, // 362637
          tellor: 351648,
        },
        silentFor: {
          chainlink: { ethInUsd: 14400, jpyInUsd: 14400 },
          tellor: 14401, // 14401 and tellor will be frozen
        }
      }
      await setMocks(lastMockInput);
      assertTellor(await feed.getPrice(), await feed.getStatus(), lastMockInput);
    });
    it(`should get tellor data with a frozen chainlink and a good tellor`, async function () {
      (<any>feed.provider).send("evm_increaseTime", [3200]);
      (<any>feed.provider).send("evm_mine");

      lastMockInput = {
        price: {
          chainlink: { ethInUsd: 3220, jpyInUsd: 0.0091 }, // 362637
          tellor: 351648,
        },
        silentFor: {
          chainlink: { ethInUsd: 14401, jpyInUsd: 14401 },
          tellor: 14400, // 14401 and tellor will be frozen
        }
      }
      await setMocks(lastMockInput);
      assertTellor(await feed.getPrice(), await feed.getStatus(), lastMockInput);
    });

    it(`should get unchanged data with a frozen chainlink and a frozen tellor`, async function () {
      (<any>feed.provider).send("evm_increaseTime", [3200]);
      (<any>feed.provider).send("evm_mine");

      lastMockInput.silentFor = {
        chainlink: { ethInUsd: 14401, jpyInUsd: 14401 },
        tellor: 14401, // 14401 and tellor will be frozen
      }
      await setMocks(lastMockInput);
      assertUnchange(await feed.getPrice(), await feed.getStatus(), await feed.lastGoodPrice());
    });
    it(`should get chainlink data with a less-fructuated chainlink and a similar tellor`, async function () {
      (<any>feed.provider).send("evm_increaseTime", [3200]);
      (<any>feed.provider).send("evm_mine");

      lastMockInput = {
        price: {
          chainlink: { ethInUsd: lastMockInput.price.chainlink.ethInUsd*1.5, jpyInUsd: 0.0091 }, // 362637
          tellor: 351648*1.5,
        },
        silentFor: {
          chainlink: { ethInUsd: 14400, jpyInUsd: 14400 },
          tellor: 14400, // 14401 and tellor will be frozen
        }
      }
      await setMocks(lastMockInput);
      assertChainlink(await feed.getPrice(), await feed.getStatus(), lastMockInput);
    });
    it(`should get chainlink data with a more-fructuated chainlink and a similar tellor`, async function () {
      (<any>feed.provider).send("evm_increaseTime", [3200]);
      (<any>feed.provider).send("evm_mine");

      lastMockInput = {
        price: {
          chainlink: { ethInUsd: lastMockInput.price.chainlink.ethInUsd*2+1, jpyInUsd: 0.0091 }, // 362637
          tellor: 351648*2+1,
        },
        silentFor: {
          chainlink: { ethInUsd: 14400, jpyInUsd: 14400 },
          tellor: 14400, // 14401 and tellor will be frozen
        }
      }
      await setMocks(lastMockInput);
      assertChainlink(await feed.getPrice(), await feed.getStatus(), lastMockInput);
    });
    it(`should get tellor data with a more-fructuated chainlink and a stable tellor`, async function () {
      (<any>feed.provider).send("evm_increaseTime", [3200]);
      (<any>feed.provider).send("evm_mine");

      lastMockInput = {
        price: {
          chainlink: { ethInUsd: lastMockInput.price.chainlink.ethInUsd*2+1, jpyInUsd: 0.0091 }, // 362637
          tellor: 351648,
        },
        silentFor: {
          chainlink: { ethInUsd: 14400, jpyInUsd: 14400 },
          tellor: 14400, // 14401 and tellor will be frozen
        }
      }
      await setMocks(lastMockInput);
      assertTellor(await feed.getPrice(), await feed.getStatus(), lastMockInput);
    });

    it(`should get tellor data with a less-fructuated chainlink and a stable tellor`, async function () {
      (<any>feed.provider).send("evm_increaseTime", [3200]);
      (<any>feed.provider).send("evm_mine");

      lastMockInput = {
        price: {
          chainlink: { ethInUsd: lastMockInput.price.chainlink.ethInUsd*1.5, jpyInUsd: 0.0091 }, // 362637
          tellor: 351648,
        },
        silentFor: {
          chainlink: { ethInUsd: 14400, jpyInUsd: 14400 },
          tellor: 14400, // 14401 and tellor will be frozen
        }
      }
      await setMocks(lastMockInput);
      assertTellor(await feed.getPrice(), await feed.getStatus(), lastMockInput);
    });
    it(`should get tellor data with a more-fructuated chainlink and a stable tellor`, async function () {
      (<any>feed.provider).send("evm_increaseTime", [3200]);
      (<any>feed.provider).send("evm_mine");

      lastMockInput = {
        price: {
          chainlink: { ethInUsd: lastMockInput.price.chainlink.ethInUsd*2+1, jpyInUsd: 0.0091 }, // 362637
          tellor: 351648,
        },
        silentFor: {
          chainlink: { ethInUsd: 14400, jpyInUsd: 14400 },
          tellor: 14400, // 14401 and tellor will be frozen
        }
      }
      await setMocks(lastMockInput);
      assertTellor(await feed.getPrice(), await feed.getStatus(), lastMockInput);
    });

    it.only(`should get tellor data with a stable chainlink and a less-fructuated tellor`, async function () {
      (<any>feed.provider).send("evm_increaseTime", [3200]);
      (<any>feed.provider).send("evm_mine");

      lastMockInput = {
        price: {
          chainlink: { ethInUsd: lastMockInput.price.chainlink.ethInUsd, jpyInUsd: 0.0091 }, // 362637
          tellor: lastMockInput.price.tellor*1.5,
        },
        silentFor: {
          chainlink: { ethInUsd: 14400, jpyInUsd: 14400 },
          tellor: 14400, // 14401 and tellor will be frozen
        }
      }
      await setMocks(lastMockInput);
      assertTellor(await feed.getPrice(), await feed.getStatus(), lastMockInput);
    });
    it.only(`should get tellor data with a stable chainlink and a more-fructuated tellor`, async function () {
      (<any>feed.provider).send("evm_increaseTime", [3200]);
      (<any>feed.provider).send("evm_mine");

      lastMockInput = {
        price: {
          chainlink: { ethInUsd: lastMockInput.price.chainlink.ethInUsd, jpyInUsd: 0.0091 }, // 362637
          tellor: lastMockInput.price.tellor*2+1,
        },
        silentFor: {
          chainlink: { ethInUsd: 14400, jpyInUsd: 14400 },
          tellor: 14400, // 14401 and tellor will be frozen
        }
      }
      await setMocks(lastMockInput);
      assertTellor(await feed.getPrice(), await feed.getStatus(), lastMockInput);
    });



    describe.only("Contect - recovery from untrusted feed", function () {
      it(`should recover to use chainlink from an untrusted chainlink and a good tellor`, async function () {
      });
      it(`should recover to use chainlink from a good chainlink and an untrusted tellor`, async function () {
      });
      it(`should recover to use chainlink from an untrusted chainlink and an untrusted tellor`, async function () {
      });
    });

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
      const localPrice = BigNumber.from(cPriceAtExecInEthUsd)
        .mul(BigNumber.from(10).pow(18 - CHAINLINK_DIGITS + CHAINLINK_DIGITS))
        .div(BigNumber.from(cPriceAtExecInJpyUsd * 10000))
        .mul(10000);
      expect(status).to.eq(0);
      expect(lastGoodPrice.toString().length).to.eq(
        localPrice.toString().length
      );
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
      expect(BigNumber.from(tPriceAtExecInJpyUsd).mul(1e18 + "")).to.eq(
        lastGoodPrice
      );
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
