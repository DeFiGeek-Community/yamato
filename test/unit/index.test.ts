import { ethers } from 'hardhat'
import { smockit, smoddit, isMockContract } from '@eth-optimism/smock';
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
describe("Smock", function() {
  it(`succeeds to make a mock`, async function() {
    const spec = await ethers.getContractFactory('Yamato')
    const mock = await smockit(spec)
    betterexpect(isMockContract(mock)).toBe(true);
  });
});

describe("Yamato", function() {
  let mockPool;
  let mockFeed;
  let mockYMT;
  let mockCJPY;
  let yamato;

  beforeEach(async () => {
    const spec1 = await ethers.getContractFactory('Pool')
    const spec2 = await ethers.getContractFactory('PriceFeed')
    const spec3 = await ethers.getContractFactory('YMT')
    const spec4 = await ethers.getContractFactory('CJPY')
    mockPool = await smockit(spec1)
    mockFeed = await smockit(spec2)
    mockYMT = await smockit(spec3)
    mockCJPY = await smockit(spec4)
    yamato = await (await ethers.getContractFactory('Yamato')).deploy(
      mockPool.address,
      mockFeed.address,
      mockYMT.address,
      mockCJPY.address
    );
  });

  describe("issue()", function() {

    it(`succeeds to make a pledge with ICR=110%, and the TCR will be 110%`, async function() {
      const PRICE = 260000;
      const MCR = 1.1;
      mockPool.smocked['depositRedemptionReserve(uint256)'].will.return.with(0);
      mockPool.smocked['depositSweepReserve(uint256)'].will.return.with(0);
      mockPool.smocked['lockETH(uint256)'].will.return.with(0);
      mockFeed.smocked.fetchPrice.will.return.with(PRICE);
      

      const toCollateralize = 1;
      const toBorrow = (PRICE * toCollateralize) / MCR;
      await yamato.issue(toERC20(toBorrow+""), {value:toERC20(toCollateralize+"")});
      const TCR = await yamato.getTCR(PRICE);

      betterexpect(TCR.toString()).toBe("110");


      const pledge = await yamato.pledges(await yamato.signer.getAddress());

      betterexpect(pledge.coll.toString()).toBe("1000000000000000000");
      betterexpect(pledge.debt.toString()).toBe("236363636363636350000000");

    });
    it(`should have zero ETH balance after issuance`, async function() {
      const PRICE = 260000;
      const MCR = 1.1;
      mockPool.smocked['depositRedemptionReserve(uint256)'].will.return.with(0);
      mockPool.smocked['depositSweepReserve(uint256)'].will.return.with(0);
      mockPool.smocked['lockETH(uint256)'].will.return.with(0);
      mockFeed.smocked.fetchPrice.will.return.with(PRICE);
      
      const toCollateralize = 1;
      const toBorrow = (PRICE * toCollateralize) / MCR;
      await yamato.issue(toERC20(toBorrow+""), {value:toERC20(toCollateralize+"")});

      const balance = await yamato.provider.getBalance(yamato.address);


      betterexpect(balance.toString()).toBe("0");

    });

    it.todo(`should run depositRedemptionReserve() of Pool.sol`);
    it.todo(`should run depositSweepReserve() of Pool.sol`);
    it.todo(`should run lockETH() of Pool.sol`);

  });
  describe("repay()", function() {
    it(`should reduce debt`, async function() {
      const PRICE = 260000;
      const MCR = 1.1;
      mockCJPY.smocked['burnFrom(address,uint256)'].will.return.with(0);
      mockFeed.smocked.fetchPrice.will.return.with(PRICE);
      

      const toCollateralize = 1;
      const toBorrow = (PRICE * toCollateralize) / MCR;
      await yamato.issue(toERC20(toBorrow+""), {value:toERC20(toCollateralize+"")});
      const pledgeBefore = await yamato.pledges(await yamato.signer.getAddress());

      betterexpect(pledgeBefore.coll.toString()).toBe("1000000000000000000");
      betterexpect(pledgeBefore.debt.toString()).toBe("236363636363636350000000");


      await yamato.repay(toERC20(toBorrow+""));

      const pledgeAfter = await yamato.pledges(await yamato.signer.getAddress());

      betterexpect(pledgeAfter.coll.toString()).toBe("1000000000000000000");
      betterexpect(pledgeAfter.debt.toString()).toBe("0");
    });
    it(`should improve TCR`, async function() {
      const PRICE = 260000;
      const MCR = 1.1;
      mockCJPY.smocked['burnFrom(address,uint256)'].will.return.with(0);
      mockFeed.smocked.fetchPrice.will.return.with(PRICE);
      

      const toCollateralize = 1;
      const toBorrow = (PRICE * toCollateralize) / MCR;
      await yamato.issue(toERC20(toBorrow+""), {value:toERC20(toCollateralize+"")});
      const TCRbefore = await yamato.getTCR(PRICE);
 
      await yamato.repay(toERC20(toBorrow+""));
      const TCRafter = await yamato.getTCR(PRICE);

      betterexpect(TCRafter).toBeGtBN(TCRbefore);
      betterexpect(TCRafter.toString()).toBe("115792089237316195423570985008687907853269984665640564039457584007913129639935");
    });
    it(`can't be executed in the TCR < MCR`, async function() {
      const PRICE = 260000;
      const MCR = 1.1;
      mockCJPY.smocked['burnFrom(address,uint256)'].will.return.with(0);
      mockFeed.smocked.fetchPrice.will.return.with(PRICE);
      
      const toCollateralize = 1;
      const toBorrow = (PRICE * toCollateralize) / MCR;
      await yamato.issue(toERC20(toBorrow+""), {value:toERC20(toCollateralize+"")});
 
      mockFeed.smocked.fetchPrice.will.return.with(PRICE/2);
      const dumpedTCR = await yamato.getTCR(PRICE/2);
      betterexpect(parseInt(dumpedTCR.toString()) < MCR*100).toBe(true);

      await betterexpect( yamato.repay(toERC20(toBorrow+"")) ).toBeReverted();

    });

    // TODO: Have a attack contract to recursively calls the issue function
    it.todo(`should validate locked state`)
  });

  describe("withdraw()", function() {
    it(`should validate locked state`, async function() {
      const PRICE = 260000;
      const MCR = 1.1;
      mockFeed.smocked.fetchPrice.will.return.with(PRICE);
      mockPool.smocked['sendETH(address,uint256)'].will.return.with(0);     

      const toCollateralize = 1;
      const toBorrow = 0;
      await yamato.issue(toERC20(toBorrow+""), {value:toERC20(toCollateralize+"")});
      await betterexpect( yamato.withdraw(toERC20(toCollateralize/10+"")) ).toBeReverted();
    });
    it(`should reduce coll`, async function() {
      const PRICE = 260000;
      const MCR = 1.1;
      mockFeed.smocked.fetchPrice.will.return.with(PRICE);
      mockPool.smocked['sendETH(address,uint256)'].will.return.with(0);     

      const toCollateralize = 1;
      const toBorrow = 0;
      await yamato.issue(toERC20(toBorrow+""), {value:toERC20(toCollateralize+"")});
      const pledgeBefore = await yamato.pledges(await yamato.signer.getAddress());

      betterexpect(pledgeBefore.coll.toString()).toBe("1000000000000000000");
      betterexpect(pledgeBefore.debt.toString()).toBe("0");

      yamato.provider.send("evm_increaseTime", [60*60*24*3+1])
      yamato.provider.send("evm_mine")

      await yamato.withdraw(toERC20(toCollateralize/10+""));

      const pledgeAfter = await yamato.pledges(await yamato.signer.getAddress());

      betterexpect(pledgeAfter.coll.toString()).toBe(toERC20(toCollateralize*9/10+"").toString());
      betterexpect(pledgeAfter.debt.toString()).toBe("0");
    });
    it.skip(`should decrease TCR`, async function() {
      const PRICE = 260000;
      const MCR = 1.1;
      mockFeed.smocked.fetchPrice.will.return.with(PRICE);
      mockPool.smocked['sendETH(address,uint256)'].will.return.with(0);     

      const toCollateralize = 1;
      const toBorrow = 0;
      await yamato.issue(toERC20(toBorrow+""), {value:toERC20(toCollateralize+"")});
      const pledgeBefore = await yamato.pledges(await yamato.signer.getAddress());

      betterexpect(pledgeBefore.coll.toString()).toBe("1000000000000000000");
      betterexpect(pledgeBefore.debt.toString()).toBe("0");

      yamato.provider.send("evm_increaseTime", [60*60*24*3+1])
      yamato.provider.send("evm_mine")


      const TCRbefore = await yamato.getTCR(PRICE);

      await yamato.withdraw(toERC20(toCollateralize/10+""));
      const TCRafter = await yamato.getTCR(PRICE);

      betterexpect(TCRafter).toBeLtBN(TCRbefore);

    });
    it(`can't be executed in the TCR < MCR`, async function() {
      const PRICE = 260000;
      const MCR = 1.1;
      mockFeed.smocked.fetchPrice.will.return.with(PRICE);
      mockPool.smocked['sendETH(address,uint256)'].will.return.with(0);     

      const toCollateralize = 1;
      const toBorrow = (PRICE * toCollateralize) / MCR;
      await yamato.issue(toERC20(toBorrow+""), {value:toERC20(toCollateralize+"")});
      const pledgeBefore = await yamato.pledges(await yamato.signer.getAddress());

      betterexpect(pledgeBefore.coll.toString()).toBe("1000000000000000000");
      betterexpect(pledgeBefore.debt.toString()).toBe("236363636363636350000000");

      yamato.provider.send("evm_increaseTime", [60*60*24*3+1])
      yamato.provider.send("evm_mine")

      mockFeed.smocked.fetchPrice.will.return.with(PRICE/2);

      await betterexpect( yamato.withdraw(toERC20(toCollateralize/10+"")) ).toBeReverted();

    });
    it(`can't make ICR < MCR by this withdrawal`, async function() {
      const PRICE = 260000;
      const MCR = 1.1;
      mockFeed.smocked.fetchPrice.will.return.with(PRICE);
      mockPool.smocked['sendETH(address,uint256)'].will.return.with(0);     

      const toCollateralize = 1;
      const toBorrow = (PRICE * toCollateralize) / MCR;
      await yamato.issue(toERC20(toBorrow+""), {value:toERC20(toCollateralize+"")});
      const pledgeBefore = await yamato.pledges(await yamato.signer.getAddress());

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
      await yamato.connect(accounts[0]).issue(toERC20(toBorrow+""), {value:toERC20(toCollateralize+"")});
      await yamato.connect(accounts[1]).issue(toERC20(toBorrow+""), {value:toERC20(toCollateralize+"")});
      await yamato.connect(accounts[2]).issue(toERC20(toBorrow+""), {value:toERC20(toCollateralize+"")});

      mockFeed.smocked.fetchPrice.will.return.with(PRICE_AFTER);

      await yamato.connect(accounts[3]).issue(toERC20(toBorrow+""), {value:toERC20(toCollateralize*2+"")});
      await yamato.connect(accounts[4]).issue(toERC20(toBorrow+""), {value:toERC20(toCollateralize*2+"")});
      await yamato.connect(accounts[5]).issue(toERC20(toBorrow+""), {value:toERC20(toCollateralize*2+"")});
    });

    it(`should reduce debt of lowest ICR pledges`, async function() {
      let p0 = await yamato.pledges(accounts[0].address);
      let icr0 = await yamato.getICR(p0.coll.mul(PRICE_AFTER), p0.debt);
      betterexpect(icr0.toString()).toBe("55");

      await yamato.connect(accounts[0]).redeem(toERC20(toBorrow+""), false);

      p0 = await yamato.pledges(accounts[0].address);
      icr0 = await yamato.getICR(p0.coll.mul(PRICE_AFTER), p0.debt);
      betterexpect(icr0.toString()).toBe("0");
    });
    it(`should improve TCR when TCR > 1`, async function() {
      const PRICE_A_BIT_DUMPED = PRICE*0.65;
      const TCRBefore = await yamato.getTCR(PRICE_A_BIT_DUMPED);

      mockFeed.smocked.fetchPrice.will.return.with(PRICE_A_BIT_DUMPED);
      await yamato.connect(accounts[0]).redeem(toERC20(toBorrow+""), false);

      const TCRAfter = await yamato.getTCR(PRICE_A_BIT_DUMPED);

      betterexpect(TCRAfter).toBeGtBN(TCRBefore);
    });
    it(`should shrink TCR when TCR < 1`, async function() {
      const TCRBefore = await yamato.getTCR(PRICE_AFTER);

      mockFeed.smocked.fetchPrice.will.return.with(PRICE_AFTER);
      await yamato.connect(accounts[0]).redeem(toERC20(toBorrow+""), false);

      const TCRAfter = await yamato.getTCR(PRICE_AFTER);

      betterexpect(TCRAfter).toBeLtBN(TCRBefore);
    });
    it(`should not run if TCR > 1.1`, async function() {
      mockFeed.smocked.fetchPrice.will.return.with(PRICE);
      await betterexpect(yamato.connect(accounts[0]).redeem(toERC20(toBorrow+""), false) ).toBeReverted();
    });
    it.skip(`can remain coll=0 debt>0 pledge in the storage`, async function() {
    });
    it.skip(`doesn't remain any sorted Trove state in the contract`, async function() {
    });
    it.todo(`[poolFlag:false] should NOT run useRedemptionReserve() of Pool.sol`);
    it.todo(`[poolFlag:true] should run useRedemptionReserve() of Pool.sol`);
    it.todo(`should run accumulateDividendReserve() of Pool.sol`);
    it.todo(`should run sendETH() of Pool.sol for successful redeemer`);
    it.todo(`should not run sendETH() of Pool.sol when there're no ICR<MCR && coll>0 pledges`);
    it.todo(`should reduce CJPY of successful redeemer`)
    it.todo(`should not reduce CJPY when there're no ICR<MCR && coll>0 pledges`)
    it.todo(`should return colls from them and it goes to RedemptionReserve`)
    // , async function() {
    //   const balanceBefore = await yamato.provider.getBalance(accounts[0].address);

    //   await yamato.connect(accounts[0]).redeem(toERC20(toBorrow+""), false);

    //   const balanceAfter = await yamato.provider.getBalance(accounts[0].address);
    //   betterexpect(balanceAfter).toBeGtBN(balanceBefore);
    // });

  });

  describe("sweep()", function() {
    it.skip(`should improve TCR`, async function() {
    });
    it.skip(`doesn't care how much TCR is. (compare to MCR)`, async function() {
    });
    it.skip(`should remove coll=0 pledges from the smallest debt`, async function() {
    });
    it.todo(`should run useSweepReserve() of Pool.sol`);
  });

});