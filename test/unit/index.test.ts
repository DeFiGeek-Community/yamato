import { ethers } from 'hardhat'
import { smockit, smoddit } from '@eth-optimism/smock';
import { BigNumber, utils } from 'ethers';
const { AbiCoder, ParamType } = utils;

const { waffleJest } = require("@ethereum-waffle/jest");
expect.extend(waffleJest);
const betterexpect = (<any>expect); // TODO: better typing for waffleJest
import { summon, forge, create, getSharedProvider, getSharedSigners, 
  parseAddr, parseBool, parseInteger, getLogs,
  encode, decode, increaseTime,
  toERC20, toFloat, onChainNow } from "@test/param/helper";
import { getBulksaleAbiArgs, getTokenAbiArgs, sendEther } from "@test/param/scenarioHelper";
import { State } from '@test/param/parameterizedSpecs';
import { parameterizedSpecs } from '@test/param/paramSpecEntrypoint';
import { suite, test } from '@testdeck/jest'
import fs from 'fs';
import { BalanceLogger } from '@src/BalanceLogger';
import { BulksaleDAO, BasicPlugin } from '../../typechain'; 

import { genABI } from '@src/genABI';

const YAMATO_ABI = genABI('Yamato');

/* Parameterized Test (Testcases are in /test/parameterizedSpecs.ts) */
describe("Yamato", function() {
  describe("issue()", function() {
    it(`issue and count funcs`, async function() {
      const YamatoFactory = await ethers.getContractFactory('Yamato')
      const Yamato = await YamatoFactory.deploy()



      const YamatoMock = await smockit(Yamato)

      YamatoMock.smocked.issue.will.return.with('Some return value!')

      console.log(await YamatoMock.issue()) // 'Some return value!'
    });
  });
});