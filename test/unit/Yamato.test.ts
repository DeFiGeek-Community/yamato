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

const YAMATO_ABI = genABI('Yamato');

/* Parameterized Test (Testcases are in /test/parameterizedSpecs.ts) */
describe("Smock for Yamato", function() {
  it(`succeeds to make a mock`, async function() {
    const spec1 = await ethers.getContractFactory('PledgeLib')
    const pledgeMock = await smockit(spec1)
    const spec2 = await ethers.getContractFactory('Yamato', {
      libraries: {
        PledgeLib: pledgeMock.address
      }
    })
    const yamatoMock = await smockit(spec2)
    betterexpect(isMockContract(yamatoMock)).toBe(true);
  });
});

describe("Yamato", function() {
  let mockPool;
  let mockFeed;
  let mockYMT;
  let mockCJPY;
  let mockCjpyOS;
  let yamato;
  let PRICE;
  let MCR;

  beforeEach(async () => {
    const PledgeLib = ( await (await ethers.getContractFactory('PledgeLib')).deploy() ).address

    const spec1 = await ethers.getContractFactory('Pool')
    const spec2 = await ethers.getContractFactory('PriceFeed')
    const spec3 = await ethers.getContractFactory('YMT')
    const spec4 = await ethers.getContractFactory('CJPY')
    const spec5 = await ethers.getContractFactory('CjpyOS')

    mockPool = await smockit(spec1)
    mockFeed = await smockit(spec2)
    mockYMT = await smockit(spec3)
    mockCJPY = await smockit(spec4)
    mockCjpyOS = await smockit(spec5)
    yamato = await (await ethers.getContractFactory('Yamato', { libraries: { PledgeLib } })).deploy(
      mockCjpyOS.address
    );
    await (await yamato.setPool(mockPool.address)).wait()

    PRICE = 260000;
    MCR = 1.1;

    mockPool.smocked['depositRedemptionReserve(uint256)'].will.return.with(0);
    mockPool.smocked['depositSweepReserve(uint256)'].will.return.with(0);
    mockPool.smocked['lockETH(uint256)'].will.return.with(0);
    mockFeed.smocked.fetchPrice.will.return.with(PRICE);
    mockPool.smocked.redemptionReserve.will.return.with(1);
    mockPool.smocked.sweepReserve.will.return.with(1);
    mockCjpyOS.smocked.feed.will.return.with(mockFeed.address);

  });

  describe("deposit()", function() {
    it(`succeeds to make a pledge and totalCollDiff>0 totalDebtDiff=0`, async function() {
      const toCollateralize = 1;

      const totalCollBefore = await yamato.totalColl();
      const totalDebtBefore = await yamato.totalDebt();

      await yamato.deposit({value:toERC20(toCollateralize+"")});

      const totalCollAfter = await yamato.totalColl();
      const totalDebtAfter = await yamato.totalDebt();

      betterexpect(totalCollAfter).toBeGtBN(totalCollBefore);
      betterexpect(totalDebtAfter).toEqBN(totalDebtBefore);
    });
  });
  describe("FR()", function() { /* Given ICR, get borrowing fee. */
    it(`returns 2000 pertenk for ICR 11000 pertenk`, async function() {
      betterexpect(await yamato.FR(11000)).toEqBN(2000);
    });
    it(`returns 2000 pertenk for ICR 11001 pertenk`, async function() {
      betterexpect(await yamato.FR(11001)).toEqBN(2000);
    });
    it(`returns 1999 pertenk for ICR 11002 pertenk`, async function() {
      betterexpect(await yamato.FR(11002)).toEqBN(1999);
    });
    it(`returns 1992 pertenk for ICR 11010 pertenk`, async function() {
      betterexpect(await yamato.FR(11010)).toEqBN(1992);
    });
    it(`returns 800 pertenk for ICR 12500 pertenk`, async function() {
      betterexpect(await yamato.FR(12500)).toEqBN(800);
    });
    it(`returns 480 pertenk for ICR 12900 pertenk`, async function() {
      betterexpect(await yamato.FR(12900)).toEqBN(480);
    });
    it(`returns 400 pertenk for ICR 13000 pertenk`, async function() {
      betterexpect(await yamato.FR(13000)).toEqBN(400);
    });
    it(`returns 210 pertenk for ICR 14900 pertenk`, async function() {
      betterexpect(await yamato.FR(14900)).toEqBN(210);
    });
    it(`returns 200 pertenk for ICR 15000 pertenk`, async function() {
      betterexpect(await yamato.FR(15000)).toEqBN(200);
    });
    it(`returns 150 pertenk for ICR 17500 pertenk`, async function() {
      betterexpect(await yamato.FR(17500)).toEqBN(150);
    });
    it(`returns 102 pertenk for ICR 19900 pertenk`, async function() {
      betterexpect(await yamato.FR(19900)).toEqBN(102);
    });
    it(`returns 100 pertenk for ICR 20000 pertenk`, async function() {
      betterexpect(await yamato.FR(20000)).toEqBN(100);
    });
    it(`returns 85 pertenk for ICR 25000 pertenk`, async function() {
      betterexpect(await yamato.FR(25000)).toEqBN(85);
    });
    it(`returns 70 pertenk for ICR 30000 pertenk`, async function() {
      betterexpect(await yamato.FR(30000)).toEqBN(70);
    });
    it(`returns 40 pertenk for ICR 40000 pertenk`, async function() {
      betterexpect(await yamato.FR(40000)).toEqBN(40);
    });
    it(`returns 11 pertenk for ICR 49700 pertenk`, async function() {
      betterexpect(await yamato.FR(49700)).toEqBN(11);
    });
    it(`returns 11 pertenk for ICR 49800 pertenk`, async function() {
      betterexpect(await yamato.FR(49800)).toEqBN(11);
    });
    it(`returns 11 pertenk for ICR 49900 pertenk`, async function() {
      betterexpect(await yamato.FR(49900)).toEqBN(11);
    });
    it(`returns 10 pertenk for ICR 50000 pertenk`, async function() {
      betterexpect(await yamato.FR(50000)).toEqBN(10);
    });
  });
  describe("borrow()", function() {
    beforeEach(async function(){
      mockPool.smocked['depositRedemptionReserve(uint256)'].will.return.with(0);
      mockCjpyOS.smocked['mintCJPY(address,uint256)'].will.return.with(0);
    });
    it(`succeeds to make a pledge with ICR=110%, and the TCR will be 110%`, async function() {
      const toCollateralize = 1;
      const toBorrow = (PRICE * toCollateralize) / MCR;
      await yamato.deposit({value:toERC20(toCollateralize+"")});
      await yamato.borrow(toERC20(toBorrow+""));
      const _TCR = await yamato.TCR();

      betterexpect(_TCR).toEqBN("110");

      const pledge = await yamato.getPledge(await yamato.signer.getAddress());

      betterexpect(pledge.coll.toString()).toBe("1000000000000000000");
      betterexpect(pledge.debt.toString()).toBe("236363636363636350000000");
    });
    it(`should have zero ETH balance after issuance`, async function() {
      const toCollateralize = 1;
      const toBorrow = (PRICE * toCollateralize) / MCR;
      await yamato.deposit({value:toERC20(toCollateralize+"")});
      await yamato.borrow(toERC20(toBorrow+""));

      const balance = await yamato.provider.getBalance(yamato.address);
      betterexpect(balance.toString()).toBe("0");
    });

    it(`should run fetchPrice() of Pool.sol`, async function(){
      const toCollateralize = 1;
      const toBorrow = (PRICE * toCollateralize) / MCR;
      await yamato.deposit({value:toERC20(toCollateralize+"")});
      await yamato.borrow(toERC20(toBorrow+""));
      betterexpect(mockFeed.smocked.fetchPrice.calls.length).toBeGtBN(1);
    });
    it(`should run CjpyOS.mintCJPY() of Pool.sol`, async function(){
      const toCollateralize = 1;
      const toBorrow = (PRICE * toCollateralize) / MCR;
      await yamato.deposit({value:toERC20(toCollateralize+"")});
      await yamato.borrow(toERC20(toBorrow+""));
      betterexpect(mockCJPY.smocked['mint(address,uint256)'].calls.length).toBe(0);
      betterexpect(mockCjpyOS.smocked['mintCJPY(address,uint256)'].calls.length).toBe(2);
    });
    it(`should run depositRedemptionReserve when RR is inferior to SR`, async function() {
      mockPool.smocked.redemptionReserve.will.return.with(1);
      mockPool.smocked.sweepReserve.will.return.with(10);
      const toCollateralize = 1;
      const toBorrow = (PRICE * toCollateralize) / MCR;
      await yamato.deposit({value:toERC20(toCollateralize+"")});
      await yamato.borrow(toERC20(toBorrow+""));
      betterexpect(mockPool.smocked['depositRedemptionReserve(uint256)'].calls.length).toBe(1);
      betterexpect(mockPool.smocked['depositSweepReserve(uint256)'].calls.length).toBe(0);
    });
    it(`should run depositSweepReserve when RR is superior to SR`, async function() {
      mockPool.smocked.redemptionReserve.will.return.with(10);
      mockPool.smocked.sweepReserve.will.return.with(1);
      const toCollateralize = 1;
      const toBorrow = (PRICE * toCollateralize) / MCR;
      await yamato.deposit({value:toERC20(toCollateralize+"")});
      await yamato.borrow(toERC20(toBorrow+""));
      betterexpect(mockPool.smocked['depositRedemptionReserve(uint256)'].calls.length).toBe(0);
      betterexpect(mockPool.smocked['depositSweepReserve(uint256)'].calls.length).toBe(1);
    });
  });
  describe("repay()", function() {
    const PRICE = 260000;
    beforeEach(async function(){
      mockCjpyOS.smocked['burnCJPY(address,uint256)'].will.return.with(0);
      mockFeed.smocked.fetchPrice.will.return.with(PRICE);
    });

    it(`should reduce debt`, async function() {
      const MCR = 1.1;
      const toCollateralize = 1;
      const toBorrow = (PRICE * toCollateralize) / MCR;
      await yamato.deposit({value:toERC20(toCollateralize+"")});
      await yamato.borrow(toERC20(toBorrow+""));
      const pledgeBefore = await yamato.getPledge(await yamato.signer.getAddress());

      betterexpect(pledgeBefore.coll.toString()).toBe("1000000000000000000");
      betterexpect(pledgeBefore.debt.toString()).toBe("236363636363636350000000");


      await yamato.repay(toERC20(toBorrow+""));

      const pledgeAfter = await yamato.getPledge(await yamato.signer.getAddress());

      betterexpect(pledgeAfter.coll.toString()).toBe("1000000000000000000");
      betterexpect(pledgeAfter.debt.toString()).toBe("0");
    });
    it(`should improve TCR`, async function() {
      const MCR = 1.1;
      const toCollateralize = 1;
      const toBorrow = (PRICE * toCollateralize) / MCR;
      await yamato.deposit({value:toERC20(toCollateralize+"")});
      await yamato.borrow(toERC20(toBorrow+""));
      const TCRbefore = await yamato.TCR();
 
      await yamato.repay(toERC20(toBorrow+""));
      const TCRafter = await yamato.TCR();

      betterexpect(TCRafter).toBeGtBN(TCRbefore);
      betterexpect(TCRafter.toString()).toBe("115792089237316195423570985008687907853269984665640564039457584007913129639935");
    });
    it(`should run burnCJPY`, async function() {
      const MCR = 1.1;      
      const toCollateralize = 1;
      const toBorrow = (PRICE * toCollateralize) / MCR;
      await yamato.deposit({value:toERC20(toCollateralize+"")});
      await yamato.borrow(toERC20(toBorrow+""));
      await yamato.repay(toERC20(toBorrow+""));
      betterexpect(mockCjpyOS.smocked['burnCJPY(address,uint256)'].calls.length).toBe(1);
    });

    it(`can repay even under TCR < MCR`, async function() {
      const MCR = 1.1;
      const toCollateralize = 1;
      const toBorrow = (PRICE * toCollateralize) / MCR;
      await yamato.deposit({value:toERC20(toCollateralize+"")});
      await yamato.borrow(toERC20(toBorrow+""));
 
      mockFeed.smocked.fetchPrice.will.return.with(PRICE/2);
      const dumpedTCR = await yamato.TCR();
      betterexpect(parseInt(dumpedTCR.toString()) < MCR*100).toBe(true);

      const TCRbefore = await yamato.TCR();
      await yamato.repay(toERC20(toBorrow+""));
      const TCRafter = await yamato.TCR();

      betterexpect(TCRafter).toBeGtBN(TCRbefore);
    });
    it(`fails for empty cjpy amount`, async function() {
      const MCR = 1.1;
      const toCollateralize = 1;
      const toBorrow = (PRICE * toCollateralize) / MCR;
      await yamato.deposit({value:toERC20(toCollateralize+"")});
      await yamato.borrow(toERC20(toBorrow+""));
      await betterexpect( yamato.repay(toERC20(0+"")) ).toBeReverted(); 
    });
    it(`fails for no-debt pledge`, async function() {
      const MCR = 1.1;
      const toCollateralize = 1;
      const toBorrow = (PRICE * toCollateralize) / MCR;
      await yamato.deposit({value:toERC20(toCollateralize+"")});
      await betterexpect( yamato.repay(toERC20(toBorrow+"")) ).toBeReverted(); 
    });


    // TODO: Have a attack contract to recursively calls the deposit and borrow function
    it.todo(`should validate locked state`)
  });

  describe("withdraw()", function() {
    const PRICE = 260000;
    beforeEach(async function(){
      mockFeed.smocked.fetchPrice.will.return.with(PRICE);
      mockPool.smocked['sendETH(address,uint256)'].will.return.with(0);     
    });

    it(`should validate locked state`, async function() {
      const MCR = 1.1;
      const toCollateralize = 1;
      const toBorrow = (PRICE * toCollateralize) / MCR / 10;
      await yamato.deposit({value:toERC20(toCollateralize+"")});
      await yamato.borrow(toERC20(toBorrow+""));
      await betterexpect( yamato.withdraw(toERC20(toCollateralize/10+"")) ).toBeReverted();
    });
    it(`should reduce coll`, async function() {
      const MCR = 1.1;
      const toCollateralize = 1;
      const toBorrow = (PRICE * toCollateralize) / MCR / 10;
      await yamato.deposit({value:toERC20(toCollateralize+"")});
      await yamato.borrow(toERC20(toBorrow+""));
      const pledgeBefore = await yamato.getPledge(await yamato.signer.getAddress());

      betterexpect(pledgeBefore.coll.toString()).toBe("1000000000000000000");
      betterexpect(pledgeBefore.debt.toString()).toBe("23636363636363636000000");

      yamato.provider.send("evm_increaseTime", [60*60*24*3+1])
      yamato.provider.send("evm_mine")

      await yamato.withdraw(toERC20(toCollateralize/10+""));

      const pledgeAfter = await yamato.getPledge(await yamato.signer.getAddress());

      betterexpect(pledgeAfter.coll.toString()).toBe(toERC20(toCollateralize*9/10+"").toString());
      betterexpect(pledgeAfter.debt.toString()).toBe("23636363636363636000000");
    });
    it.skip(`should decrease TCR`, async function() {
      const MCR = 1.1;
      mockFeed.smocked.fetchPrice.will.return.with(PRICE);
      mockPool.smocked['sendETH(address,uint256)'].will.return.with(0);     

      const toCollateralize = 1;
      const toBorrow = (PRICE * toCollateralize) / MCR / 10;
      await yamato.deposit({value:toERC20(toCollateralize+"")});
      await yamato.borrow(toERC20(toBorrow+""));
      const pledgeBefore = await yamato.getPledge(await yamato.signer.getAddress());

      betterexpect(pledgeBefore.coll.toString()).toBe("1000000000000000000");
      betterexpect(pledgeBefore.debt.toString()).toBe("0");

      yamato.provider.send("evm_increaseTime", [60*60*24*3+1])
      yamato.provider.send("evm_mine")


      const TCRbefore = await yamato.TCR();

      await yamato.withdraw(toERC20(toCollateralize/10+""));
      const TCRafter = await yamato.TCR();

      betterexpect(TCRafter).toBeLtBN(TCRbefore);

    });
    it(`can't be executed in the TCR < MCR`, async function() {
      const MCR = 1.1;
      mockFeed.smocked.fetchPrice.will.return.with(PRICE);
      mockPool.smocked['sendETH(address,uint256)'].will.return.with(0);     

      const toCollateralize = 1;
      const toBorrow = (PRICE * toCollateralize) / MCR;
      await yamato.deposit({value:toERC20(toCollateralize+"")});
      await yamato.borrow(toERC20(toBorrow+""));
      const pledgeBefore = await yamato.getPledge(await yamato.signer.getAddress());

      betterexpect(pledgeBefore.coll.toString()).toBe("1000000000000000000");
      betterexpect(pledgeBefore.debt.toString()).toBe("236363636363636350000000");

      yamato.provider.send("evm_increaseTime", [60*60*24*3+1])
      yamato.provider.send("evm_mine")

      mockFeed.smocked.fetchPrice.will.return.with(PRICE/2);

      await betterexpect( yamato.withdraw(toERC20(toCollateralize/10+"")) ).toBeReverted();

    });
    it(`can't make ICR < MCR by this withdrawal`, async function() {
      const MCR = 1.1;
      mockFeed.smocked.fetchPrice.will.return.with(PRICE);
      mockPool.smocked['sendETH(address,uint256)'].will.return.with(0);     

      const toCollateralize = 1;
      const toBorrow = (PRICE * toCollateralize) / MCR;
      await yamato.deposit({value:toERC20(toCollateralize+"")});
      await yamato.borrow(toERC20(toBorrow+""));
      const pledgeBefore = await yamato.getPledge(await yamato.signer.getAddress());

      betterexpect(pledgeBefore.coll.toString()).toBe("1000000000000000000");
      betterexpect(pledgeBefore.debt.toString()).toBe("236363636363636350000000");

      yamato.provider.send("evm_increaseTime", [60*60*24*3+1])
      yamato.provider.send("evm_mine")

      mockFeed.smocked.fetchPrice.will.return.with(PRICE/2);

      await betterexpect( yamato.withdraw(toERC20(toCollateralize/10+"")) ).toBeReverted();
    });
    it.todo(`should run sendETH() of Pool.sol`);
  });

  describe("redeem()", function() {
    let accounts, PRICE, PRICE_AFTER, MCR, toCollateralize, toBorrow
    beforeEach(async () => {
      accounts = await getSharedSigners();
      PRICE = 260000;
      PRICE_AFTER = PRICE/2;
      MCR = 1.1;
      mockPool.smocked['depositRedemptionReserve(uint256)'].will.return.with(0);
      mockPool.smocked['depositSweepReserve(uint256)'].will.return.with(0);
      mockPool.smocked['lockETH(uint256)'].will.return.with(0);
      mockPool.smocked['sendETH(address,uint256)'].will.return.with(0);
      mockPool.smocked.redemptionReserve.will.return.with(1000000000000);
      mockFeed.smocked.fetchPrice.will.return.with(PRICE);

      toCollateralize = 1;
      toBorrow = (PRICE * toCollateralize) / MCR;

      /* Set lower ICR */
      await yamato.connect(accounts[0]).deposit({value:toERC20(toCollateralize+"")});
      await yamato.connect(accounts[0]).borrow(toERC20(toBorrow+""));
      await yamato.connect(accounts[1]).deposit({value:toERC20(toCollateralize+"")});
      await yamato.connect(accounts[1]).borrow(toERC20(toBorrow+""));
      await yamato.connect(accounts[2]).deposit({value:toERC20(toCollateralize+"")});
      await yamato.connect(accounts[2]).borrow(toERC20(toBorrow+""));

      mockFeed.smocked.fetchPrice.will.return.with(PRICE_AFTER);

      /* Set higher ICR */
      await yamato.connect(accounts[3]).deposit({value:toERC20(toCollateralize*2+"")});
      await yamato.connect(accounts[3]).borrow(toERC20(toBorrow+""));
      await yamato.connect(accounts[4]).deposit({value:toERC20(toCollateralize*2+"")});
      await yamato.connect(accounts[4]).borrow(toERC20(toBorrow+""));
      await yamato.connect(accounts[5]).deposit({value:toERC20(toCollateralize*2+"")});
      await yamato.connect(accounts[5]).borrow(toERC20(toBorrow+""));
    });

    it(`should expense coll of lowest ICR pledges`, async function() {
      let _pledge0 = await yamato.getPledge(accounts[0].address);
      let _pledge1 = await yamato.getPledge(accounts[1].address);
      let _pledge2 = await yamato.getPledge(accounts[2].address);
      betterexpect(_pledge0.coll).toEqBN(toERC20(toCollateralize+""));
      betterexpect(_pledge1.coll).toEqBN(toERC20(toCollateralize+""));
      betterexpect(_pledge2.coll).toEqBN(toERC20(toCollateralize+""));

      await yamato.connect(accounts[0]).redeem(toERC20(toBorrow*3+""), false);

      _pledge0 = await yamato.getPledge(accounts[0].address);
      _pledge1 = await yamato.getPledge(accounts[1].address);
      _pledge2 = await yamato.getPledge(accounts[2].address);
      betterexpect(_pledge0.coll).toEqBN("0");
      betterexpect(_pledge1.coll).toEqBN("0");
      betterexpect(_pledge2.coll).toEqBN("0");
    });
    it(`should improve TCR when TCR > 1`, async function() {
      const PRICE_A_BIT_DUMPED = PRICE*0.65;
      mockFeed.smocked.fetchPrice.will.return.with(PRICE_A_BIT_DUMPED);

      const TCRBefore = await yamato.TCR();
      await yamato.connect(accounts[0]).redeem(toERC20(toBorrow+""), false);
      const TCRAfter = await yamato.TCR();

      betterexpect(TCRAfter).toBeGtBN(TCRBefore);
    });
    it(`should shrink TCR when TCR < 1`, async function() {
      mockFeed.smocked.fetchPrice.will.return.with(PRICE_AFTER);
      const TCRBefore = await yamato.TCR();
      await yamato.connect(accounts[0]).redeem(toERC20(toBorrow+""), false);
      const TCRAfter = await yamato.TCR();

      betterexpect(TCRAfter).toBeLtBN(TCRBefore);
    });
    it(`should not run if there are no ICR < MCR pledges`, async function() {
      mockFeed.smocked.fetchPrice.will.return.with(PRICE*2);
      await betterexpect(yamato.connect(accounts[0]).redeem(toERC20(toBorrow+""), false) ).toBeReverted();
    });
    it(`should NOT run useRedemptionReserve() of Pool.sol when isCoreRedemption=false`, async function(){
      await yamato.connect(accounts[0]).redeem(toERC20(toBorrow+""), false);
      betterexpect(mockPool.smocked['useRedemptionReserve(uint256)'].calls.length).toBe(0);
    });
    it(`should run useRedemptionReserve() of Pool.sol when isCoreRedemption=false`, async function(){
      await yamato.connect(accounts[0]).redeem(toERC20(toBorrow+""), true);
      betterexpect(mockPool.smocked['useRedemptionReserve(uint256)'].calls.length).toBe(1);
    });
    it(`should run accumulateDividendReserve() of Pool.sol`, async function(){
      await yamato.connect(accounts[0]).redeem(toERC20(toBorrow+""), false);
      betterexpect(mockPool.smocked['accumulateDividendReserve(uint256)'].calls.length).toBe(0);
    });
    it(`should run sendETH() of Pool.sol for successful redeemer`, async function(){
      await yamato.connect(accounts[0]).redeem(toERC20(toBorrow+""), false);
      betterexpect(mockPool.smocked['sendETH(address,uint256)'].calls.length).toBe(1);
    });
    it(`should run burnCJPY() of Yamato.sol for successful redeemer`, async function(){
      await yamato.connect(accounts[0]).redeem(toERC20(toBorrow+""), false);
      betterexpect(mockCjpyOS.smocked['burnCJPY(address,uint256)'].calls.length).toBe(1);
    });
    it.skip(`can remain coll=0 debt>0 pledge in the storage`, async function() {
    });
    it.skip(`doesn't remain any sorted Trove state in the contract`, async function() {
    });
    it.todo(`should reduce CJPY of successful redeemer`)
    it.todo(`should not reduce CJPY when there're no ICR<MCR && coll>0 pledges`)

  });

  describe("sweep()", function() {
    let accounts, PRICE, PRICE_AFTER, MCR, toCollateralize, toBorrow
    beforeEach(async () => {
      accounts = await getSharedSigners();
      PRICE = 260000;
      PRICE_AFTER = PRICE/2;
      MCR = 1.1;
      mockPool.smocked['depositRedemptionReserve(uint256)'].will.return.with(0);
      mockPool.smocked['depositSweepReserve(uint256)'].will.return.with(0);
      mockPool.smocked['lockETH(uint256)'].will.return.with(0);
      mockPool.smocked['sendETH(address,uint256)'].will.return.with(0);
      mockPool.smocked['useSweepReserve(uint256)'].will.return.with(0);
      mockPool.smocked.sweepReserve.will.return.with(10000000000000);
      mockFeed.smocked.fetchPrice.will.return.with(PRICE);
      mockCjpyOS.smocked['burnCJPY(address,uint256)'].will.return.with(0);

      toCollateralize = 1;
      toBorrow = (PRICE * toCollateralize) / MCR;
      await yamato.connect(accounts[2]).deposit({value:toERC20(toCollateralize+"")});
      await yamato.connect(accounts[2]).borrow(toERC20(toBorrow+""));
      await yamato.connect(accounts[3]).deposit({value:toERC20(toCollateralize+"")});
      await yamato.connect(accounts[3]).borrow(toERC20(toBorrow+""));

      mockFeed.smocked.fetchPrice.will.return.with(PRICE_AFTER);

    });


    it(`should improve TCR`, async function() {


      mockFeed.smocked.fetchPrice.will.return.with(PRICE_AFTER);
      await yamato.connect(accounts[0]).redeem(toERC20(toBorrow+""), false);

      const debtBefore = await yamato.totalDebt();

      await yamato.connect(accounts[1]).sweep();

      const debtAfter = await yamato.totalDebt();

      betterexpect(debtAfter).toBeLtBN(debtBefore);

    });
    it.skip(`doesn't care how much TCR is. (compare to MCR)`, async function() {
    });
    it.skip(`should remove coll=0 pledges from the smallest debt`, async function() {
    });
    it.todo(`should run useSweepReserve() of Pool.sol`);
  });

  describe('getStates()', () => {
    let accounts, MCR, RRR, SRR, GRR;

    beforeEach(async () => {
      accounts = await getSharedSigners();
      MCR = await yamato.MCR();
      RRR = await yamato.RRR();
      SRR = await yamato.SRR();
      GRR = await yamato.GRR();
    })

    it('should return correct values', async () => {
      const beforeValues = await yamato.getStates();

      betterexpect(beforeValues[0]).toEqBN(0);
      betterexpect(beforeValues[1]).toEqBN(0);

      await yamato.connect(accounts[0]).deposit({value:10});
      await yamato.connect(accounts[0]).borrow(1);
      const afterValues = await yamato.getStates();

      betterexpect(afterValues[0]).toEqBN(10);
      betterexpect(afterValues[1]).toEqBN(1);
      betterexpect(afterValues[2]).toBe(MCR);
      betterexpect(afterValues[3]).toBe(RRR);
      betterexpect(afterValues[4]).toBe(SRR);
      betterexpect(afterValues[5]).toBe(GRR);
    })
  })

  describe('getIndivisualStates()', () => {
    let accounts;

    beforeEach(async () => {
      accounts = await getSharedSigners();
    })

    it('should return correct values', async () => {
      const owner = await accounts[0].getAddress();

      const beforeValues = await yamato.getIndivisualStates(owner);
      
      betterexpect(beforeValues[0]).toEqBN(0);
      betterexpect(beforeValues[1]).toEqBN(0);

      await yamato.connect(accounts[0]).deposit({value:10});
      await yamato.connect(accounts[0]).borrow(1);
      const afterValues = await yamato.getIndivisualStates(owner);

      betterexpect(afterValues[0]).toEqBN(10);
      betterexpect(afterValues[1]).toEqBN(1);
      betterexpect(afterValues[2]).toBe(true);
    })
  })
});