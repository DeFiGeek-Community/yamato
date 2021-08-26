require('dotenv').config();
import {
  readFileSync,
  writeFileSync,
  unlinkSync,
  existsSync
} from 'fs';
import {
  Wallet,
  Signer,
  getDefaultProvider,
  Contract
} from "ethers";
import { genABI } from '@src/genABI';
import { isConstructSignatureDeclaration } from 'typescript';
import { DeploymentsExtension, DeploymentSubmission } from 'hardhat-deploy/types';
import { execSync } from 'child_process'
const addressExp = /address public constant factory = address\(0x([0-9a-fA-F]{40})\);/;
const EMBEDDED_MODE_FILE = '.embeddedMode';


export function hardcodeFactoryAddress(filename, address){
  let path = `contracts/${filename}.sol`;
  let tmp = readFileSync(path).toString().replace(
    addressExp,
    `address public constant factory = address(${address});`
  );
  writeFileSync(path, tmp);
}

export function goToEmbededMode(){
  writeFileSync(EMBEDDED_MODE_FILE, "");
  console.log(`\n${EMBEDDED_MODE_FILE} is created. Factory Address is from ${getLocalFactoryAddress()} to ${extractEmbeddedFactoryAddress("BulksaleV1")}. Now this command is embedded mode.\n`);
}
export function getLocalFactoryAddress(){
  return process.env.LOCAL_FACTORY_ADDERSS;
}
export function isEmbeddedMode(){
  return existsSync(EMBEDDED_MODE_FILE);
}
export function isInitMode(){
  return !isEmbeddedMode();
}

export function recoverFactoryAddress(filename){
  let path = `contracts/${filename}.sol`;
  const localAddress = getLocalFactoryAddress();
  let tmp = readFileSync(path).toString().replace(
    addressExp,
    `address public constant factory = address(${localAddress});`
  );
  writeFileSync(path, tmp);
  console.log(`deployUtil.recoverFactoryAddress() ... Embedded address is back to ${localAddress} for ${filename}`)
}
export function backToInitMode(){
  const localAddress = getLocalFactoryAddress();
  try {
    unlinkSync(EMBEDDED_MODE_FILE);
  } catch (e) {
    console.trace(e.message);   
  }
  console.log(`\n${EMBEDDED_MODE_FILE} is deleted. Now this command is initial mode. ${localAddress} is on the contract-hard-coded-value.\n`);
}

export function extractEmbeddedFactoryAddress(filename){
  let path = `contracts/${filename}.sol`;
  let group = readFileSync(path).toString().match(addressExp);
  return `0x${group[1]}`;
}

type Options = {
  from?: Signer|undefined;
  signer?: Signer|undefined;
  ABI?:any|undefined;
  args?:Array<any>|undefined;
  linkings?:Array<string>|undefined;
  log?: boolean|undefined;
  getContractFactory: any;
  deployments: DeploymentsExtension;
  gasLimit?: number|undefined;
  gasPrice?: number|undefined;
  maxPriorityFeePerGas?: number|undefined;
  maxFeePerGas?: number|undefined;
  nonce?: number|undefined;
  tag?: string|undefined;
}

export function getCurrentNetwork(){
  return process.argv[4]; // node hardhat deploy --network <network>
}
export function setProvider(){
    const provider = getDefaultProvider('rinkeby', {
        etherscan: process.env.ETHERSCAN_API_KEY,
        infura: process.env.INFURA_API_TOKEN,
        alchemy: process.env.ALCHEMY_API_TOKEN,
    });
    return singletonProvider(provider);
}
export async function deploy(contractName:string, opts:Options){
    const foundation:Signer = getFoundation();
    const deployer:Signer = getDeployer();

    if(!opts.from) opts.from = foundation;
    if(!opts.signer) opts.signer = opts.from;
    if(!opts.ABI) opts.ABI = genABI(contractName);
    if(!opts.args) opts.args = [];
    if(!opts.linkings) opts.linkings = [];
    if(!opts.log) opts.log = true;
    if(!opts.gasLimit) opts.gasLimit = 15000000; // Yay, after London!
    if(!opts.gasPrice) opts.gasPrice = 20;
    if(!opts.maxPriorityFeePerGas) opts.maxPriorityFeePerGas = 100;
    if(!opts.maxFeePerGas) opts.maxFeePerGas = 2000;
    if(!opts.nonce) opts.nonce = await opts.from.getTransactionCount("pending");
    if(!opts.tag) opts.tag = "";
    
    const _Factory = await opts.getContractFactory(contractName, {
      signer: opts.signer
    });


    
    const _Contract:Contract = await _Factory.deploy(...opts.args, {
      gasLimit: opts.gasLimit
      // maxPriorityFeePerGas: opts.maxPriorityFeePerGas,
      //  maxFeePerGas: opts.maxFeePerGas,
        // nonce: opts.nonce
    });
    const tx = _Contract.deployTransaction
    console.log(`Waiting for ${contractName} deployTx...`);
    let res = await tx.wait().catch(e=> console.trace(e.message) );
    if(!res) throw new Error(`The deployment of ${contractName} is failed.`)

    

    writeFileSync(getDeploymentAddressPath(contractName, opts.tag), _Contract.address)
    
    let contract:Contract = new Contract(_Contract.address, opts.ABI, provider);

    if(opts.log) console.log(`${contractName} is deployed as ${_Contract.address} by ${await _Contract.signer.getAddress()} on ${(await provider.getNetwork()).name} at ${await provider.getBlockNumber()} and nonce ${opts.nonce}`);

    let _signedContract:Contract = contract.connect(<Signer>opts.signer);

    return _signedContract;

}
export function getDeploymentAddressPath(contractName, tag){
  return `./deployments/${getCurrentNetwork()}/${contractName}${tag}`;
}
export function verifyWithEtherscan(){
  let ChainLinkEthUsd = readFileSync(getDeploymentAddressPath('ChainLinkMock', 'EthUsd')).toString()
  let ChainLinkJpyUsd = readFileSync(getDeploymentAddressPath('ChainLinkMock', 'JpyUsd')).toString()
  let Tellor = readFileSync(getDeploymentAddressPath('TellorCallerMock', '')).toString()
  let PriceFeed = readFileSync(getDeploymentAddressPath('PriceFeed', '')).toString()
  execSync(`npm run verify:testnet -- ${ChainLinkEthUsd} ETH/USD`)
  execSync(`npm run verify:testnet -- ${ChainLinkJpyUsd} JPY/USD`)
  execSync(`npm run verify:testnet -- ${Tellor}`)
  execSync(`npm run verify:testnet -- ${PriceFeed} ${ChainLinkEthUsd} ${ChainLinkJpyUsd} ${Tellor}`)
}


let provider;
export function singletonProvider(_provider:any|undefined=undefined){
  if(!provider) provider = _provider;
  return provider;
}

export function getFoundation():Signer{
  return new Wallet(process.env.FOUNDATION_PRIVATE_KEY, singletonProvider());
}
export function getDeployer():Signer{
  return new Wallet(process.env.DEPLOYER_PRIVATE_KEY, singletonProvider());
}

export async function sleep(n){
  return new Promise(resolve => setTimeout(resolve, n))
}