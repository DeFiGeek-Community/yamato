const { ethers } = require("hardhat");
import { BigNumber } from "ethers";
import { summon, getSharedProvider, getSharedSigners, 
  parseAddr, parseBool, parseInteger, getLogs,
  encode, decode, increaseTime } from "./helper";


export function getTokenAbiArgs(templateName:string, {
    initialSupply,
    name,
    symbol,
    owner
}:{
    initialSupply: BigNumber,
    name: string,
    symbol: string,
    owner: string
}){
    let types;
    if(!templateName || templateName.length==0) throw new Error(`scenarioHelper::getTokenAbiArgs() -> templateName is empty.`);
    if(templateName.indexOf('OwnableToken') == 0){
        types = ["uint", "string", "string", "address"]
    } else {
        console.trace(`${templateName} is not planned yet. Add your typedef for abi here.`);
        throw 1;
    }
    return encode(
        types,
        [initialSupply, name, symbol, owner]
    );

}

export function getBulksaleAbiArgs(templateName:string, {
    token,
    start,
    eventDuration,
    lockDuration,
    expirationDuration,
    sellingAmount,
    minEtherTarget,
    owner,
    feeRatePerMil
}:{
    token: string,
    start: number/* unixtime in sec (not milisec) */,
    eventDuration: number /* in sec */,
    lockDuration: number /* in sec */,
    expirationDuration: number /* in sec */,
    sellingAmount: BigNumber,
    minEtherTarget: BigNumber,
    owner: string,
    feeRatePerMil: number
}){
    let types;
    if(!templateName || templateName.length==0) throw new Error(`scenarioHelper::getBulksaleAbiArgs() -> templateName is empty.`);
    if(templateName.indexOf("BulksaleV1") == 0){
        types = ["address", "uint", "uint", "uint", "uint", "uint", "uint", 'address', 'uint'];
    } else if(templateName.indexOf("BulksaleV1") == 0) {
        types = ["address", "uint", "uint", "uint", "uint", "uint", "uint", 'address', 'uint'];
    } else if(templateName == 'ERC20CRV.vy') {// for revert test
        types = ["address", "uint", "uint", "uint", "uint", "uint", "uint", 'address', 'uint'];
    } else {
        console.trace(`${templateName} is not planned yet. Add your typedef for abi here.`);
        throw 1;
    }
    if( feeRatePerMil < 1 || 100 <= feeRatePerMil ) throw new Error("feeRatePerMil is out of range.");

    return encode(
        types,
        [token, start, eventDuration, lockDuration, expirationDuration, sellingAmount, minEtherTarget, owner, feeRatePerMil]
    );
}


export async function sendERC20(erc20contract:any, to:any, amountStr:string, signer){
    let sendResult = await (await signer.sendTransaction({
        to: to,
        value: ethers.utils.parseEther(amountStr)
    })).wait();
}
export async function sendEther(to:any, amountStr:string, signer){
    let sendResult = await (await signer.sendTransaction({
        to: to,
        value: ethers.utils.parseEther(amountStr)
    })).wait();
}