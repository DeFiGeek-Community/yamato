const PRICE_FEED_ADDR_RINKEBY = "0xEf61f50987212D116521477E74502DA532073467";

import {
    Wallet,
    Signer,
    getDefaultProvider,
    Contract
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
    console.log('called')

    // let status = await feed.status().catch(console.trace);
    // let lastGoodPrice = await feed.lastGoodPrice().catch(console.trace);

    // console.log(`status:${status}, lastGoodPrice:${lastGoodPrice}`);
      
})().then();