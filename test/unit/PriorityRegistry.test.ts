import { ethers } from 'hardhat'
import { smockit, smoddit, isMockContract } from 'optimism/packages/smock';
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
import { Yamato, Pool } from '../../typechain'; 

import { genABI } from '@src/genABI';

// const PRIORITY_ABI = genABI('PriorityRegistry');

/* Parameterized Test (Testcases are in /test/parameterizedSpecs.ts) */
describe("Smock for PriorityRegistry", function() {
  it(`succeeds to make a mock`, async function() {
    const spec = await ethers.getContractFactory('PriorityRegistry')
    const mock = await smockit(spec)
    betterexpect(isMockContract(mock)).toBe(true);
  });
});

describe.skip("PriorityRegistry", function() {
  let mockYamato;
  let priorityRegistry;
  let accounts;

  beforeEach(async () => {
    accounts = await getSharedSigners();
    const spec1 = await ethers.getContractFactory('Yamato')
    mockYamato = await smockit(spec1)

    priorityRegistry = await (await ethers.getContractFactory('PriorityRegistry')).deploy(
        mockYamato.address,
    );

  });

  describe("upsert()", function() {
    it(`fails.`, async function() {
        /*
            struct Pledge {
                uint coll;
                uint debt;
                bool isCreated;
                address owner;
                uint lastUpsertedTimeICRpertenk;        
            }
        */
        const _types = ["uint256", "uint256", "bool", "address", "uint256"]
        const _data = [BigNumber.from("100000000000000000"), BigNumber.from("30000100000000000000000"), true, accounts[0], 0]
        const _pledge = encode(_types, _data);

        await betterexpect( priorityRegistry.connect(accounts[1].address).upsert(_pledge) ).toBeReverted()
    });

    it(`succeeds.`, async function() {
        const _types = []
        const _data = []
        const _pledge = encode(_types, _data);

        await priorityRegistry.addYamato(accounts[0].address); // onlyGovernance
        await priorityRegistry.upsert(_pledge)

        const _result = {};
        const _resultPledge = encode(_types, _result);
    });
  });

});
