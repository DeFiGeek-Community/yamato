require('dotenv').config();
import chalk from 'chalk';
import { BigNumber, Wallet, Contract } from 'ethers';
import { genABI } from '@src/genABI';
import {
    setProvider,
    getFoundation,
    getDeployer,
    extractEmbeddedFactoryAddress,
    recoverFactoryAddress
} from '@src/deployUtil';
import { timeout } from "@src/timeout";
import { estimatedBlocktime } from '@src/constants';
const BLOCKTIME = estimatedBlocktime["rinkeby"].standard;



const provider = setProvider()
const foundation = getFoundation();


export async function addTemplate(templateName, deployedFactoryAddress, deployedTemplateAddress):Promise<string>{
    /*
        1. Instanciate the deployed factory and template.
    */
    const Factory = (new Contract(deployedFactoryAddress, genABI('Factory'), provider));
    const Template = (new Contract(deployedTemplateAddress, genABI(templateName), provider));

    /*
        2. consistency check between the embedded factory addr in the template and the on-chain factory itself.
    */
    await timeout(BLOCKTIME);
    const factoryAddressFromFile = extractEmbeddedFactoryAddress(templateName);
    if(factoryAddressFromFile !== deployedFactoryAddress) {
        throw new Error(`factoryAddressFromFile=${factoryAddressFromFile} is not equal to deployedFactoryAddress=${deployedFactoryAddress}`);
    }
    const upstreamEmbeddedFactoryAddress = await Template.factory();
    if(upstreamEmbeddedFactoryAddress !== deployedFactoryAddress) {
        throw new Error(`upstreamEmbeddedFactoryAddress=${upstreamEmbeddedFactoryAddress} is not equal to deployedFactoryAddress=${deployedFactoryAddress}`);
    }

    /*
        3. Finding unique name
    */
    function genName(filename, i){ return `${filename}.${i}.sol` }
    let nonce = 0;
    let name;
    let lookupResult;
    while(lookupResult != "0x0000000000000000000000000000000000000000" || !lookupResult) {
        name = genName(templateName, nonce);
        lookupResult = await Factory.templates(name);
        nonce++;
        console.log(`${nonce.toString().padStart(3, '0')}th: ${name}`);
    }


    /*
        4. Register the template to the Factory.
    */
    console.log(`"mapping(${name} => ${Template.address})" is being registered to the Factory... (Factory.owner = ${(<Wallet>foundation).address})`);
    let tx = await Factory.connect(foundation).addTemplate(name, Template.address, {gasLimit: 10000000})
    await tx.wait();

    /*
        5. Show result.
    */
    console.log(chalk.green.bgBlack.bold(
        `[Finished] addTemplate :: ${name}=${await Factory.templates(name)} is registered to factory=${Factory.address}\n\n`
    ));

    /*
        Return the key of template;
    */
    return name;
}
