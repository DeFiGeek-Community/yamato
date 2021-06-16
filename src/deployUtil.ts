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
    if(!opts.log) opts.log = false;

    const _Factory = await opts.getContractFactory(contractName, {
      signer: opts.signer
    });


    
    const _Contract:Contract = await _Factory.deploy(...opts.args);

    let contract:Contract = new Contract(_Contract.address, opts.ABI, provider);

    if(opts.log) console.log(`${contractName} is deployed as ${_Contract.address} by ${await opts.signer.getAddress()}`);

    let _signedContract:Contract = contract.connect(<Signer>opts.signer);

    return _signedContract;

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