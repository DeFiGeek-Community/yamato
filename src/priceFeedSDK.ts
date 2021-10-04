const PRICE_FEED_ADDR_RINKEBY = "0xf078d609596bC689483464a780470a9E1E742008";

import {
  Wallet,
  Signer,
  getDefaultProvider,
  Contract,
  BigNumber,
} from "ethers";

import { genABI } from "../src/genABI";

import {
  deploy,
  goToEmbededMode,
  hardcodeFactoryAddress,
  singletonProvider,
  getFoundation,
  getDeployer,
  extractEmbeddedFactoryAddress,
  recoverFactoryAddress,
  setProvider,
  isInitMode,
  isEmbeddedMode,
  backToInitMode,
} from "../src/deployUtil";

const STATUS = [
  "chainlinkWorking",
  "usingTellorChainlinkUntrusted",
  "bothOraclesUntrusted",
  "usingTellorChainlinkFrozen",
  "usingChainlinkTellorUntrusted",
];

(async () => {
  await setProvider();

  const feed: Contract = new Contract(
    PRICE_FEED_ADDR_RINKEBY,
    genABI("PriceFeed"),
    singletonProvider()
  );

  /*
        1. Check dependencies
    */
  let ethPriceAggregatorInUSD = await feed
    .ethPriceAggregatorInUSD()
    .catch((e) => console.trace(e.message));
  let jpyPriceAggregatorInUSD = await feed
    .jpyPriceAggregatorInUSD()
    .catch((e) => console.trace(e.message));
  let tellorCaller = await feed
    .tellorCaller()
    .catch((e) => console.trace(e.message));
  const EthPriceAggregatorInUSD: Contract = new Contract(
    ethPriceAggregatorInUSD,
    genABI("ChainLinkMock"),
    singletonProvider()
  );
  const JpyPriceAggregatorInUSD: Contract = new Contract(
    jpyPriceAggregatorInUSD,
    genABI("ChainLinkMock"),
    singletonProvider()
  );
  const TellorCaller: Contract = new Contract(
    tellorCaller,
    genABI("TellorCallerMock"),
    singletonProvider()
  );

  await (
    await EthPriceAggregatorInUSD.connect(getFoundation()).latestRoundData({
      gasLimit: 200000,
    })
  ).wait();
  await (
    await JpyPriceAggregatorInUSD.connect(getFoundation()).latestRoundData({
      gasLimit: 200000,
    })
  ).wait();
  await (
    await TellorCaller.connect(getFoundation()).getTellorCurrentValue(59, {
      gasLimit: 200000,
    })
  ).wait();

  let lastPriceEthPriceAggregatorInUSD =
    await EthPriceAggregatorInUSD.lastPrice();
  let lastPriceJpyPriceAggregatorInUSD =
    await JpyPriceAggregatorInUSD.lastPrice();
  let lastPriceTellorCaller = await TellorCaller.lastPrice();

  console.log(`
    lastPriceEthPriceAggregatorInUSD:${lastPriceEthPriceAggregatorInUSD},
    lastPriceJpyPriceAggregatorInUSD:${lastPriceJpyPriceAggregatorInUSD},
    lastPriceTellorCaller:${lastPriceTellorCaller}
    `);

  /*
        2. Check preconditions
    */
  let dumpForDetectingBothUntrustedFlow1 = await feed
    .dumpForDetectingBothUntrustedFlow()
    .catch((e) => console.trace(e.message));
  let dumpForDetectingGasEater = await feed
    .dumpForDetectingGasEater()
    .catch((e) => console.trace(e.message));
  let dumpForChainLinkNow = await feed.dumpForChainLinkNow(0).catch((e) => {});
  let dumpForChainLinkBefore = await feed
    .dumpForChainLinkBefore(0)
    .catch((e) => {});
  let dumpForTellor = await feed.dumpForTellor(0).catch((e) => {});
  let status1 = await feed.status().catch((e) => console.trace(e.message));
  console.log(`
    dumpForDetectingBothUntrustedFlow1: ${dumpForDetectingBothUntrustedFlow1}
    dumpForDetectingGasEater: ${dumpForDetectingGasEater}
    status1: ${status1}
    dumpForChainLinkNow: ${dumpForChainLinkNow}
    dumpForChainLinkBefore: ${dumpForChainLinkBefore}
    dumpForTellor: ${dumpForTellor}
    `);

  /*
        3. Call fetchPrice()
    */
  console.log("calling");
  let tx = await feed
    .connect(getFoundation())
    .fetchPrice({ gasLimit: 3000000 })
    .catch((e) => console.trace(e.message));
  console.log("waiting", tx.hash.substr(0, 8));
  let res = await tx.wait();

  let dumpForDetectingBothUntrustedFlow2 = await feed
    .dumpForDetectingBothUntrustedFlow()
    .catch((e) => console.trace(e.message));
  console.log(
    `dumpForDetectingBothUntrustedFlow2: ${dumpForDetectingBothUntrustedFlow2}`
  );

  let status2 = await feed.status().catch((e) => console.trace(e.message));
  let lastGoodPrice = await feed
    .lastGoodPrice()
    .catch((e) => console.trace(e.message));
  let dumpForChainLinkNow2 = await feed
    .dumpForChainLinkNow(0)
    .catch((e) => console.trace(e.message));
  let dumpForChainLinkBefore2 = await feed
    .dumpForChainLinkBefore(0)
    .catch((e) => console.trace(e.message));
  let dumpForTellor2 = await feed
    .dumpForTellor(0)
    .catch((e) => console.trace(e.message));

  console.log(`
    status:${STATUS[status2]},
    lastGoodPrice:${lastGoodPrice},
    dumpForChainLinkNow2: ${dumpForChainLinkNow2}
    dumpForChainLinkBefore2: ${dumpForChainLinkBefore2}
    dumpForTellor2: ${dumpForTellor2}
    `);
})().then();
