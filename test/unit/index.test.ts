import { ethers } from 'hardhat'
import { smockit, smoddit } from '@eth-optimism/smock';
import { BigNumber, utils } from 'ethers';
const { AbiCoder, ParamType } = utils;

const reporter = (<any>global).reporter;
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
import { Severity, Reporter } from "jest-allure/dist/Reporter";
import { suite, test } from '@testdeck/jest'
import fs from 'fs';
import { BalanceLogger } from '@src/BalanceLogger';
import { BulksaleDAO, BasicPlugin } from '../../typechain'; 

import { genABI } from '@src/genABI';

const FACTORY_ABI = genABI('Factory');
const BULKSALEDAO_ABI = genABI('BulksaleDAO');
const BASICPLUGIN_ABI = genABI('BasicPlugin');
const SAMPLE_TOKEN_ABI = genABI('SampleToken');
const BULKSALEV1_ABI = genABI('BulksaleV1');



/* Parameterized Test (Testcases are in /test/parameterizedSpecs.ts) */
describe("BasicPlugin", function() {
    let provider;

    it("mocks upgrade()", async function(){
      const mockF = await ethers.getContractFactory('BasicPlugin');
      const BasicPlugin = await mockF.deploy();
      const mock = await smockit(BasicPlugin);
      mock.smocked.upgrade.will.return.with(true);

      betterexpect(await mock.callStatic.upgrade()).toEqual(true);
    });

    it("mods upgrade()", async function(){
      const mockF = await smoddit('BasicPlugin');
      const mock = await mockF.deploy();
      await mock.upgrade();
      mock.smodify.put({
        initialized: true
      })

      betterexpect(await mock.initialized()).toEqual(true);
    });

    it(`mocks indirect upgrade() and count it`, async function() {
        /* 1. Set test reporter */
        reporter
        .description("")
        .severity(Severity.Critical)
        // .feature(Feature.Betting)
        .story("");

        /* 2. Set signed contracts */
        const [foundation,deployer,alice,bob,carl,david,eve,fin,george] = await getSharedSigners();
        const signer = foundation;
        if (!provider) provider = getSharedProvider();


        // const BasicPluginModel = await forge<BasicPlugin>("BasicPlugin", BASICPLUGIN_ABI, [], foundation);
        const BasicPlugin:BasicPlugin = await forge<BasicPlugin>("BasicPlugin", BASICPLUGIN_ABI, [], signer);
        const BasicPluginMock = await smockit(BasicPlugin)
        BasicPluginMock.smocked.upgrade.will.return.with(true);

        const BulksaleDAO:BulksaleDAO = await forge<BulksaleDAO>("BulksaleDAO", BULKSALEDAO_ABI, [BasicPluginMock.address], signer);
        let bulksaleDAOInstance = new ethers.Contract(BulksaleDAO.address, BULKSALEDAO_ABI, provider);


        await bulksaleDAOInstance.callStatic.upgrade();

        betterexpect(BasicPluginMock.smocked.upgrade.calls.length).toEqual(1);
    });
});