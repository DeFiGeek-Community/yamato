const PRICE_FEED_ADDR_RINKEBY = "0xef61f50987212d116521477e74502da532073467";

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

    let tx = await feed.connect(getFoundation()).fetchPrice();
    let res = await tx.wait();

    console.log(res)
    // console.log(BigNumber.from(res.logs[0].data).toString())


    // let status = await feed.status().catch(console.trace);
    // let lastGoodPrice = await feed.lastGoodPrice().catch(console.trace);
    // let ethPriceAggregatorInUSD = await feed.ethPriceAggregatorInUSD().catch(console.trace);

    // console.log(`status:${status}, lastGoodPrice:${lastGoodPrice}, ethPriceAggregatorInUSD:${ethPriceAggregatorInUSD}`);
      
})().then();