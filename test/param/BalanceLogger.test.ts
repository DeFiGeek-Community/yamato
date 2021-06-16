const { ethers } = require("hardhat");
import { BigNumber } from 'ethers';

const reporter = (<any>global).reporter;
const { waffleJest } = require("@ethereum-waffle/jest");
expect.extend(waffleJest);
const betterexpect = (<any>expect); // TODO: better typing for waffleJest

import { summon, create, getSharedProvider, getSharedSigners, 
  parseAddr, parseBool, parseInteger, getLogs,
  encode, decode, increaseTime,
  toERC20, toFloat, onChainNow } from "./helper";
import { State } from './parameterizedSpecs';
import { Severity, Reporter } from "jest-allure/dist/Reporter";
import { suite, test } from '@testdeck/jest';
import { BalanceLogger } from '@src/BalanceLogger';

/* TestUtil */
describe("BalanceLogger", function(){
    describe(".ltAbsOneBN()", function(){
        let bl;
        beforeAll(()=>{
            bl = new BalanceLogger({}, {}, getSharedProvider(), 'foo');
        })
        it("checks 1", ()=> expect( bl.ltAbsOneBN("1") ).toBe(false) )
        it("checks -1", ()=> expect( bl.ltAbsOneBN("-1") ).toBe(false) )
        it("checks 1*10^18", ()=> expect( bl.ltAbsOneBN(toERC20("1")) ).toBe(false) )
        it("checks -1*10^18", ()=> expect( bl.ltAbsOneBN(toERC20("-1")) ).toBe(false) )
        it("checks 0", ()=> expect( bl.ltAbsOneBN("0") ).toBe(true) )
        it("checks 0.0", ()=> expect( bl.ltAbsOneBN("0.0") ).toBe(true) )
        it("checks 0*10^18", ()=> expect( bl.ltAbsOneBN(toERC20("0")) ).toBe(true) )
        it("checks 0.9", ()=> expect( bl.ltAbsOneBN("0.9") ).toBe(true) )
        it("checks 0.9*10^18", ()=> expect( bl.ltAbsOneBN(toERC20("0.9")) ).toBe(false) )
        it("checks -0.9", ()=> expect( bl.ltAbsOneBN("-0.9") ).toBe(true) )
        it("checks -0.9*10^18", ()=> expect( bl.ltAbsOneBN(toERC20("-0.9")) ).toBe(false) )
        it("checks 9007199254740990", ()=> expect( bl.ltAbsOneBN("9007199254740990") ).toBe(false) )
        it("checks 9007199254740991", ()=> expect( bl.ltAbsOneBN("9007199254740991") ).toBe(false) )
        it("checks 300000000532312999532312999", ()=> expect( bl.ltAbsOneBN("300000000532312999532312999") ).toBe(false) )
        it("checks 18159105037311609774740371", ()=> expect( bl.ltAbsOneBN("18159105037311609774740371") ).toBe(false) )
        it("checks -18159105037311609774740371.000000000000001", ()=> expect( bl.ltAbsOneBN("-18159105037311609774740371.000000000000001") ).toBe(false) )
        it("checks 115,792,089,237,316,195,423,570,985,008,687,907,853,269,984,‌​665,640,564,039,457", ()=> expect( bl.ltAbsOneBN("115,792,089,237,316,195,423,570,985,008,687,907,853,269,984,‌​665,640,564,039,457".replace(/,/,'')) ).toBe(false) )     
    });
});
