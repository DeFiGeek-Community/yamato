import { ethers } from "hardhat";
import { smock } from "@defi-wonderland/smock";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { Signer, BigNumber, Wallet } from "ethers";
import { toERC20 } from "../param/helper";
import {
  ChainLinkMock,
  TellorCallerMock,
  PriceFeed,
  FeePool,
  CjpyOS,
  CJPY,
  Yamato,
  PriorityRegistry,
  Pool,
  ChainLinkMock__factory,
  TellorCallerMock__factory,
  PriceFeed__factory,
  CjpyOS__factory,
  CJPY__factory,
  Yamato__factory,
  Pool__factory,
  FeePool__factory,
  PriorityRegistry__factory,
} from "../../typechain";
import { getProxy } from "../../src/testUtil";

chai.use(smock.matchers);
chai.use(solidity);

describe("PriceChangeAndRedemption :: contract Yamato", () => {
  let ChainLinkEthUsd: ChainLinkMock;
  let ChainLinkUsdJpy: ChainLinkMock;
  let Tellor: TellorCallerMock;
  let PriceFeed: PriceFeed;
  let CJPY: CJPY;
  let FeePool: FeePool;
  let CjpyOS: CjpyOS;
  let Yamato: Yamato;
  let Pool: Pool;
  let PriorityRegistry: PriorityRegistry;
  let accounts: Signer[];
  let ownerAddress: string;
  let userAddress: string;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    ownerAddress = await accounts[0].getAddress();
    userAddress = await accounts[1].getAddress();

    ChainLinkEthUsd = await (<ChainLinkMock__factory>(
      await ethers.getContractFactory("ChainLinkMock")
    )).deploy("ETH/USD");
    ChainLinkUsdJpy = await (<ChainLinkMock__factory>(
      await ethers.getContractFactory("ChainLinkMock")
    )).deploy("JPY/USD");

    await (
      await ChainLinkEthUsd.connect(accounts[0]).simulatePriceMove({
        gasLimit: 200000,
      })
    ).wait();
    await (
      await ChainLinkUsdJpy.connect(accounts[0]).simulatePriceMove({
        gasLimit: 200000,
      })
    ).wait();
    await (
      await ChainLinkEthUsd.connect(accounts[0]).simulatePriceMove({
        gasLimit: 200000,
      })
    ).wait();
    await (
      await ChainLinkUsdJpy.connect(accounts[0]).simulatePriceMove({
        gasLimit: 200000,
      })
    ).wait();

    Tellor = await (<TellorCallerMock__factory>(
      await ethers.getContractFactory("TellorCallerMock")
    )).deploy();

    PriceFeed = await getProxy<PriceFeed, PriceFeed__factory>("PriceFeed", [
      ChainLinkEthUsd.address,
      ChainLinkUsdJpy.address,
      Tellor.address,
    ]);
    await (await PriceFeed.fetchPrice()).wait();

    CJPY = await (<CJPY__factory>(
      await ethers.getContractFactory("CJPY")
    )).deploy();

    FeePool = await (<FeePool__factory>(
      await ethers.getContractFactory("FeePool")
    )).deploy();

    CjpyOS = await (<CjpyOS__factory>(
      await ethers.getContractFactory("CjpyOS")
    )).deploy(
      CJPY.address,
      PriceFeed.address,
      FeePool.address
      // governance=deployer
    );

    const PledgeLib = (
      await (await ethers.getContractFactory("PledgeLib")).deploy()
    ).address;

    Yamato = await (<Yamato__factory>await ethers.getContractFactory("Yamato", {
      libraries: { PledgeLib },
    })).deploy(CjpyOS.address);

    Pool = await (<Pool__factory>(
      await ethers.getContractFactory("Pool")
    )).deploy(Yamato.address);

    PriorityRegistry = await (<PriorityRegistry__factory>(
      await ethers.getContractFactory("PriorityRegistry", {
        libraries: { PledgeLib },
      })
    )).deploy(Yamato.address);

    await (await Yamato.setPool(Pool.address)).wait();
    await (await Yamato.setPriorityRegistry(PriorityRegistry.address)).wait();
    await (await CjpyOS.addYamato(Yamato.address)).wait();
    await (await CJPY.setCurrencyOS(CjpyOS.address)).wait();
  });

  describe("redeem()", function () {
    let PRICE;
    const MCR = BigNumber.from(110);
    let toCollateralize;
    let toBorrow;
    let redeemer;
    let redeemee;
    let anotherRedeemee;

    describe("Context - with dump", function () {
      beforeEach(async () => {
        redeemer = accounts[0];
        redeemee = accounts[1];
        toCollateralize = 1;
        toBorrow = (await PriceFeed.lastGoodPrice())
          .mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "");

        /* Get redemption budget by her own */
        await Yamato.connect(redeemer).deposit({
          value: toERC20(toCollateralize * 7.1 + ""),
        });
        await Yamato.connect(redeemer).borrow(toERC20(toBorrow.mul(7) + ""));

        /* Set the only and to-be-lowest ICR */
        await Yamato.connect(redeemee).deposit({
          value: toERC20(toCollateralize + ""),
        });
        await Yamato.connect(redeemee).borrow(toERC20(toBorrow + ""));

        /* Market Dump */
        await (await ChainLinkEthUsd.setLastPrice("204000000000")).wait(); //dec8
        await (await Tellor.setLastPrice("203000000000")).wait(); //dec8
      });

      it(`should full-redeem a lowest pledge w/o infinite traversing nor no pledges redeemed but w/ reasonable gas.`, async function () {
        let redeemerAddr = await redeemer.getAddress();
        let redeemeeAddr = await redeemee.getAddress();

        const totalSupplyBefore = await CJPY.totalSupply();
        const redeemerCJPYBalanceBefore = await CJPY.balanceOf(redeemerAddr);
        const redeemerETHBalanceBefore = await Yamato.provider.getBalance(
          redeemerAddr
        );

        toBorrow = (await PriceFeed.lastGoodPrice())
          .mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "");

        // pledge loop and traversing redemption must be cheap
        expect(
          await Yamato.estimateGas.redeem(toERC20(toBorrow.mul(1) + ""), false)
        ).to.be.lt(1500000);

        const txReceipt = await (
          await Yamato.connect(redeemer).redeem(
            toERC20(toBorrow.mul(1) + ""),
            false
          )
        ).wait();

        const redeemedPledgeAfter = await Yamato.getPledge(redeemeeAddr);

        const totalSupplyAfter = await CJPY.totalSupply();
        const redeemerCJPYBalanceAfter = await CJPY.balanceOf(redeemerAddr);
        const redeemerETHBalanceAfter = await Yamato.provider.getBalance(
          redeemerAddr
        );
        const nextRedeemable = await PriorityRegistry.nextRedeemable();
        expect(nextRedeemable.isCreated).to.be.true;

        expect(totalSupplyAfter).to.be.lt(totalSupplyBefore);
        expect(redeemerCJPYBalanceAfter).to.be.lt(redeemerCJPYBalanceBefore);
        expect(
          redeemerETHBalanceAfter.add(
            txReceipt.gasUsed.mul(txReceipt.effectiveGasPrice)
          )
        ).to.be.gt(redeemerETHBalanceBefore);
        expect(redeemedPledgeAfter.coll).to.be.eq(0);
        expect(redeemedPledgeAfter.priority).to.be.eq(0);
      });
    });

    describe("Context - without dump", function () {
      beforeEach(async () => {
        redeemer = accounts[0];
        redeemee = accounts[1];
        PRICE = await PriceFeed.lastGoodPrice();
        toCollateralize = 1;
        toBorrow = PRICE.mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "");

        /* Get redemption budget by her own */
        await Yamato.connect(redeemer).deposit({
          value: toERC20(toCollateralize * 7.1 + ""),
        });
        await Yamato.connect(redeemer).borrow(toERC20(toBorrow.mul(7) + ""));

        /* Set the only and to-be-lowest ICR */
        await Yamato.connect(redeemee).deposit({
          value: toERC20(toCollateralize + ""),
        });
        await Yamato.connect(redeemee).borrow(toERC20(toBorrow + ""));

        /* No Market Dump */
      });

      it(`should not redeem any pledeges because no pledges are lower than MCR`, async function () {
        await expect(
          Yamato.connect(redeemer).redeem(toERC20(toBorrow.mul(2) + ""), false)
        ).to.revertedWith("No pledges are redeemed.");
      });
    });

    describe("Context - with dump-pump-dump", function () {
      beforeEach(async () => {
        redeemer = accounts[0];
        redeemee = accounts[1];
        anotherRedeemee = accounts[2];
        toCollateralize = 1;
        toBorrow = (await PriceFeed.lastGoodPrice())
          .mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "");

        /* Get redemption budget by her own */
        await Yamato.connect(redeemer).deposit({
          value: toERC20(toCollateralize * 7.1 + ""),
        });
        await Yamato.connect(redeemer).borrow(toERC20(toBorrow.mul(7) + ""));

        /* Set the only and to-be-lowest ICR */
        await Yamato.connect(redeemee).deposit({
          value: toERC20(toCollateralize + ""),
        });
        await Yamato.connect(redeemee).borrow(toERC20(toBorrow + ""));

        /* Market Dump */
        await (await ChainLinkEthUsd.setLastPrice("300000000000")).wait(); //dec8
        await (await Tellor.setLastPrice("300000000000")).wait(); //dec8

        /* redeemee's pledge is sweepable */
        await Yamato.connect(redeemer).redeem(
          toERC20(toBorrow.div(2) + ""),
          false
        );

        /* Market Pump */
        await (await ChainLinkEthUsd.setLastPrice("600000000000")).wait(); //dec8
        await (await Tellor.setLastPrice("600000000000")).wait(); //dec8

        /* Set anotherRedeemee's pledge to be redeemable */
        await Yamato.connect(anotherRedeemee).deposit({
          value: toERC20(toCollateralize + ""),
        });
        await Yamato.connect(anotherRedeemee).borrow(toERC20(toBorrow + ""));

        /* Market Dump */
        await (await ChainLinkEthUsd.setLastPrice("200000000000")).wait(); //dec8
        await (await Tellor.setLastPrice("200000000000")).wait(); //dec8
      });

      it(`should redeem w/o making LICR broken and w/ reasonable gas`, async function () {
        toBorrow = (await PriceFeed.lastGoodPrice())
          .mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "");

        const licr = await PriorityRegistry.LICR();
        const redeemerAddr = await redeemer.getAddress();
        const targetRedeemee = await PriorityRegistry.getLevelIndice(licr, 0);

        const totalSupplyBefore = await CJPY.totalSupply();
        const redeemerCJPYBalanceBefore = await CJPY.balanceOf(redeemerAddr);
        const redeemerETHBalanceBefore = await Yamato.provider.getBalance(
          redeemerAddr
        );
        const poolETHBalanceBefore = await Yamato.provider.getBalance(
          Pool.address
        );
        const poolCollateralBefore = await Pool.lockedCollateral();
        const redeemedPledgeBefore = await Yamato.getPledge(targetRedeemee);

        const txReceipt = await (
          await Yamato.connect(redeemer).redeem(
            toERC20(toBorrow.mul(2) + ""),
            false
          )
        ).wait();

        const redeemedPledgeAfter = await Yamato.getPledge(targetRedeemee);

        const totalSupplyAfter = await CJPY.totalSupply();
        const redeemerCJPYBalanceAfter = await CJPY.balanceOf(redeemerAddr);
        const redeemerETHBalanceAfter = await Yamato.provider.getBalance(
          redeemerAddr
        );
        const poolETHBalanceAfter = await Yamato.provider.getBalance(
          Pool.address
        );
        const poolCollateralAfter = await Pool.lockedCollateral();

        expect(totalSupplyAfter).to.be.lt(totalSupplyBefore);
        expect(redeemerCJPYBalanceAfter).to.be.lt(redeemerCJPYBalanceBefore);
        expect(
          redeemerETHBalanceAfter.add(
            txReceipt.gasUsed.mul(txReceipt.effectiveGasPrice)
          )
        ).to.be.gt(redeemerETHBalanceBefore);
        expect(redeemedPledgeAfter.coll).to.be.eq(0);
        expect(redeemedPledgeAfter.priority).to.be.eq(0);
      });
    });

    describe("Context - core redemption", function () {
      beforeEach(async () => {
        redeemer = accounts[0];
        redeemee = accounts[1];
        anotherRedeemee = accounts[2];
        toCollateralize = 1;
        toBorrow = (await PriceFeed.lastGoodPrice())
          .mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "");

        /* Get redemption budget by her own */
        await Yamato.connect(redeemer).deposit({
          value: toERC20(toCollateralize * 20.2 + ""),
        });
        await Yamato.connect(redeemer).borrow(toERC20(toBorrow.mul(20) + ""));

        /* Set the only and to-be-lowest ICR */
        await Yamato.connect(redeemee).deposit({
          value: toERC20(toCollateralize * 20 + ""),
        });
        await Yamato.connect(redeemee).borrow(toERC20(toBorrow.mul(20) + ""));

        await Yamato.connect(anotherRedeemee).deposit({
          value: toERC20(toCollateralize * 20.1 + ""),
        });
        await Yamato.connect(anotherRedeemee).borrow(
          toERC20(toBorrow.mul(20) + "")
        );

        /* Market Dump */
        await (await ChainLinkEthUsd.setLastPrice("204000000000")).wait(); //dec8
        await (await Tellor.setLastPrice("203000000000")).wait(); //dec8

        toBorrow = (await PriceFeed.lastGoodPrice())
          .mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "");

        await (
          await Yamato.connect(redeemer).redeem(
            toERC20(toBorrow.mul(5) + ""),
            false
          )
        ).wait();
        await (
          await Yamato.connect(redeemer).redeem(
            toERC20(toBorrow.mul(5) + ""),
            false
          )
        ).wait();
      });

      it(`should run core redemption`, async function () {
        const redeemerAddr = await redeemer.getAddress();

        const redeemablePledge = await PriorityRegistry.nextRedeemable();
        const cjpyBalanceBefore = await CJPY.balanceOf(redeemerAddr);

        const txReceipt = await (
          await Yamato.connect(redeemer).redeem(
            toERC20(toBorrow.mul(1) + ""),
            true
          )
        ).wait();
        const redeemedPledge = await Yamato.getPledge(redeemablePledge.owner);
        const cjpyBalanceAfter = await CJPY.balanceOf(redeemerAddr);

        expect(cjpyBalanceAfter).to.equal(cjpyBalanceBefore);
        expect(redeemedPledge.coll).to.be.lt(redeemablePledge.coll);
      });
    });

    describe("Context - A very large redemption", function () {
      const COUNT = 100;
      let _ACCOUNTS;
      beforeEach(async () => {
        _ACCOUNTS = accounts;
        redeemer = _ACCOUNTS[0];

        const transferPromise = [];
        for (var i = 20; i < COUNT; i++) {
          let wallet = Wallet.createRandom();
          wallet = wallet.connect(Yamato.provider);
          transferPromise.push(
            redeemer.sendTransaction({
              to: wallet.address,
              value: BigNumber.from(1.1e18 + ""),
            })
          );
          _ACCOUNTS.push(wallet);
        }
        await Promise.all(transferPromise);

        toCollateralize = 1;
        toBorrow = (await PriceFeed.lastGoodPrice())
          .mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "");

        /* A huge whale */
        await Yamato.connect(redeemer).deposit({
          value: toERC20(toCollateralize * 2100 + ""),
        });
        await Yamato.connect(redeemer).borrow(toERC20(toBorrow.mul(2000) + ""));

        /* Tiny retail investors */
        for (var i = 1; i < _ACCOUNTS.length; i++) {
          await Yamato.connect(_ACCOUNTS[i]).deposit({
            value: toERC20(toCollateralize * 1 + ""),
          });
          await Yamato.connect(_ACCOUNTS[i]).borrow(
            toERC20(toBorrow.mul(1) + "")
          );
        }

        /* Market Dump */
        await (
          await ChainLinkEthUsd.connect(redeemer).setLastPrice("204000000000")
        ).wait(); //dec8
        await (
          await Tellor.connect(redeemer).setLastPrice("203000000000")
        ).wait(); //dec8

        toBorrow = (await PriceFeed.lastGoodPrice())
          .mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "");
      });

      it(`should be runnable in a block`, async function () {
        const redeemerAddr = await redeemer.getAddress();
        const gasEstimation = await Yamato.estimateGas.redeem(
          toERC20(toBorrow.mul(1000) + ""),
          false,
          { gasLimit: 30000000 }
        );
        const redeemerETHBalanceBefore = await Yamato.provider.getBalance(
          redeemerAddr
        );
        const redeemeePledgeBefore = await Yamato.getPledge(await _ACCOUNTS[1].getAddress());
        const statesBefore = await Yamato.getStates();

        await (
          await Yamato.connect(redeemer).redeem(
            toERC20(toBorrow.mul(1000) + ""),
            false,
            { gasLimit: 30000000 }
          )
        ).wait();

        const redeemerETHBalanceAfter = await Yamato.provider.getBalance(
          redeemerAddr
        );
        const redeemeePledgeAfter = await Yamato.getPledge(await _ACCOUNTS[1].getAddress());
        const statesAfter = await Yamato.getStates();


        expect(gasEstimation).to.be.lt(30000000);
        expect(redeemerETHBalanceAfter).to.be.gt(redeemerETHBalanceBefore);
        expect(statesAfter[0]).to.be.lt(statesBefore[0]);//totalColl
        expect(statesAfter[1]).to.be.lt(statesBefore[1]);//totalDebt
        expect(redeemeePledgeAfter.coll).to.be.lt(redeemeePledgeBefore.coll);
        expect(redeemeePledgeAfter.debt).to.be.lt(redeemeePledgeBefore.debt);
      });
    });
  });
  describe("sweep()", function () {
    let PRICE;
    const MCR = BigNumber.from(110);
    let toCollateralize;
    let toBorrow;
    let redeemer;
    let redeemee;
    let anotherRedeemee;
    let yetAnotherRedeemee;
    beforeEach(async () => {
      redeemer = accounts[0];
      redeemee = accounts[1];
      anotherRedeemee = accounts[2];
      yetAnotherRedeemee = accounts[3];
      toCollateralize = 1;
      toBorrow = (await PriceFeed.lastGoodPrice())
        .mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");

      /* Get redemption budget by her own */
      await Yamato.connect(redeemer).deposit({
        value: toERC20(toCollateralize * 40.5 + ""),
      });
      await Yamato.connect(redeemer).borrow(toERC20(toBorrow.mul(40) + ""));

      /* Set the only and to-be-lowest ICR */
      await Yamato.connect(redeemee).deposit({
        value: toERC20(toCollateralize * 20 + ""),
      });
      await Yamato.connect(redeemee).borrow(toERC20(toBorrow.mul(20) + ""));

      await Yamato.connect(anotherRedeemee).deposit({
        value: toERC20(toCollateralize * 20.1 + ""),
      });
      await Yamato.connect(anotherRedeemee).borrow(
        toERC20(toBorrow.mul(20) + "")
      );
      await Yamato.connect(yetAnotherRedeemee).deposit({
        value: toERC20(toCollateralize * 20.1 + ""),
      });
      await Yamato.connect(yetAnotherRedeemee).borrow(
        toERC20(toBorrow.mul(20) + "")
      );

      /* Market Dump */
      await (await ChainLinkEthUsd.setLastPrice("204000000000")).wait(); //dec8
      await (await Tellor.setLastPrice("203000000000")).wait(); //dec8

      toBorrow = (await PriceFeed.lastGoodPrice())
        .mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");
    });

    describe("Context - partial sweep", function () {
      beforeEach(async () => {
        await (
          await Yamato.connect(redeemer).redeem(
            toERC20(toBorrow.mul(1) + ""),
            false
          )
        ).wait();
        await (
          await Yamato.connect(redeemer).redeem(
            toERC20(toBorrow.mul(15) + ""),
            false
          )
        ).wait();
      });

      it(`should run partial sweep`, async function () {
        const redeemerAddr = await redeemer.getAddress();

        const sweepablePledge = await PriorityRegistry.nextSweepable();
        const redeemerCjpyBalanceBefore = await CJPY.balanceOf(redeemerAddr);
        const poolCjpyBalanceBefore = await CJPY.balanceOf(Pool.address);

        await (await Yamato.connect(redeemer).sweep()).wait();
        const sweptPledge = await Yamato.getPledge(sweepablePledge.owner);
        const redeemerCjpyBalanceAfter = await CJPY.balanceOf(redeemerAddr);
        const poolCjpyBalanceAfter = await CJPY.balanceOf(Pool.address);

        expect(redeemerCjpyBalanceAfter).to.equal(redeemerCjpyBalanceBefore);
        expect(poolCjpyBalanceAfter).to.be.lt(poolCjpyBalanceBefore);
        expect(sweptPledge.debt).to.be.lt(sweepablePledge.debt);
        expect(sweptPledge.isCreated).to.be.true;
      });
    });

    describe("Context - full sweep", function () {
      beforeEach(async () => {
        await (
          await Yamato.connect(redeemer).redeem(
            toERC20(toBorrow.mul(9) + ""),
            false
          )
        ).wait();

        await (
          await Yamato.connect(redeemer).redeem(
            toERC20(toBorrow.mul(9) + ""),
            false
          )
        ).wait();
      });
      it(`should run full sweep`, async function () {
        const redeemerAddr = await redeemer.getAddress();

        const sweepablePledge = await PriorityRegistry.nextSweepable();
        const poolCjpyBalanceBefore = await CJPY.balanceOf(Pool.address);

        await (
          await CJPY.connect(redeemer).transfer(
            sweepablePledge.owner,
            await CJPY.balanceOf(redeemerAddr)
          )
        ).wait();
        await (
          await CJPY.connect(anotherRedeemee).transfer(
            sweepablePledge.owner,
            await CJPY.balanceOf(await anotherRedeemee.getAddress())
          )
        ).wait();
        await (
          await CJPY.connect(yetAnotherRedeemee).transfer(
            sweepablePledge.owner,
            await CJPY.balanceOf(await yetAnotherRedeemee.getAddress())
          )
        ).wait();

        let matched = await Promise.all(
          accounts.map(async (acc) =>
            (await acc.getAddress()) == sweepablePledge.owner ? acc : null
          )
        );
        matched = matched.filter((el) => !!el);
        await (
          await Yamato.connect(matched[0]).repay(
            sweepablePledge.debt
              .mul(100000000000 - 1 + "")
              .div(100000000000 + "")
          )
        ).wait();

        await (await Yamato.connect(redeemer).sweep()).wait();
        const sweptPledge = await Yamato.getPledge(sweepablePledge.owner);
        const poolCjpyBalanceAfter = await CJPY.balanceOf(Pool.address);

        expect(poolCjpyBalanceAfter).to.be.lt(poolCjpyBalanceBefore);
        expect(sweptPledge.debt).to.equal(0);
        expect(sweptPledge.isCreated).to.be.false;
      });
    });
  });
});

async function logPledges(Yamato, PriceFeed, accounts) {
  await (await PriceFeed.fetchPrice()).wait();
  console.log(
    await Promise.all(
      (
        await Promise.all(
          (
            await Promise.all(
              accounts.map(async (el) => {
                return await el.getAddress();
              })
            )
          )
            .filter(
              (addr) => addr != "0x0000000000000000000000000000000000000000"
            )
            .map(async (addr) => {
              return await Yamato.getPledge(addr);
            })
        )
      ).map(async (p) => {
        return `owner:${p.owner} priority:${p.priority} coll:${p.coll} debt:${
          p.debt
        } icr:${await getICR(p, PriceFeed)}`;
      })
    )
  );
}

async function getICR(p, PriceFeed) {
  await (await PriceFeed.fetchPrice()).wait();
  let price = await PriceFeed.lastGoodPrice();
  return p.debt.isZero()
    ? "inf"
    : p.coll
        .mul(price)
        .mul(100)
        .div(p.debt)
        .div(1e18 + "");
}
