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
  CurrencyOS,
  CJPY,
  Yamato,
  YamatoDepositor,
  YamatoBorrower,
  YamatoRepayer,
  YamatoWithdrawer,
  YamatoRedeemer,
  YamatoSweeper,
  PriorityRegistry,
  PriorityRegistryV4,
  Pool,
  ChainLinkMock__factory,
  TellorCallerMock__factory,
  PriceFeed__factory,
  CurrencyOS__factory,
  CJPY__factory,
  Yamato__factory,
  YamatoDepositor__factory,
  YamatoBorrower__factory,
  YamatoRepayer__factory,
  YamatoWithdrawer__factory,
  YamatoRedeemer__factory,
  YamatoSweeper__factory,
  Pool__factory,
  FeePool__factory,
  PriorityRegistry__factory,
  PriorityRegistryV4__factory,
} from "../../typechain";
import { getProxy, getLinkedProxy } from "../../src/testUtil";
import { isToken } from "typescript";

chai.use(smock.matchers);
chai.use(solidity);

describe("PriceChangeAndRedemption :: contract Yamato", () => {
  let ChainLinkEthUsd: ChainLinkMock;
  let ChainLinkUsdJpy: ChainLinkMock;
  let Tellor: TellorCallerMock;
  let PriceFeed: PriceFeed;
  let CJPY: CJPY;
  let FeePool: FeePool;
  let CurrencyOS: CurrencyOS;
  let Yamato: Yamato;
  let YamatoDepositor: YamatoDepositor;
  let YamatoBorrower: YamatoBorrower;
  let YamatoRepayer: YamatoRepayer;
  let YamatoWithdrawer: YamatoWithdrawer;
  let YamatoRedeemer: YamatoRedeemer;
  let YamatoSweeper: YamatoSweeper;
  let Pool: Pool;
  let PriorityRegistry: PriorityRegistryV4;
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

    FeePool = await getProxy<FeePool, FeePool__factory>("FeePool", []);

    CurrencyOS = await getProxy<CurrencyOS, CurrencyOS__factory>("CurrencyOS", [
      CJPY.address,
      PriceFeed.address,
      FeePool.address,
    ]);

    const PledgeLib = (
      await (await ethers.getContractFactory("PledgeLib")).deploy()
    ).address;

    Yamato = await getLinkedProxy<Yamato, Yamato__factory>(
      "Yamato",
      [CurrencyOS.address],
      ["PledgeLib"]
    );

    YamatoDepositor = await getLinkedProxy<
      YamatoDepositor,
      YamatoDepositor__factory
    >("YamatoDepositor", [Yamato.address], ["PledgeLib"]);

    YamatoBorrower = await getLinkedProxy<
      YamatoBorrower,
      YamatoBorrower__factory
    >("YamatoBorrower", [Yamato.address], ["PledgeLib"]);

    YamatoRepayer = await getLinkedProxy<YamatoRepayer, YamatoRepayer__factory>(
      "YamatoRepayer",
      [Yamato.address],
      ["PledgeLib"]
    );

    YamatoWithdrawer = await getLinkedProxy<
      YamatoWithdrawer,
      YamatoWithdrawer__factory
    >("YamatoWithdrawer", [Yamato.address], ["PledgeLib"]);

    YamatoRedeemer = await getLinkedProxy<
      YamatoRedeemer,
      YamatoRedeemer__factory
    >("YamatoRedeemer", [Yamato.address], ["PledgeLib"]);

    YamatoSweeper = await getLinkedProxy<YamatoSweeper, YamatoSweeper__factory>(
      "YamatoSweeper",
      [Yamato.address],
      ["PledgeLib"]
    );

    Pool = await getProxy<Pool, Pool__factory>("Pool", [Yamato.address]);

    PriorityRegistry = await getLinkedProxy<
      PriorityRegistryV4,
      PriorityRegistryV4__factory
    >("PriorityRegistry", [Yamato.address], ["PledgeLib"]);

    await (
      await Yamato.setDeps(
        YamatoDepositor.address,
        YamatoBorrower.address,
        YamatoRepayer.address,
        YamatoWithdrawer.address,
        YamatoRedeemer.address,
        YamatoSweeper.address,
        Pool.address,
        PriorityRegistry.address
      )
    ).wait();

    await (await CurrencyOS.addYamato(Yamato.address)).wait();
    await (await CJPY.setCurrencyOS(CurrencyOS.address)).wait();
  });

  describe("redeem()", function () {
    let PRICE;
    const MCR = BigNumber.from(130);
    let toCollateralize;
    let toBorrow;
    let redeemer;
    let redeemee;
    let redeemee2;
    let redeemee3;
    let redeemee4;
    let anotherRedeemee;

    describe("Context - with 50% dump", function () {
      let dumpedPriceBase = "204000000000";
      let dumpedPrice = BigNumber.from(dumpedPriceBase).mul(1e12 + "");
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
          value: toERC20(toCollateralize * 100 + ""),
        });
        await Yamato.connect(redeemer).borrow(toERC20(toBorrow.mul(7) + ""));

        /* Set the only and to-be-lowest ICR */
        await Yamato.connect(redeemee).deposit({
          value: toERC20(toCollateralize + ""),
        });
        await Yamato.connect(redeemee).borrow(toERC20(toBorrow + ""));

        /* Market Dump */
        await (await ChainLinkEthUsd.setLastPrice(dumpedPriceBase)).wait(); //dec8
        await (await Tellor.setLastPrice(dumpedPriceBase)).wait(); //dec8
      });

      it(`should full-redeem a all pledge w/o infinite traversing nor no pledges redeemed but w/ reasonable gas.`, async function () {
        let redeemerAddr = await redeemer.getAddress();
        let redeemeeAddr = await redeemee.getAddress();

        await (await PriceFeed.fetchPrice()).wait();
        const redeemableCapBefore = await PriorityRegistry.getRedeemablesCap();
        const statesBefore = await Yamato.getStates();

        const totalSupplyBefore = await CJPY.totalSupply();
        const redeemerCJPYBalanceBefore = await CJPY.balanceOf(redeemerAddr);
        const redeemerETHBalanceBefore = await Yamato.provider.getBalance(
          redeemerAddr
        );

        toBorrow = dumpedPrice
          .mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "");

        // pledge loop and traversing redemption must be cheap
        expect(
          await Yamato.estimateGas.redeem(toERC20(toBorrow.mul(3) + ""), false)
        ).to.be.lt(2000000);

        const txReceipt = await (
          await Yamato.connect(redeemer).redeem(
            toERC20(toBorrow.mul(3) + ""),
            false
          )
        ).wait();

        const statesAfter = await Yamato.getStates();
        expect(statesBefore[1].sub(statesAfter[1])).to.eq(redeemableCapBefore);

        const redeemedPledgeAfter = await Yamato.getPledge(redeemeeAddr);

        const totalSupplyAfter = await CJPY.totalSupply();
        const redeemerCJPYBalanceAfter = await CJPY.balanceOf(redeemerAddr);
        const redeemerETHBalanceAfter = await Yamato.provider.getBalance(
          redeemerAddr
        );

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
    describe("Context - with 1% dump", function () {
      let dumpedPriceBase = "397000000000";
      let dumpedPrice = BigNumber.from(dumpedPriceBase).mul(1e12 + "");
      beforeEach(async () => {
        redeemer = accounts[0];
        redeemee = accounts[1];
        redeemee2 = accounts[2];
        redeemee3 = accounts[3];
        redeemee4 = accounts[4];

        toCollateralize = 1;
        toBorrow = (await PriceFeed.lastGoodPrice())
          .mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "");

        /* Get redemption budget by her own */
        await Yamato.connect(redeemer).deposit({
          value: toERC20(toCollateralize * 1000 + ""),
        });
        await Yamato.connect(redeemer).borrow(toERC20(toBorrow.mul(10) + ""));

        /* Set the only and to-be-lowest ICR */
        await Yamato.connect(redeemee4).deposit({
          value: toERC20(toCollateralize + ""),
        });
        await Yamato.connect(redeemee4).borrow(toERC20(toBorrow + ""));

        await Yamato.connect(redeemee3).deposit({
          value: toERC20(toCollateralize + ""),
        });
        await Yamato.connect(redeemee3).borrow(toERC20(toBorrow + ""));

        await Yamato.connect(redeemee2).deposit({
          value: toERC20(toCollateralize + ""),
        });
        await Yamato.connect(redeemee2).borrow(toERC20(toBorrow + ""));

        await Yamato.connect(redeemee).deposit({
          value: toERC20(toCollateralize * 7 + ""),
        });
        await Yamato.connect(redeemee).borrow(toERC20(toBorrow.mul(7) + ""));

        /* Market Dump */
        await (await ChainLinkEthUsd.setLastPrice(dumpedPriceBase)).wait(); //dec8
        await (await Tellor.setLastPrice(dumpedPriceBase)).wait(); //dec8
      });

      it(`should full-redeem all pledges with small CJPY amount even if there's a huge pledge`, async function () {
        // Note: If 10000<ICR<MCR then redemption amount shall be limited to "pledge.debt * (MCR - ICR) / ICR"; otherwise, full redemption.
        let redeemerAddr = await redeemer.getAddress();
        let redeemeeAddr = await redeemee.getAddress();
        let redeemeeAddr4 = await redeemee4.getAddress();

        await (await PriceFeed.fetchPrice()).wait();
        const redeemableCapBefore = await PriorityRegistry.getRedeemablesCap();
        const statesBefore = await Yamato.getStates();

        const redeemedPledgeBefore = await Yamato.getPledge(redeemeeAddr);
        const redeemedPledge4Before = await Yamato.getPledge(redeemeeAddr4);
        const totalSupplyBefore = await CJPY.totalSupply();
        const redeemerCJPYBalanceBefore = await CJPY.balanceOf(redeemerAddr);
        const redeemerETHBalanceBefore = await Yamato.provider.getBalance(
          redeemerAddr
        );

        toBorrow = dumpedPrice
          .mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "");

        // pledge loop and traversing redemption must be cheap
        expect(
          await Yamato.estimateGas.redeem(toERC20(toBorrow.mul(9) + ""), false)
        ).to.be.lt(3000000);

        const txReceipt = await (
          await Yamato.connect(redeemer).redeem(
            toERC20(toBorrow.mul(9) + ""),
            false
          )
        ).wait();

        const statesAfter = await Yamato.getStates();
        expect(statesBefore[1].sub(statesAfter[1])).to.eq(redeemableCapBefore);

        const redeemedPledgeAfter = await Yamato.getPledge(redeemeeAddr);
        const redeemedPledge4After = await Yamato.getPledge(redeemeeAddr4);

        const totalSupplyAfter = await CJPY.totalSupply();
        const redeemerCJPYBalanceAfter = await CJPY.balanceOf(redeemerAddr);
        const redeemerETHBalanceAfter = await Yamato.provider.getBalance(
          redeemerAddr
        );

        expect(totalSupplyAfter).to.be.lt(totalSupplyBefore);
        expect(redeemerCJPYBalanceAfter).to.be.lt(redeemerCJPYBalanceBefore);
        expect(
          redeemerETHBalanceAfter.add(
            txReceipt.gasUsed.mul(txReceipt.effectiveGasPrice)
          )
        ).to.be.gt(redeemerETHBalanceBefore);

        expect(redeemedPledgeAfter.coll).to.be.lt(redeemedPledgeBefore.coll); // the first huge pledge must lose coll

        expect(redeemedPledgeAfter.debt).to.be.gt(0); // large pledge must not be full redeemed.
        expect(redeemedPledge4After.debt).to.be.gt(0); // small last pledge also must not be full redeemed.

        expect(
          redeemedPledgeAfter.coll
            .mul(dumpedPrice)
            .div(redeemedPledgeAfter.debt)
            .div(1e14 + "")
        ).to.be.gt(
          redeemedPledgeBefore.coll
            .mul(dumpedPrice)
            .div(redeemedPledgeBefore.debt)
            .div(1e14 + "")
        ); // 100<ICR<130 then ICR cured
        expect(
          redeemedPledgeAfter.coll
            .mul(dumpedPrice)
            .div(redeemedPledgeAfter.debt)
            .div(1e14 + "")
        ).to.eq(13000); // check real ICR cirtainly limited at MCR
        expect(redeemedPledgeAfter.priority).to.eq(13000); // 7 times large pledge must be full redeemed
        expect(
          redeemedPledge4After.coll
            .mul(dumpedPrice)
            .div(redeemedPledge4After.debt)
            .div(1e14 + "")
        ).to.be.gt(
          redeemedPledge4Before.coll
            .mul(dumpedPrice)
            .div(redeemedPledge4Before.debt)
            .div(1e14 + "")
        ); // 100<ICR<130 then ICR cured
        expect(redeemedPledge4After.priority).to.eq(13000); // WallBeforeLastPledge = 7 units * (130-129)/129 + 1 unit * (130-129)/129 * 4 pledges
      });
    });

    describe("Context - without no dump", function () {
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
      let dumpedPriceBase = "200000000000";
      let dumpedPrice = BigNumber.from(dumpedPriceBase).mul(1e12 + "");
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
        await (await ChainLinkEthUsd.setLastPrice(dumpedPriceBase)).wait(); //dec8
        await (await Tellor.setLastPrice(dumpedPriceBase)).wait(); //dec8
      });

      it(`should redeem w/o making LICR broken and w/ reasonable gas`, async function () {
        const redeemerAddr = await redeemer.getAddress();
        const redeemeeAddr = await redeemee.getAddress();

        toBorrow = dumpedPrice
          .mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "");

        const totalSupplyBefore = await CJPY.totalSupply();
        const redeemerCJPYBalanceBefore = await CJPY.balanceOf(redeemerAddr);
        const redeemerETHBalanceBefore = await Yamato.provider.getBalance(
          redeemerAddr
        );
        const feePoolBalanceBefore = await Yamato.provider.getBalance(
          FeePool.address
        );

        const txReceipt = await (
          await Yamato.connect(redeemer).redeem(
            toERC20(toBorrow.mul(2) + ""),
            false
          )
        ).wait();

        const redeemedPledgeAfter = await Yamato.getPledge(redeemeeAddr);

        const totalSupplyAfter = await CJPY.totalSupply();
        const redeemerCJPYBalanceAfter = await CJPY.balanceOf(redeemerAddr);
        const redeemerETHBalanceAfter = await Yamato.provider.getBalance(
          redeemerAddr
        );
        const feePoolBalanceAfter = await Yamato.provider.getBalance(
          FeePool.address
        );

        expect(totalSupplyAfter).to.be.lt(totalSupplyBefore);
        expect(redeemerCJPYBalanceAfter).to.be.lt(redeemerCJPYBalanceBefore);
        expect(
          redeemerETHBalanceAfter.add(
            txReceipt.gasUsed.mul(txReceipt.effectiveGasPrice)
          )
        ).to.be.gt(redeemerETHBalanceBefore);
        expect(redeemedPledgeAfter.coll).to.be.eq(0);
        expect(redeemedPledgeAfter.priority).to.be.eq(0);
        expect(feePoolBalanceAfter).to.be.eq(feePoolBalanceBefore);
      });
    });

    describe("Context - core redemption", function () {
      let dumpedPriceBase = "204000000000";
      let dumpedPrice = BigNumber.from(dumpedPriceBase).mul(1e12 + "");
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
        await (await ChainLinkEthUsd.setLastPrice(dumpedPriceBase)).wait(); //dec8
        await (await Tellor.setLastPrice(dumpedPriceBase)).wait(); //dec8

        toBorrow = dumpedPrice
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
        const redeemeeAddr = await redeemee.getAddress();

        const redeemablePledge = await Yamato.getPledge(redeemeeAddr);
        const cjpyBalanceBefore = await CJPY.balanceOf(redeemerAddr);
        const feePoolBalanceBefore = await Yamato.provider.getBalance(
          FeePool.address
        );

        const txReceipt = await (
          await Yamato.connect(redeemer).redeem(
            toERC20(toBorrow.mul(1) + ""),
            true
          )
        ).wait();
        const redeemedPledge = await Yamato.getPledge(redeemeeAddr);
        const cjpyBalanceAfter = await CJPY.balanceOf(redeemerAddr);
        const feePoolBalanceAfter = await Yamato.provider.getBalance(
          FeePool.address
        );

        expect(cjpyBalanceAfter).to.equal(cjpyBalanceBefore);
        expect(redeemedPledge.coll).to.be.lt(redeemablePledge.coll);
        expect(feePoolBalanceAfter).to.be.gt(feePoolBalanceBefore);
      });
    });

    describe("Context - A very large redemption", function () {
      const COUNT = 70;
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
        expect(await PriorityRegistry.pledgeLength()).to.eq(0);
        await Yamato.connect(redeemer).deposit({
          value: toERC20(toCollateralize * 2100 + ""),
        });
        expect(await PriorityRegistry.pledgeLength()).to.eq(1);
        await Yamato.connect(redeemer).borrow(toERC20(toBorrow.mul(2000) + ""));
        expect(await PriorityRegistry.pledgeLength()).to.eq(1);

        /* Tiny retail investors */
        for (var i = 1; i < _ACCOUNTS.length; i++) {
          expect(await PriorityRegistry.pledgeLength()).to.eq(i);
          await (
            await Yamato.connect(_ACCOUNTS[i]).deposit({
              value: toERC20(toCollateralize * 1 + ""),
            })
          ).wait();
          expect(await PriorityRegistry.pledgeLength()).to.eq(i + 1);
          await (
            await Yamato.connect(_ACCOUNTS[i]).borrow(
              toERC20(toBorrow.mul(1) + "")
            )
          ).wait();
          expect(await PriorityRegistry.pledgeLength()).to.eq(i + 1);
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
        const redeemeePledgeBefore = await Yamato.getPledge(
          await _ACCOUNTS[1].getAddress()
        );
        const statesBefore = await Yamato.getStates();

        expect(await PriorityRegistry.pledgeLength()).to.eq(_ACCOUNTS.length);
        await (
          await Yamato.connect(redeemer).redeem(
            toERC20(toBorrow.mul(1000) + ""),
            false,
            { gasLimit: 30000000 }
          )
        ).wait();
        expect(await PriorityRegistry.pledgeLength()).to.eq(_ACCOUNTS.length);

        const redeemerETHBalanceAfter = await Yamato.provider.getBalance(
          redeemerAddr
        );
        const redeemeePledgeAfter = await Yamato.getPledge(
          await _ACCOUNTS[1].getAddress()
        );
        const statesAfter = await Yamato.getStates();

        expect(gasEstimation).to.be.lt(30000000);
        expect(redeemerETHBalanceAfter).to.be.gt(redeemerETHBalanceBefore);
        expect(statesAfter[0]).to.be.lt(statesBefore[0]); //totalColl
        expect(statesAfter[1]).to.be.lt(statesBefore[1]); //totalDebt
        expect(redeemeePledgeAfter.coll).to.be.lt(redeemeePledgeBefore.coll);
        expect(redeemeePledgeAfter.debt).to.be.lt(redeemeePledgeBefore.debt);
      });
    });
    describe("Context - A large traversing and no gas exhaustion with 1% dump", function () {
      let dumpedPriceBase = "397000000000";
      let dumpedPrice = BigNumber.from(dumpedPriceBase).mul(1e12 + "");
      beforeEach(async () => {
        redeemer = accounts[0];
        toCollateralize = 1;
        toBorrow = (await PriceFeed.lastGoodPrice())
          .mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "");

        /*
          A way larger priority pledge
        */
        await Yamato.connect(redeemer).deposit({
          value: toERC20(toCollateralize * 1000 + ""),
        });
        await Yamato.connect(redeemer).borrow(toERC20(toBorrow.mul(10) + ""));

        /*
          priority<MCR pledges
        */
        for (var i = 1; i < accounts.length - 10; i++) {
          await Yamato.connect(accounts[i]).deposit({
            value: toERC20(toCollateralize * 0.1 + ""),
          });
          await Yamato.connect(accounts[i]).borrow(
            toERC20(toBorrow.mul(1).div(10) + "")
          );
        }

        /* Market Dump */
        await (await ChainLinkEthUsd.setLastPrice(dumpedPriceBase)).wait(); //dec8
        await (await Tellor.setLastPrice(dumpedPriceBase)).wait(); //dec8
      });

      it(`should redeem all pledges to ICR 130% and LICR is 130`, async function () {
        await (
          await Yamato.connect(redeemer).redeem(
            toERC20(toBorrow.mul(9) + ""),
            false,
            { gasLimit: 30000000 }
          )
        ).wait();
        expect(await PriorityRegistry.LICR()).to.eq(130);
      });
    });

    describe("Context - A large traversing and no gas exhaustion with more than 30% dump", function () {
      let dumpedPriceBase = "204000000000";
      let dumpedPrice = BigNumber.from(dumpedPriceBase).mul(1e12 + "");
      beforeEach(async () => {
        redeemer = accounts[0];
        toCollateralize = 1;
        toBorrow = (await PriceFeed.lastGoodPrice())
          .mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "");

        /*
          A way larger priority pledge
        */
        await Yamato.connect(redeemer).deposit({
          value: toERC20(toCollateralize * 1000 + ""),
        });
        await Yamato.connect(redeemer).borrow(toERC20(toBorrow.mul(10) + ""));

        /*
          priority<MCR pledges
        */
        for (var i = 1; i < accounts.length - 17; i++) {
          await Yamato.connect(accounts[i]).deposit({
            value: toERC20(toCollateralize * 0.1 + ""),
          });
          await Yamato.connect(accounts[i]).borrow(
            toERC20(toBorrow.mul(1).div(10) + "")
          );
        }

        /* Market Dump */
        await (await ChainLinkEthUsd.setLastPrice(dumpedPriceBase)).wait(); //dec8
        await (await Tellor.setLastPrice(dumpedPriceBase)).wait(); //dec8
      });

      it(`should redeem all pledges to ICR 0% and LICR is 184`, async function () {
        await (
          await Yamato.connect(redeemer).redeem(
            toERC20(toBorrow.mul(9) + ""),
            false,
            { gasLimit: 30000000 }
          )
        ).wait();
        expect(await PriorityRegistry.LICR()).to.eq(184);
      });
    });
  });
  describe("sweep()", function () {
    let PRICE;
    const MCR = BigNumber.from(130);
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

        const sweepablePledge = await PriorityRegistry.getRankedQueue(
          0,
          await PriorityRegistry.rankedQueueNextout(0)
        );
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

        const sweepablePledge = await PriorityRegistry.getRankedQueue(
          0,
          await PriorityRegistry.rankedQueueNextout(0)
        );
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

  describe("Context - gas estimation for max redeemees headcount (= 50 by default)", async function () {
    async function fillMinPledgesWithICR(icr) {
      const MCR = BigNumber.from(130);

      let redeemer = accounts[0];
      let redeemerAddr = await redeemer.getAddress();
      let toCollateralize = 1;
      let price = await PriceFeed.lastGoodPrice();
      let toBorrow = price
        .mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");

      const _ACCOUNTS = [];
      const transferPromise = [];

      for (var i = 0; i < accounts.length; i++) {
        let eoa = await accounts[i].getAddress();
        let ethBal = await Yamato.provider.getBalance(eoa);
        await (
          await Yamato.connect(accounts[i]).deposit({
            value: ethBal.mul(9).div(10),
          })
        ).wait();
        let pledge = await Yamato.getPledge(eoa);
        let colVal = price.mul(pledge.coll).div(1e18 + "");
        let maxBorrow = colVal.mul(100).div(MCR);
        let realBorrow = maxBorrow.sub(pledge.debt).mul(9).div(10);

        await (await Yamato.connect(accounts[i]).borrow(realBorrow)).wait();
        await (
          await CJPY.connect(accounts[i]).transfer(
            redeemerAddr,
            await CJPY.balanceOf(eoa)
          )
        ).wait();
      }

      const COUNT = await (<any>Yamato).maxRedeemableCount();
      for (var i = 0; i < COUNT; i++) {
        let bearer = accounts[i % accounts.length];
        let eoa = await bearer.getAddress();
        let ethBal = await Yamato.provider.getBalance(eoa);
        let indivBal = ethBal.mul(14).div(COUNT).sub(1);
        let wallet = Wallet.createRandom();
        wallet = wallet.connect(Yamato.provider);
        transferPromise.push(
          bearer.sendTransaction({
            to: wallet.address,
            value: indivBal,
          })
        );
        _ACCOUNTS.push(wallet);
      }

      for (var i = 0; i < _ACCOUNTS.length; i++) {
        let accAddr = await _ACCOUNTS[i].getAddress();
        let ethBal = await Yamato.provider.getBalance(accAddr);
        await (
          await Yamato.connect(_ACCOUNTS[i]).deposit({
            value: BigNumber.from(1e17 + ""),
          })
        ).wait();
        await (
          await Yamato.connect(_ACCOUNTS[i]).borrow(
            BigNumber.from(1e17 + "")
              .mul(price)
              .mul(100)
              .div(MCR)
              .div(1e18 + "")
          )
        ).wait();
        await (
          await CJPY.connect(_ACCOUNTS[i]).transfer(
            redeemerAddr,
            await CJPY.balanceOf(accAddr)
          )
        ).wait();
      }

      let coef = BigNumber.from(100).sub(MCR.sub(icr));
      let adjustedPriceInUSD = price
        .div(115)
        .mul(coef)
        .div(100)
        .div(1e12 + "");
      let adjustedPriceInJPY = price
        .mul(coef)
        .div(100)
        .div(1e14 + "");
      await (await ChainLinkEthUsd.setLastPrice(adjustedPriceInUSD)).wait(); //dec8
      await (await Tellor.setLastPrice(adjustedPriceInJPY)).wait(); //dec8

      await (await PriceFeed.fetchPrice()).wait();
    }
    describe("Context - less than 100% ICR", async function () {
      beforeEach(async () => {
        await fillMinPledgesWithICR(90);
      });
      it("should redeem within 10m gas and sweep within 16m gas", async () => {
        let tenEthInCJPY = BigNumber.from(1e19 + "")
          .mul(await PriceFeed.lastGoodPrice())
          .div(1e18 + "");

        let gas1 = await Yamato.estimateGas.redeem(tenEthInCJPY.div(2), false);
        expect(gas1).to.be.lt(30000000);

        let tx1 = await Yamato.redeem(tenEthInCJPY, false, {
          gasLimit: 30000000,
        });
        let txReceipt1 = await tx1.wait();
        expect(txReceipt1.gasUsed).to.be.lt(10000000);

        let gas2 = await Yamato.estimateGas.sweep();
        expect(gas2).to.be.lt(30000000);

        let tx2 = await Yamato.sweep();
        let txReceipt2 = await tx2.wait();
        expect(txReceipt2.gasUsed).to.be.lt(16000000);
      });
    });

    describe.only("Context - exactly 100% ICR", async function () {
      beforeEach(async () => {
        await fillMinPledgesWithICR(100);
      });
      it("should redeem within 10m gas and sweep within 16m gas", async () => {
        let tenEthInCJPY = BigNumber.from(1e19 + "")
          .mul(await PriceFeed.lastGoodPrice())
          .div(1e18 + "");

        let gas1 = await Yamato.estimateGas.redeem(tenEthInCJPY.div(2), false);
        expect(gas1).to.be.lt(30000000);

        let tx1 = await Yamato.redeem(tenEthInCJPY, false, {
          gasLimit: 30000000,
        });
        let txReceipt1 = await tx1.wait();
        expect(txReceipt1.gasUsed).to.be.lt(10000000);

        let gas2 = await Yamato.estimateGas.sweep();
        expect(gas2).to.be.lt(30000000);

        let tx2 = await Yamato.sweep();
        let txReceipt2 = await tx2.wait();
        expect(txReceipt2.gasUsed).to.be.lt(16000000);
      });
    });

    describe.only("Context - exactly 110% ICR", async function () {
      beforeEach(async () => {
        await fillMinPledgesWithICR(110);
      });
      it("should redeem within 10m gas and sweep within 16m gas", async () => {
        let tenEthInCJPY = BigNumber.from(1e19 + "")
          .mul(await PriceFeed.lastGoodPrice())
          .div(1e18 + "");

        let gas1 = await Yamato.estimateGas.redeem(tenEthInCJPY.div(2), false);
        expect(gas1).to.be.lt(30000000);

        let tx1 = await Yamato.redeem(tenEthInCJPY, false, {
          gasLimit: 30000000,
        });
        let txReceipt1 = await tx1.wait();
        expect(txReceipt1.gasUsed).to.be.lt(10000000);

        let gas2 = await Yamato.estimateGas.sweep();
        expect(gas2).to.be.lt(30000000);

        let tx2 = await Yamato.sweep();
        let txReceipt2 = await tx2.wait();
        expect(txReceipt2.gasUsed).to.be.lt(16000000);
      });
    });

    describe.only("Context - exactly 120% ICR", async function () {
      beforeEach(async () => {
        await fillMinPledgesWithICR(120);
      });
      it("should redeem within 10m gas and sweep within 16m gas", async () => {
        let tenEthInCJPY = BigNumber.from(1e19 + "")
          .mul(await PriceFeed.lastGoodPrice())
          .div(1e18 + "");

        let gas1 = await Yamato.estimateGas.redeem(tenEthInCJPY.div(2), false);
        expect(gas1).to.be.lt(30000000);

        let tx1 = await Yamato.redeem(tenEthInCJPY, false, {
          gasLimit: 30000000,
        });
        let txReceipt1 = await tx1.wait();
        expect(txReceipt1.gasUsed).to.be.lt(10000000);

        let gas2 = await Yamato.estimateGas.sweep();
        expect(gas2).to.be.lt(30000000);

        let tx2 = await Yamato.sweep();
        let txReceipt2 = await tx2.wait();
        expect(txReceipt2.gasUsed).to.be.lt(16000000);
      });
    });
  });
});
