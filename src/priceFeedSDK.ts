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
  
(async ()=>{
    await setProvider();

    const feed: Contract = new Contract(PRICE_FEED_ADDR_RINKEBY, genABI("PriceFeed"), singletonProvider());

    console.log('calling')
    let tx = await feed.connect(getFoundation()).fetchPrice({gasLimit: 300000, gasPrice:1*(1000**3)});
    console.log('waiting', tx.hash.substr(0,8))
    let res = await tx.wait();


    let status = await feed.status().catch(console.trace);
    let lastGoodPrice = await feed.lastGoodPrice().catch(console.trace);

    let ethPriceAggregatorInUSD = await feed.ethPriceAggregatorInUSD().catch(console.trace);

    console.log(`status:${status}, lastGoodPrice:${lastGoodPrice}, ethPriceAggregatorInUSD: ${ethPriceAggregatorInUSD}`);

    const EthPriceAggregatorInUSD: Contract = new Contract(ethPriceAggregatorInUSD, genABI("ChainLinkMock"), singletonProvider());
    
    let tx2 = await EthPriceAggregatorInUSD.connect(getFoundation()).latestRoundData({gasLimit:100000})
    let res2 = await tx2.wait();

    let lastPrice = await EthPriceAggregatorInUSD.lastPrice()

    console.log(`lastPrice:${lastPrice}`);

})().then();