import chalk from 'chalk';
import { Contract, Wallet, utils } from 'ethers';
const { isAddress, getAddress } = utils;
import { toERC20, onChainNow } from "@test/param/helper";
import { getTokenAbiArgs, getBulksaleAbiArgs } from "@test/param/scenarioHelper";
import { timeout } from "@src/timeout";
import { genABI } from '@src/genABI';
import {
    setProvider,
    getFoundation,
    getDeployer,
    extractEmbeddedFactoryAddress,
    recoverFactoryAddress,
    getLocalFactoryAddress
} from '@src/deployUtil';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { estimatedBlocktime } from '@src/constants';
const BLOCKTIME = estimatedBlocktime["rinkeby"].safe;

const provider = setProvider();
const saleTemplateName = ".saleTemplateName"

export function setSaleTemplateKey(_saleTemplateKey:string){
    writeFileSync(saleTemplateName, _saleTemplateKey);
}
export function getSaleTemplateKey():string{
    return readFileSync(saleTemplateName).toString();
}
export function removeSaleTemplateKey(){
    unlinkSync(saleTemplateName);
}

export async function cloneTokenAndSale(factoryAddr:string, tokenTemplateName:string):Promise<void>{
    const saleTemplateName:string|undefined = getSaleTemplateKey();
    if(getAddress(getLocalFactoryAddress()) === getAddress(factoryAddr)) throw new Error(`${getLocalFactoryAddress()} is a factory address for the local environment.`);
    const deployer = getFoundation();
    const Factory:Contract = (new Contract(factoryAddr, genABI('Factory'), provider)).connect(deployer);

    /*
        1. Initial settings.
    */
    const TOKEN_NAME = "VeryGoodToken";
    const TOKEN_SYMBOL = "VRG";
    const TOTAL_ISSUANCE = toERC20("1000000000000000");
    const SELLING_AMOUNT = toERC20("500000000000000");
    const feeRatePerMil = 1;
    const MIN_ETHER_TARGET = toERC20("0.05");
    const startModification = 60*3;
    const eventDuration = 60*60*24*30;
    const lockDuration = 60*60*24*30;
    const expirationDuration = 60*60*24*30*6;

    /*
        2. ABI for the token clone deployment.
    */
    const tokenOpts = {
        initialSupply: TOTAL_ISSUANCE,
        name: TOKEN_NAME,
        symbol: TOKEN_SYMBOL,
        owner: (<Wallet>deployer).address
    };
    const argsForTokenClone = getTokenAbiArgs(tokenTemplateName, tokenOpts);

    /*
        3. A token clone deployment.
    */
    console.log(chalk.blue.bgBlack.bold(`[Test] Deploying token clone... ${JSON.stringify(tokenOpts)}`));
    let tokenCloneDeployResult;
    try {
        let tx = await Factory.deployTokenClone(tokenTemplateName, argsForTokenClone);
        tokenCloneDeployResult = await tx.wait();
    } catch (e) { console.trace(e.message) }
    await timeout(BLOCKTIME);
    if(!tokenCloneDeployResult) console.trace(tokenTemplateName, argsForTokenClone);
    let tokenAddr;
    try {
        tokenAddr = tokenCloneDeployResult.events[tokenCloneDeployResult.events.length-1].args[2];
    } catch (e) { console.trace(e.message) }
    console.log(chalk.blue.bgBlack.bold(`[Test] Token Clone Deployed: ${tokenTemplateName}=${tokenAddr}`));

    /*
        4. Approval for deployment.
    */
    const OwnableToken:Contract = (new Contract(tokenAddr, genABI('OwnableToken'), provider)).connect(deployer);
    try {
        let approveTx = await OwnableToken.approve(factoryAddr, SELLING_AMOUNT);
        let approveResult = await approveTx.wait();
    } catch (e) { console.trace(e.message) }


    /*
        5. ABI for the sale clone deployment.
    */
    const saleOpts = {
        token: <string>tokenAddr,
        start: <number>(await onChainNow() + startModification),
        eventDuration: eventDuration,
        lockDuration: lockDuration,
        expirationDuration: expirationDuration,
        sellingAmount: SELLING_AMOUNT,
        minEtherTarget: MIN_ETHER_TARGET,
        owner: (<Wallet>deployer).address,
        feeRatePerMil: feeRatePerMil,
    };
    const argsForBulksaleClone = getBulksaleAbiArgs(saleTemplateName, saleOpts);


    /*
        6. A sale clone deployment.
    */
    console.log(chalk.blue.bgBlack.bold(`[Test] Deploying sale clone... ${JSON.stringify(tokenOpts)}`));
    let saleDeployResult;
    try {
        saleDeployResult = 
            await (
                await Factory.connect(deployer)
                    .deploy(saleTemplateName, tokenAddr, SELLING_AMOUNT, argsForBulksaleClone)
            ).wait();
    } catch (e) { console.trace(e.message) }
    await timeout(BLOCKTIME);
    if(!saleDeployResult) console.trace(saleTemplateName, tokenAddr, SELLING_AMOUNT, argsForBulksaleClone);
    let latestBulksaleCloneAddr:string;
    try {
        latestBulksaleCloneAddr = saleDeployResult.events[saleDeployResult.events.length-1].args[2];
    } catch (e) { console.trace(e.message) }
    console.log(chalk.blue.bgBlack.bold(`[Test] Sale Clone Deployed: ${saleTemplateName}=${latestBulksaleCloneAddr}`));
    removeSaleTemplateKey();
}