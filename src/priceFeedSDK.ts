const PRICE_FEED_ADDR_RINKEBY = "0xb178C2135A99759C59f4f1Cbf118b862861839Ee";

import {
    Wallet,
    Signer,
    getDefaultProvider,
    Contract,
    BigNumber
} from "ethers";

import { genABI } from '@src/genABI';

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
  } from '@src/deployUtil';
  
const STATUS = [
    'chainlinkWorking',
    'usingTellorChainlinkUntrusted',
    'bothOraclesUntrusted',
    'usingTellorChainlinkFrozen',
    'usingChainlinkTellorUntrusted'
];


(async ()=>{
    await setProvider();

    const feed: Contract = new Contract(PRICE_FEED_ADDR_RINKEBY, genABI("PriceFeed"), singletonProvider());

    console.log('calling')
    let tx = await feed.connect(getFoundation()).fetchPrice().catch(e=> console.trace(e.message) )
    console.log('waiting', tx.hash.substr(0,8))
    let res = await tx.wait();


    let status = await feed.status().catch(e=> console.trace(e.message) )
    let lastGoodPrice = await feed.lastGoodPrice().catch(e=> console.trace(e.message) )
    let ethPriceAggregatorInUSD = await feed.ethPriceAggregatorInUSD().catch(e=> console.trace(e.message) )
    let jpyPriceAggregatorInUSD = await feed.jpyPriceAggregatorInUSD().catch(e=> console.trace(e.message) )
    let tellorCaller = await feed.tellorCaller().catch(e=> console.trace(e.message) )

    console.log(`
    status:${STATUS[status]},
    lastGoodPrice:${lastGoodPrice},
    ethPriceAggregatorInUSD: ${ethPriceAggregatorInUSD},
    jpyPriceAggregatorInUSD: ${jpyPriceAggregatorInUSD},
    tellorCaller: ${tellorCaller},
    `);

    const EthPriceAggregatorInUSD: Contract = new Contract(ethPriceAggregatorInUSD, genABI("ChainLinkMock"), singletonProvider());
    const JpyPriceAggregatorInUSD: Contract = new Contract(jpyPriceAggregatorInUSD, genABI("ChainLinkMock"), singletonProvider());
    const TellorCaller: Contract = new Contract(tellorCaller, genABI("TellorCallerMock"), singletonProvider());
    
    console.log('cl1')
    await ( await EthPriceAggregatorInUSD.connect(getFoundation()).latestRoundData({gasLimit: 100000}) ).wait();
    console.log('cl2')
    await ( await JpyPriceAggregatorInUSD.connect(getFoundation()).latestRoundData({gasLimit: 100000}) ).wait();
    console.log('tl')
    await ( await TellorCaller.connect(getFoundation()).getTellorCurrentValue(59, {gasLimit: 100000}) ).wait();
    console.log('end')

    let lastPriceEthPriceAggregatorInUSD = await EthPriceAggregatorInUSD.lastPrice()
    let lastPriceJpyPriceAggregatorInUSD = await JpyPriceAggregatorInUSD.lastPrice()
    let lastPriceTellorCaller = await TellorCaller.lastPrice()

    console.log(`
    lastPriceEthPriceAggregatorInUSD:${lastPriceEthPriceAggregatorInUSD},
    lastPriceJpyPriceAggregatorInUSD:${lastPriceJpyPriceAggregatorInUSD},
    lastPriceTellorCaller:${lastPriceTellorCaller}
    `);

})().then();