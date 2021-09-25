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
    const PledgeLib = ( await (await ethers.getContractFactory('PledgeLib')).deploy() ).address
    const spec = await ethers.getContractFactory('PriorityRegistry', { libraries: { PledgeLib } })
    const mock = await smockit(spec)
    betterexpect(isMockContract(mock)).toBe(true);
  });
});

describe("contract PriorityRegistry", function() {
  let mockYamato;
  let mockCjpyOS;
  let mockFeed;
  let yamato;
  let priorityRegistryWithYamatoMock;
  let priorityRegistry;
  let accounts;
  const PRICE = 300000;

  beforeEach(async () => {
    accounts = await getSharedSigners();

    const PledgeLib = ( await (await ethers.getContractFactory('PledgeLib')).deploy() ).address

    const spec1 = await ethers.getContractFactory('Yamato', { libraries: { PledgeLib } })
    const spec2 = await ethers.getContractFactory('CjpyOS')
    const spec3 = await ethers.getContractFactory('PriceFeed')

    mockYamato = await smockit(spec1)
    mockCjpyOS = await smockit(spec2)
    mockFeed = await smockit(spec3)

    mockFeed.smocked.fetchPrice.will.return.with(PRICE);
    mockCjpyOS.smocked.feed.will.return.with(mockFeed.address);
    mockYamato.smocked.getFeed.will.return.with(mockFeed.address);


    /*
      For unit tests
    */
      priorityRegistryWithYamatoMock = await (
      await ethers.getContractFactory('PriorityRegistry', { libraries: { PledgeLib } })
    ).deploy(
        mockYamato.address,
    );


    /*
      For onlyYamato tests
    */
    yamato = await spec1.deploy(mockCjpyOS.address);
    priorityRegistry = await (
      await ethers.getContractFactory('PriorityRegistry', { libraries: { PledgeLib } })
    ).deploy(
        yamato.address,
    );
    await ( await yamato.setPriorityRegistry(priorityRegistry.address) ).wait()

  });

    describe("upsert()", function() {
        it(`fails due to the call from EOA.`, async function() {
            /*
                struct Pledge {
                    uint coll;
                    uint debt;
                    bool isCreated;
                    address owner;
                    uint lastUpsertedTimeICRpertenk;
                }
            */
            const _pledge = [BigNumber.from("100000000000000000"), BigNumber.from("30000100000000000000000"), true, accounts[0].address, 0]

            await betterexpect( priorityRegistryWithYamatoMock.connect(accounts[1]).upsert(_pledge) ).toBeReverted()
        });

        it(`fails to upsert logless \(coll=0 debt=0 lastUpsertedTimeICRpertenk=0\) pledge`, async function() {
            const _pledge = [BigNumber.from("0"), BigNumber.from("0"), true, accounts[0].address, 0]
            await betterexpect( yamato.bypassUpsert(_pledge) ).toBeReverted()
        });

        it(`fails to upsert logful \(coll=0 debt=0 lastUpsertedTimeICRpertenk/=0\) pledge because such full-withdrawn pledge has to be removed`, async function() {
            // Note: deposit->noBorrow->withdrawal scenario
            const _pledge = [BigNumber.from("0"), BigNumber.from("0"), true, accounts[0].address, BigNumber.from("115792089237316195423570985008687907853269984665640564039457584007913129639935")]
            await betterexpect( yamato.bypassUpsert(_pledge) ).toBeReverted()
        });

        it(`succeeds to be called from Yamato.`, async function() {
            const pledgeLengthBefore = await priorityRegistry.pledgeLength()

            const _pledge = [BigNumber.from("100000000000000000"), BigNumber.from("30000100000000000000000"), true, accounts[0].address, 0]
            await ( await yamato.bypassUpsert(_pledge) ).wait()

            const pledgeLengthAfter = await priorityRegistry.pledgeLength()

            betterexpect(pledgeLengthAfter).toEqBN(pledgeLengthBefore.add(1))
        });

        it(`succeeds to replace an existing item with ICR=0.`, async function() {
            const pledgeLengthBefore = await priorityRegistry.pledgeLength()

            const _collBefore = BigNumber.from("100000000000000000")
            const _debtBefore = BigNumber.from("30000100000000000000000")
            const _ICRDefault = BigNumber.from("0")
            const _ICRBefore = _collBefore.mul(PRICE).mul(10000).div(_debtBefore)
            betterexpect(_ICRBefore).toEqBN("9999")
            const _pledgeBefore = [_collBefore, _debtBefore, true, accounts[0].address, _ICRDefault]
            await ( await yamato.bypassUpsert(_pledgeBefore) ).wait()

            const _collAfter = BigNumber.from("0")
            const _debtAfter = _debtBefore
            const _pledgeAfter = [_collAfter, _debtAfter, true, accounts[0].address, _ICRBefore] // Note: Have the very last ICR here
            await ( await yamato.bypassUpsert(_pledgeAfter) ).wait()

            const pledgeLengthAfter = await priorityRegistry.pledgeLength()

            betterexpect(pledgeLengthAfter).toEqBN(pledgeLengthBefore.add(1))
        });  
        it(`succeeds to upsert coll=0 debt/=0 pledge`, async function() {
            const pledgeLengthBefore = await priorityRegistry.pledgeLength()

            const _pledge = [BigNumber.from("0"), BigNumber.from("1"), true, accounts[0].address, 0]
            await ( await yamato.bypassUpsert(_pledge) ).wait()

            const pledgeLengthAfter = await priorityRegistry.pledgeLength()

            betterexpect(pledgeLengthAfter).toEqBN(pledgeLengthBefore.add(1))
        });
        it(`succeeds to upsert coll/=0 debt=0 pledge`, async function() {
            const pledgeLengthBefore = await priorityRegistry.pledgeLength()

            const _pledge = [BigNumber.from("1"), BigNumber.from("0"), true, accounts[0].address, 0]
            await ( await yamato.bypassUpsert(_pledge) ).wait()

            const pledgeLengthAfter = await priorityRegistry.pledgeLength()

            betterexpect(pledgeLengthAfter).toEqBN(pledgeLengthBefore.add(1))
        });
        it(`succeeds to update currentLICR`, async function() {
          // TODO
        });
        it(`succeeds to back-scan the very next currentLICR`, async function() {
          // TODO
        });

  });

    describe("remove()", function() {
        it(`fails to remove non-zero pledge`, async function() {
            const _collBefore = BigNumber.from("0")
            const _debtBefore = BigNumber.from("300001000000000000000000")
            const _owner = accounts[0].address

            // Note: Virtually it was a pledge with ICR=30% and now it had been redeemed. So it should be upserted to ICR=0 area.
            const _sludgePledge = [_collBefore, _debtBefore, true, _owner, 3000]
            await ( await yamato.bypassUpsert(_sludgePledge) ).wait()

            // Note: Sludge pledge is not swept in the Yamato.sol and now it is "logless zero pledge" in the Yamato.sol-side. So it should be removed.
            const _nonSweptPledge = [_collBefore, BigNumber.from("0"), true, _owner, 1]

            await betterexpect( yamato.bypassRemove(_nonSweptPledge) ).toBeReverted()

        });

        it(`succeeds to remove zero a.k.a. sludge pledge`, async function() {

            const _collBefore = BigNumber.from("0")
            const _debtBefore = BigNumber.from("300001000000000000000000")
            const _owner = accounts[0].address

            // Note: Virtually it was a pledge with ICR=30% and now it had been redeemed. So it should be upserted to ICR=0 area.
            const _sludgePledge = [_collBefore, _debtBefore, true, _owner, 3000]
            await ( await yamato.bypassUpsert(_sludgePledge) ).wait()

            // Note: Sludge pledge is swept in the Yamato.sol and now it is "logless zero pledge" in the Yamato.sol-side. So it should be removed.
            const _sweptPledge = [BigNumber.from("0"), BigNumber.from("0"), true, _owner, 0]

            const pledgeLengthBefore = await priorityRegistry.pledgeLength()
            await ( await yamato.bypassRemove(_sweptPledge) ).wait()
            const pledgeLengthAfter = await priorityRegistry.pledgeLength()

            betterexpect(pledgeLengthAfter).toEqBN(pledgeLengthBefore.sub(1))
        });      

        it(`succeeds to remove maxint a.k.a. full-withdrawal pledge`, async function() {

          const _collBefore = BigNumber.from("1000000000000000000")
          const _debtBefore = BigNumber.from("0")
          const _owner = accounts[0].address

          // Note: newly deposited
          const _sludgePledge = [_collBefore, _debtBefore, true, _owner, 0]
          await ( await yamato.bypassUpsert(_sludgePledge) ).wait()

          // Note: A deposited pledge has just been withdrawn and lastUpsertedTimeICRpertenk is maxint.
          const _withdrawnPledge = [BigNumber.from("0"), BigNumber.from("0"), true, _owner, BigNumber.from(2).pow(256).sub(1)]

          const pledgeLengthBefore = await priorityRegistry.pledgeLength()
          await ( await yamato.bypassRemove(_withdrawnPledge) ).wait()
          const pledgeLengthAfter = await priorityRegistry.pledgeLength()

          betterexpect(pledgeLengthAfter).toEqBN(pledgeLengthBefore.sub(1))
      });      

      });

    describe("popRedeemable()", function() {
      it(`fails to call it from EOA`, async function() {
        await betterexpect( priorityRegistry.popRedeemable() ).toBeReverted()
      })
      it(`fails to run in the all-sludge state`, async function() {
        await betterexpect( yamato.bypassPopRedeemable() ).toBeReverted()
      })
      it(`fails to fetch the zero pledge`, async function() {
        const _owner1 = accounts[0].address
        const _coll1 = BigNumber.from("0")
        const _debt1 = BigNumber.from("300001000000000000000000")
        const _inputPledge1 = [_coll1, _debt1, true, _owner1, 0]
        await ( await yamato.bypassUpsert(_inputPledge1) ).wait()

        // TODO: ???
        // await betterexpect( yamato.bypassPopRedeemable() ).toBeReverted()
      })

      describe("Context of lastUpsertedTimeICRpertenk", function() {
        it(`succeeds to get the lowest pledge with lastUpsertedTimeICRpertenk=0`, async function() {
          const _owner1 = accounts[0].address
          const _coll1 = BigNumber.from("1000000000000000000")
          const _debt1 = BigNumber.from("300001000000000000000000")
          const _owner2 = accounts[1].address
          const _coll2 = BigNumber.from("2000000000000000000")
          const _debt2 = BigNumber.from("300001000000000000000000")
          const _inputPledge1 = [_coll1, _debt1, true, _owner1, 0]
          const _inputPledge2 = [_coll2, _debt2, true, _owner2, 0]

          await ( await yamato.bypassUpsert(_inputPledge1) ).wait()
          await ( await yamato.bypassUpsert(_inputPledge2) ).wait()

          const nextRedeemableBefore = await priorityRegistry.nextRedeemable();
          await (await yamato.bypassPopRedeemable()).wait()
          const nextRedeemableAfter = await priorityRegistry.nextRedeemable();

          betterexpect(nextRedeemableBefore.coll).toEqBN(_coll1)
          betterexpect(nextRedeemableBefore.debt).toEqBN(_debt1)
          betterexpect(nextRedeemableBefore.owner).toBe(_owner1)
          betterexpect(nextRedeemableAfter.coll).toEqBN(0)
          betterexpect(nextRedeemableAfter.debt).toEqBN(0)
          betterexpect(nextRedeemableAfter.isCreated).toBe(false)
        });
        it(`succeeds to get the lowest pledge with lastUpsertedTimeICRpertenk\>0`, async function() {
          const _owner1 = accounts[0].address
          const _coll1 = BigNumber.from("1000000000000000000")
          const _debt1 = BigNumber.from("300001000000000000000000")
          const _owner2 = accounts[1].address
          const _coll2 = BigNumber.from("2000000000000000000")
          const _debt2 = BigNumber.from("300001000000000000000000")
          const _debt3 = _debt1.add("30001000000000000000000");
          const _debt4 = _debt2.add("30002000000000000000000");
          const _inputPledge1 = [_coll1, _debt1, true, _owner1, 0]
          const _inputPledge2 = [_coll2, _debt2, true, _owner2, 0]
          const _inputPledge3 = [_coll1, _debt3, true, _owner1, 9999]
          const _inputPledge4 = [_coll2, _debt4, true, _owner2, 19999]

          await ( await yamato.bypassUpsert(_inputPledge1) ).wait()
          await ( await yamato.bypassUpsert(_inputPledge2) ).wait()
          await ( await yamato.bypassUpsert(_inputPledge3) ).wait()
          await ( await yamato.bypassUpsert(_inputPledge4) ).wait()

          const nextRedeemableBefore = await priorityRegistry.nextRedeemable();
          await (await yamato.bypassPopRedeemable()).wait()
          const nextRedeemableAfter = await priorityRegistry.nextRedeemable();

          betterexpect(nextRedeemableBefore.coll).toEqBN(_coll1)
          betterexpect(nextRedeemableBefore.debt).toEqBN(_debt3)
          betterexpect(nextRedeemableBefore.owner).toBe(_owner1)
          betterexpect(nextRedeemableAfter.coll).toEqBN(0)
          betterexpect(nextRedeemableAfter.debt).toEqBN(0)
          betterexpect(nextRedeemableAfter.isCreated).toBe(false)
          betterexpect(await priorityRegistry.currentLICRpertenk()).toEqBN(9090)
        });
      });
    });

    describe("popSweepable()", function() {
      it(`fails to call it from EOA`, async function() {
        await betterexpect( priorityRegistry.popSweepable() ).toBeReverted()
      })

      it(`fails to run if there're no sludge pledge`, async function() {
        await betterexpect( yamato.bypassPopSweepable() ).toBeReverted()
      })

      it(`fails to fetch the zero pledge`, async function() {
        const _owner1 = accounts[0].address
        const _coll1 = BigNumber.from("0")
        const _debt1 = BigNumber.from("300001000000000000000000")
        const _inputPledge1 = [_coll1, _debt1, true, _owner1, 0]
        await ( await yamato.bypassUpsert(_inputPledge1) ).wait()

        const nextSweepableBefore = await priorityRegistry.nextSweepable();
        await (await yamato.bypassPopSweepable()).wait()
        const nextSweepableAfter = await priorityRegistry.nextSweepable();

        betterexpect(nextSweepableBefore.coll).toEqBN(_coll1)
        betterexpect(nextSweepableBefore.debt).toEqBN(_debt1)
        betterexpect(nextSweepableBefore.owner).toBe(_owner1)
        betterexpect(nextSweepableAfter.coll).toEqBN(0)
        betterexpect(nextSweepableAfter.debt).toEqBN(0)
        betterexpect(nextSweepableAfter.isCreated).toBe(false)

      })

    });

  });
