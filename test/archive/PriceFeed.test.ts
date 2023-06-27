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
import { assert } from "console";
import { getStatic } from "ethers/lib/utils";
import { setProvider } from "../../src/deployUtil";

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
  tellor: number;
};
type SilenceType = {
  chainlink: ChainLinKNumberType;
  tellor: number;
};
type MockConf = {
  price: PriceType;
  silentFor: SilenceType;
  resetFlag?: boolean;
};
const CHAINLINK_DIGITS = 8;
const TELLOR_DIGITS = 6;
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
function assertTellor(price, status, testData) {
  expect(status).to.not.eq(0);
  expect(status).to.not.eq(2);
  expect(status).to.not.eq(4);
  expect(price.toString().slice(0, 6)).to.eq(
    `${testData.price.tellor}`.slice(0, 6)
  );
}
function assertTellorWithFrozenChainLink(price, status, lastGoodPrice) {
  expect(status).to.eq(3);
  expect(price.toString().slice(0, 6)).to.eq(`${lastGoodPrice}`.slice(0, 6));
}

function assertUnchange(price, status, lastGoodPrice) {
  expect(status).to.not.eq(0);
  expect(status).to.not.eq(3);
  expect(price.toString().slice(0, 6)).to.eq(`${lastGoodPrice}`.slice(0, 6));
}
function assertAdjusted(
  price,
  status,
  isAdjusted,
  lastGoodPrice,
  MAX_PRICE_DIFFERENCE_FOR_TELLOR_ADJUSTMENT
) {
  expect(status).to.eq(2);
  expect(isAdjusted).to.be.true;

  let coef;
  if (price.gt(lastGoodPrice)) {
    coef = BigNumber.from(1e18 + "").add(
      MAX_PRICE_DIFFERENCE_FOR_TELLOR_ADJUSTMENT
    );
  } else if (price.lt(lastGoodPrice)) {
    coef = BigNumber.from(1e18 + "").sub(
      MAX_PRICE_DIFFERENCE_FOR_TELLOR_ADJUSTMENT
    );
  } else {
    throw new Error("Adjusted price can't be the same with lastGoodPrice.");
  }
  expect(price.toString().slice(0, 6)).to.eq(
    `${lastGoodPrice.mul(coef).div(1e18 + "")}`.slice(0, 6)
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
  let tPrice = BigNumber.from(conf.price.tellor).mul(
    BigNumber.from(10).pow(TELLOR_DIGITS)
  );
  if (conf.price.tellor == 0) {
    tPrice = BigNumber.from(0);
  }
  let cDiffEthInUsd = conf.silentFor.chainlink.ethInUsd; // TIMEOUT = 14400 secs
  let cDiffJpyInUsd = conf.silentFor.chainlink.jpyInUsd;
  let tDiff = conf.silentFor.tellor;

  let now = Math.ceil(Date.now() / 1000);
  if (feed) {
    let block = await feed.provider.getBlock("latest");
    now = block.timestamp;
  }

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
        tellor: 351650,
      },
      silentFor: {
        chainlink: { ethInUsd: 7200, jpyInUsd: 7200 },
        tellor: 7200,
      },
      resetFlag: true,
    };
    // lastMockInput = {
    //   price: {
    //     chainlink: { ethInUsd: 3200, jpyInUsd: 0.0091 },
    //     tellor: 351650,
    //   },
    //   silentFor: {
    //     chainlink: { ethInUsd: 200, jpyInUsd: 200 },
    //     tellor: 200,
    //   },
    //   resetFlag: true,
    // };
    await setMocks(lastMockInput);
    // (<any>accounts[0].provider).send("evm_increaseTime", [150]);
    (<any>accounts[0].provider).send("evm_increaseTime", [1200]);
    (<any>accounts[0].provider).send("evm_mine");

    lastMockInput.silentFor.chainlink.ethInUsd = 1000; // Note: To avoid frozen response due to other depending specs
    lastMockInput.silentFor.chainlink.jpyInUsd = 1000;
    // lastMockInput.silentFor.chainlink.ethInUsd = 100; // Note: To avoid frozen response due to other depending specs
    // lastMockInput.silentFor.chainlink.jpyInUsd = 100;
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
    it(`should get chainlink data with a good chainlink and a good tellor`, async function () {
      (<any>feed.provider).send("evm_increaseTime", [3200]);
      (<any>feed.provider).send("evm_mine");

      lastMockInput = {
        price: {
          chainlink: { ethInUsd: 3200, jpyInUsd: 0.0091 }, // 362637
          tellor: 351640,
        },
        silentFor: {
          chainlink: { ethInUsd: 14400, jpyInUsd: 14400 },
          tellor: 14400, // 14401 and tellor will be frozen
        },
      };
      await setMocks(lastMockInput);
      assertChainlink(
        await feed.getPrice(),
        await feed.getStatus(),
        lastMockInput
      );
    });
    it(`should get chainlink data with a good chainlink and a frozen tellor`, async function () {
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
        },
      };
      await setMocks(lastMockInput);
      assertChainlink(
        await feed.getPrice(),
        await feed.getStatus(),
        lastMockInput
      );
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
        },
      };
      await setMocks(lastMockInput);
      assertTellor(
        await feed.getPrice(),
        await feed.getStatus(),
        lastMockInput
      );
    });

    it(`should get unchanged-but-tellor-data with a frozen chainlink and a frozen tellor`, async function () {
      (<any>feed.provider).send("evm_increaseTime", [3200]);
      (<any>feed.provider).send("evm_mine");

      lastMockInput.silentFor = {
        chainlink: { ethInUsd: 14401, jpyInUsd: 14401 },
        tellor: 14401, // 14401 and tellor will be frozen
      };
      await setMocks(lastMockInput);
      assertTellorWithFrozenChainLink(
        await feed.getPrice(),
        await feed.getStatus(),
        await feed.lastGoodPrice()
      );
    });
    it(`should get chainlink data with a less-fructuated chainlink and a similar tellor`, async function () {
      (<any>feed.provider).send("evm_increaseTime", [3200]);
      (<any>feed.provider).send("evm_mine");

      lastMockInput = {
        price: {
          chainlink: {
            ethInUsd: lastMockInput.price.chainlink.ethInUsd * 1.5,
            jpyInUsd: 0.0091,
          },
          tellor: 351648 * 1.5,
        },
        silentFor: {
          chainlink: { ethInUsd: 14400, jpyInUsd: 14400 },
          tellor: 14400, // 14401 and tellor will be frozen
        },
      };
      await setMocks(lastMockInput);
      assertChainlink(
        await feed.getPrice(),
        await feed.getStatus(),
        lastMockInput
      );
    });
    it(`should get chainlink data with a more-fructuated chainlink and a similar tellor`, async function () {
      (<any>feed.provider).send("evm_increaseTime", [3200]);
      (<any>feed.provider).send("evm_mine");

      lastMockInput = {
        price: {
          chainlink: {
            ethInUsd: lastMockInput.price.chainlink.ethInUsd * 2 + 1,
            jpyInUsd: 0.0091,
          },
          tellor: 351648 * 2 + 1,
        },
        silentFor: {
          chainlink: { ethInUsd: 14400, jpyInUsd: 14400 },
          tellor: 14400, // 14401 and tellor will be frozen
        },
      };
      await setMocks(lastMockInput);
      assertChainlink(
        await feed.getPrice(),
        await feed.getStatus(),
        lastMockInput
      );
    });
    it(`should get tellor data with a more-fructuated chainlink and a stable tellor`, async function () {
      (<any>feed.provider).send("evm_increaseTime", [3200]);
      (<any>feed.provider).send("evm_mine");

      lastMockInput = {
        price: {
          chainlink: {
            ethInUsd: 3200 * 3 + 1,
            jpyInUsd: 0.0091,
          },
          tellor: 351648,
        },
        silentFor: {
          chainlink: { ethInUsd: 14400, jpyInUsd: 14400 },
          tellor: 14400, // 14401 and tellor will be frozen
        },
      };
      await setMocks(lastMockInput);

      // Note: max price route with usingTellor
      assertTellor(
        await feed.getPrice(),
        await feed.getStatus(),
        lastMockInput
      );
    });

    it(`should get tellor data with a less-fructuated chainlink and a stable tellor`, async function () {
      (<any>feed.provider).send("evm_increaseTime", [3200]);
      (<any>feed.provider).send("evm_mine");

      lastMockInput = {
        price: {
          chainlink: {
            ethInUsd: lastMockInput.price.chainlink.ethInUsd * 1.5,
            jpyInUsd: 0.0091,
          },
          tellor: 351648,
        },
        silentFor: {
          chainlink: { ethInUsd: 14400, jpyInUsd: 14400 },
          tellor: 14400, // 14401 and tellor will be frozen
        },
      };
      await setMocks(lastMockInput);

      assertChainlink(
        await feed.getPrice(),
        await feed.getStatus(),
        lastMockInput
      );
    });

    it(`should get chainlink data with a stable chainlink and a less-than-50%-fructuated tellor`, async function () {
      /* Because chainlink is to be priored whatever Tellor price is. */
      (<any>feed.provider).send("evm_increaseTime", [3200]);
      (<any>feed.provider).send("evm_mine");

      lastMockInput = {
        price: {
          chainlink: {
            ethInUsd: 3200,
            jpyInUsd: 0.0091,
          }, // 362637
          tellor: 362638 * 1.5,
        },
        silentFor: {
          chainlink: { ethInUsd: 14400, jpyInUsd: 14400 },
          tellor: 14400, // 14401 and tellor will be frozen
        },
      };
      await setMocks(lastMockInput);

      assertChainlink(
        await feed.getPrice(),
        await feed.getStatus(),
        lastMockInput
      );
    });
    it(`should get chainlink data with a stable chainlink and a more-than-50%-fructuated tellor`, async function () {
      /* Because chainlink is to be priored whatever Tellor price is. */
      (<any>feed.provider).send("evm_increaseTime", [3200]);
      (<any>feed.provider).send("evm_mine");

      lastMockInput = {
        price: {
          chainlink: {
            ethInUsd: 3200,
            jpyInUsd: 0.0091,
          }, // 362637
          tellor: 362637 * 2 + 1,
        },
        silentFor: {
          chainlink: { ethInUsd: 14400, jpyInUsd: 14400 },
          tellor: 14400, // 14401 and tellor will be frozen
        },
      };
      await setMocks(lastMockInput);

      assertChainlink(
        await feed.getPrice(),
        await feed.getStatus(),
        lastMockInput
      );
    });

    it(`should NOT use tellor data with an untrusted chainlink and a drastically surging tellor`, async function () {
      // setMocks(zeroPrice) => Untrusted
      (<any>feed.provider).send("evm_increaseTime", [3200]);
      (<any>feed.provider).send("evm_mine");
      lastMockInput = {
        price: {
          chainlink: { ethInUsd: 0, jpyInUsd: 999999 }, // answer=0
          tellor: lastMockInput.price.tellor * 2 + 1,
        },
        silentFor: {
          chainlink: { ethInUsd: 14401, jpyInUsd: 14401 },
          tellor: 14400, // 14401 and tellor will be frozen
        },
      };
      await setMocks(lastMockInput);

      // getPrice
      // assertAdjusted
      assertAdjusted(
        await feed.getPrice(),
        await feed.getStatus(),
        await feed.getIsAdjusted(),
        await feed.lastGoodPrice(),
        await feed.MAX_PRICE_DIFFERENCE_FOR_TELLOR_ADJUSTMENT()
      );
    });

    describe("Contect - recovery from untrusted feed", function () {
      it(`should recover to use chainlink from an untrusted chainlink and a good tellor`, async function () {
        // setMocks(zeroPrice) => Untrusted
        (<any>feed.provider).send("evm_increaseTime", [3200]);
        (<any>feed.provider).send("evm_mine");

        expect(await feed.getStatus()).to.eq(0);
        expect(await feed.getPrice()).to.gt(0);

        lastMockInput = {
          price: {
            chainlink: { ethInUsd: 0, jpyInUsd: 999999 }, // answer=0
            tellor: 350000,
          },
          silentFor: {
            chainlink: { ethInUsd: 14400, jpyInUsd: 14400 },
            tellor: 14400, // 14401 and tellor will be frozen
          },
        };
        await setMocks(lastMockInput);

        // getPrice
        // assertAdjusted
        expect(await feed.getStatus()).to.eq(1); // usingTellorChainlinkUntrusted

        // setMocks([un]similarPrice)
        (<any>feed.provider).send("evm_increaseTime", [3200]);
        (<any>feed.provider).send("evm_mine");
        lastMockInput = {
          price: {
            chainlink: { ethInUsd: 3200, jpyInUsd: 0.0091 }, // 362637
            tellor: 351650,
          },
          silentFor: {
            chainlink: { ethInUsd: 14400, jpyInUsd: 14400 },
            tellor: 14400, // 14401 and tellor will be frozen
          },
        };

        await setMocks(lastMockInput); // Note: If prevChainLinkResponse is broken, then _bothOraclesLiveAndUnbrokenAndSimilarPrice is not met the condition
        await setMocks(lastMockInput); // Note: Need to remove broken prevChainLinkResponse to make _bothOraclesLiveAndUnbrokenAndSimilarPrice true

        // getPrice
        // assertChainlink
        assertChainlink(
          await feed.getPrice(),
          await feed.getStatus(),
          lastMockInput
        );
      });

      it(`should recover to use chainlink from a good chainlink and an untrusted tellor`, async function () {
        // setMocks(zeroPrice) => Untrusted
        (<any>feed.provider).send("evm_increaseTime", [3200]);
        (<any>feed.provider).send("evm_mine");
        lastMockInput = {
          price: {
            chainlink: { ethInUsd: 3200, jpyInUsd: 0.0091 }, // 36****
            tellor: 0,
          },
          silentFor: {
            chainlink: { ethInUsd: 14400, jpyInUsd: 14400 },
            tellor: 14400, // 14401 and tellor will be frozen
          },
        };
        await setMocks(lastMockInput);

        // getPrice
        // assertUsingChainlinkTellorUntrusted
        expect(await feed.getStatus()).to.eq(4);

        // setMocks([un]similarPrice)
        (<any>feed.provider).send("evm_increaseTime", [3200]);
        (<any>feed.provider).send("evm_mine");
        lastMockInput = {
          price: {
            chainlink: { ethInUsd: 3200, jpyInUsd: 0.0091 }, // 362637
            tellor: 351648,
          },
          silentFor: {
            chainlink: { ethInUsd: 14400, jpyInUsd: 14400 },
            tellor: 14400, // 14401 and tellor will be frozen
          },
        };
        await setMocks(lastMockInput); // Note: If prevChainLinkResponse is broken, then _bothOraclesLiveAndUnbrokenAndSimilarPrice is not met the condition
        await setMocks(lastMockInput); // Note: Need to remove broken prevChainLinkResponse to make _bothOraclesLiveAndUnbrokenAndSimilarPrice true

        // getPrice
        // assertChainlink
        assertChainlink(
          await feed.getPrice(),
          await feed.getStatus(),
          lastMockInput
        );
      });
      it(`should recover to use chainlink from an untrusted chainlink and an untrusted tellor`, async function () {
        // setMocks(zeroPrice) => Untrusted
        (<any>feed.provider).send("evm_increaseTime", [3200]);
        (<any>feed.provider).send("evm_mine");
        lastMockInput = {
          price: {
            chainlink: { ethInUsd: 0, jpyInUsd: 9999999 }, // 36****
            tellor: 0,
          },
          silentFor: {
            chainlink: { ethInUsd: 14400, jpyInUsd: 14400 },
            tellor: 14400, // 14401 and tellor will be frozen
          },
        };
        await setMocks(lastMockInput);

        // getPrice
        // assertBothUntrusted
        expect(await feed.getStatus()).to.eq(2);
        expect(await feed.getIsAdjusted()).to.eq(false);
        expect(await feed.getPrice()).to.eq(await feed.lastGoodPrice());

        // setMocks([un]similarPrice)
        (<any>feed.provider).send("evm_increaseTime", [3200]);
        (<any>feed.provider).send("evm_mine");
        lastMockInput = {
          price: {
            chainlink: { ethInUsd: 3200, jpyInUsd: 0.0091 }, // 362637
            tellor: 351648,
          },
          silentFor: {
            chainlink: { ethInUsd: 14400, jpyInUsd: 14400 },
            tellor: 14400, // 14401 and tellor will be frozen
          },
        };
        await setMocks(lastMockInput); // Note: If prevChainLinkResponse is broken, then _bothOraclesLiveAndUnbrokenAndSimilarPrice is not met the condition
        await setMocks(lastMockInput); // Note: Need to remove broken prevChainLinkResponse to make _bothOraclesLiveAndUnbrokenAndSimilarPrice true

        // getPrice
        // assertChainlink
        assertChainlink(
          await feed.getPrice(),
          await feed.getStatus(),
          lastMockInput
        );
      });

      it(`should recover to use chainlink from an untrusted chainlink and an extremely low but working tellor`, async function () {
        // setMocks(zeroPrice) => Untrusted
        (<any>feed.provider).send("evm_increaseTime", [3200]);
        (<any>feed.provider).send("evm_mine");
        lastMockInput = {
          price: {
            chainlink: { ethInUsd: 0, jpyInUsd: 9999999 }, // 36****
            tellor: 1,
          },
          silentFor: {
            chainlink: { ethInUsd: 14400, jpyInUsd: 14400 },
            tellor: 14400, // 14401 and tellor will be frozen
          },
        };
        await setMocks(lastMockInput);

        // getPrice
        // assertAdjusted
        assertAdjusted(
          await feed.getPrice(),
          await feed.getStatus(),
          await feed.getIsAdjusted(),
          await feed.lastGoodPrice(),
          await feed.MAX_PRICE_DIFFERENCE_FOR_TELLOR_ADJUSTMENT()
        );

        // setMocks([un]similarPrice)
        (<any>feed.provider).send("evm_increaseTime", [3200]);
        (<any>feed.provider).send("evm_mine");
        lastMockInput = {
          price: {
            chainlink: { ethInUsd: 3200, jpyInUsd: 0.0091 }, // 362637
            tellor: 351648,
          },
          silentFor: {
            chainlink: { ethInUsd: 14400, jpyInUsd: 14400 },
            tellor: 14400, // 14401 and tellor will be frozen
          },
        };
        await setMocks(lastMockInput); // Note: If prevChainLinkResponse is broken, then _bothOraclesLiveAndUnbrokenAndSimilarPrice is not met the condition
        await setMocks(lastMockInput); // Note: Need to remove broken prevChainLinkResponse to make _bothOraclesLiveAndUnbrokenAndSimilarPrice true

        // getPrice
        // assertChainlink
        assertChainlink(
          await feed.getPrice(),
          await feed.getStatus(),
          lastMockInput
        );
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

      lastMockInput = {
        price: {
          chainlink: {
            ethInUsd: 3202,
            jpyInUsd: 0.0091,
          },
          tellor: 351650,
        },
        silentFor: {
          chainlink: { ethInUsd: 14401, jpyInUsd: 14401 },
          tellor: 3600,
        },
      };
      await setMocks(lastMockInput);

      await (await feed.fetchPrice()).wait();

      assertTellor(
        await feed.lastGoodPrice(),
        await feed.getStatus(),
        lastMockInput
      );
    });
  });
});
