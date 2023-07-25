import { ethers } from "hardhat";
import { smock } from "@defi-wonderland/smock";
import chai, { expect } from "chai";
import { Signer, BigNumber, Wallet } from "ethers";
import { toERC20 } from "../param/helper";
import {
  ChainLinkMock,
  PriceFeedV3,
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
  PriorityRegistryV6,
  Pool,
  ChainLinkMock__factory,
  PriceFeedV3__factory,
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
  PriorityRegistryV6__factory,
} from "../../typechain";
import {
  getProxy,
  getLinkedProxy,
  assertDebtIntegrity,
  assertPoolIntegrity,
  assertCollIntegrity,
} from "../../src/testUtil";
import { isToken } from "typescript";

chai.use(smock.matchers);

describe("PriceChangeAndRedemption :: contract Yamato", () => {
  let ChainLinkEthUsd: ChainLinkMock;
  let ChainLinkUsdJpy: ChainLinkMock;
  let PriceFeed: PriceFeedV3;
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
  let PriorityRegistry: PriorityRegistryV6;
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

    await (await ChainLinkEthUsd.setLastPrice(400000000000)).wait(); //dec8
    await (await ChainLinkUsdJpy.setLastPrice(877000)).wait();

    PriceFeed = await getProxy<PriceFeedV3, PriceFeedV3__factory>(
      "PriceFeed",
      [ChainLinkEthUsd.address, ChainLinkUsdJpy.address],
      3
    );
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
      PriorityRegistryV6,
      PriorityRegistryV6__factory
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
      let dumpedPriceBase = 204000000000;
      let dumpedPrice = BigNumber.from(dumpedPriceBase).mul(1e12 + "");
      beforeEach(async () => {
        redeemer = accounts[0];
        redeemee = accounts[1];
        toCollateralize = 1;
        toBorrow = (await PriceFeed.getPrice())
          .mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "")
          .sub(9 + "");

        /* Get redemption budget by her own */
        await Yamato.connect(redeemer).deposit({
          value: toERC20(toCollateralize * 100 + ""),
        });
        await Yamato.connect(redeemer).borrow(toERC20(toBorrow.mul(7) + ""));

        /* Set the just-one and to-be-lowest ICR */
        await Yamato.connect(redeemee).deposit({
          value: toERC20(toCollateralize + ""),
        });
        await Yamato.connect(redeemee).borrow(toERC20(toBorrow + ""));

        /* Market Dump */
        await (await ChainLinkEthUsd.setLastPrice(dumpedPriceBase)).wait(); //dec8
        await (await ChainLinkUsdJpy.setLastPrice(877000)).wait();
      });

      it(`should full-redeem a all pledge w/o infinite traversing nor no pledges redeemed but w/ reasonable gas.`, async function () {
        let redeemerAddr = await redeemer.getAddress();
        let redeemeeAddr = await redeemee.getAddress();

        await (await PriceFeed.fetchPrice()).wait();
        const redeemableCapBefore = await PriorityRegistry.getRedeemablesCap();
        const statesBefore = await Yamato.getStates();

        let debugPledge = await Yamato.getPledge(redeemeeAddr);
        let price = await PriceFeed.getPrice();

        const totalSupplyBefore = await CJPY.totalSupply();
        const redeemerCJPYBalanceBefore = await CJPY.balanceOf(redeemerAddr);
        const redeemerETHBalanceBefore = await Yamato.provider.getBalance(
          redeemerAddr
        );

        toBorrow = dumpedPrice
          .mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "")
          .sub(9 + "");

        // pledge loop and traversing redemption must be runnable in a block
        expect(
          await Yamato.estimateGas.redeem(toERC20(toBorrow.mul(3) + ""), false)
        ).to.be.lt(10000000);

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
        expect(await assertDebtIntegrity(Yamato, CJPY)).to.be.true;
        expect(await assertPoolIntegrity(Pool, CJPY)).to.be.true;
        expect(await assertCollIntegrity(Pool, Yamato)).to.be.true;
      });

      it(`should redeem even if wantToRedeemAmount is smaller than the first toBeRedeemed.`, async function () {
        await (await PriceFeed.fetchPrice()).wait();
        const dumpedEffectivePrice = await PriceFeed.getPrice();

        toBorrow = dumpedEffectivePrice
          .mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "")
          .sub(9 + "");

        await expect(
          Yamato.connect(redeemer).redeem(toERC20(toBorrow.div(2) + ""), false)
        ).not.to.be.reverted;

        expect(await assertDebtIntegrity(Yamato, CJPY)).to.be.true;
        expect(await assertPoolIntegrity(Pool, CJPY)).to.be.true;
        expect(await assertCollIntegrity(Pool, Yamato)).to.be.true;
      });
    });
    describe("Context - with 1% dump", function () {
      let dumpedPriceBase = 397000000000;
      let dumpedPrice = BigNumber.from(dumpedPriceBase).mul(1e12 + "");
      beforeEach(async () => {
        redeemer = accounts[0];
        redeemee = accounts[1];
        redeemee2 = accounts[2];
        redeemee3 = accounts[3];
        redeemee4 = accounts[4];

        toCollateralize = 1;
        toBorrow = (await PriceFeed.getPrice())
          .mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "")
          .sub(9 + "");

        /* Get redemption budget by her own */
        await Yamato.connect(redeemer).deposit({
          value: toERC20(toCollateralize * 1000 + ""),
        });
        await Yamato.connect(redeemer).borrow(toERC20(toBorrow.mul(10) + ""));

        /* Set the just-one and to-be-lowest ICR */
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
        await (await ChainLinkUsdJpy.setLastPrice(877000)).wait();
      });

      it(`should full-redeem all pledges with small CJPY amount even if there's a huge pledge`, async function () {
        // Note: If 10000<ICR<MCR then redemption amount shall be limited to "pledge.debt * (MCR - ICR) / ICR"; otherwise, full redemption.
        let redeemerAddr = await redeemer.getAddress();
        let redeemeeAddr = await redeemee.getAddress();
        let redeemeeAddr4 = await redeemee4.getAddress();

        await (await PriceFeed.fetchPrice()).wait();
        const dumpedEffectivePrice = await PriceFeed.getPrice();
        const redeemableCapBefore = await PriorityRegistry.getRedeemablesCap();
        const statesBefore = await Yamato.getStates();

        const redeemedPledgeBefore = await Yamato.getPledge(redeemeeAddr);
        const redeemedPledge4Before = await Yamato.getPledge(redeemeeAddr4);

        const totalSupplyBefore = await CJPY.totalSupply();
        const redeemerCJPYBalanceBefore = await CJPY.balanceOf(redeemerAddr);
        const redeemerETHBalanceBefore = await Yamato.provider.getBalance(
          redeemerAddr
        );

        toBorrow = dumpedEffectivePrice
          .mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "")
          .sub(9 + "");

        // pledge loop and traversing redemption must be runnable in a block
        expect(
          await Yamato.estimateGas.redeem(toERC20(toBorrow.mul(9) + ""), false)
        ).to.be.lt(10000000);

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
            .mul(dumpedEffectivePrice)
            .div(redeemedPledgeAfter.debt)
            .div(1e14 + "")
        ).to.be.gt(
          redeemedPledgeBefore.coll
            .mul(dumpedEffectivePrice)
            .div(redeemedPledgeBefore.debt)
            .div(1e14 + "")
        ); // 100<ICR<130 then ICR cured
        expect(
          redeemedPledgeAfter.coll
            .mul(dumpedEffectivePrice)
            .div(redeemedPledgeAfter.debt)
            .div(1e14 + "")
        ).to.eq(13000); // check real ICR cirtainly limited at MCR
        expect(redeemedPledgeAfter.priority).to.eq(13000); // 7 times large pledge must be full redeemed
        expect(
          redeemedPledge4After.coll
            .mul(dumpedEffectivePrice)
            .div(redeemedPledge4After.debt)
            .div(1e14 + "")
        ).to.be.gt(
          redeemedPledge4Before.coll
            .mul(dumpedEffectivePrice)
            .div(redeemedPledge4Before.debt)
            .div(1e14 + "")
        ); // 100<ICR<130 then ICR cured
        expect(redeemedPledge4After.priority).to.eq(13000); // WallBeforeLastPledge = 7 units * (130-129)/129 + 1 unit * (130-129)/129 * 4 pledges
        expect(await assertDebtIntegrity(Yamato, CJPY)).to.be.true;
        expect(await assertPoolIntegrity(Pool, CJPY)).to.be.true;
        expect(await assertCollIntegrity(Pool, Yamato)).to.be.true;
      });
    });

    describe("Context - without no dump", function () {
      beforeEach(async () => {
        redeemer = accounts[0];
        redeemee = accounts[1];
        PRICE = await PriceFeed.getPrice();
        toCollateralize = 1;
        toBorrow = PRICE.mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "")
          .sub(9 + "");

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
      let dumpedPriceBase = 200000000000;
      let dumpedPrice = BigNumber.from(dumpedPriceBase).mul(1e12 + "");
      beforeEach(async () => {
        redeemer = accounts[0];
        redeemee = accounts[1];
        anotherRedeemee = accounts[2];
        toCollateralize = 1;
        toBorrow = (await PriceFeed.getPrice())
          .mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "")
          .sub(9 + "");

        /* Get redemption budget by her own */
        await Yamato.connect(redeemer).deposit({
          value: toERC20(toCollateralize * 110.1 + ""),
        });
        await Yamato.connect(redeemer).borrow(toERC20(toBorrow.mul(100) + ""));

        /* Set the only and to-be-lowest ICR */
        await Yamato.connect(redeemee).deposit({
          value: toERC20(toCollateralize + ""),
        });
        await Yamato.connect(redeemee).borrow(toERC20(toBorrow + ""));

        /* Market Dump */
        await (await ChainLinkEthUsd.setLastPrice(300000000000)).wait(); //dec8
        await (await ChainLinkUsdJpy.setLastPrice(877000)).wait();

        /* redeemee's pledge is sweepable */
        await Yamato.connect(redeemer).redeem(
          toERC20(toBorrow.div(2) + ""),
          false
        );

        /* Market Pump */
        await (await ChainLinkEthUsd.setLastPrice(600000000000)).wait(); //dec8
        await (await ChainLinkUsdJpy.setLastPrice(877000)).wait();

        let toBorrowForAnotherRedeemee = (await PriceFeed.getPrice())
          .mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "")
          .sub(9 + "");

        /* Set anotherRedeemee's pledge to be redeemable */
        await Yamato.connect(anotherRedeemee).deposit({
          value: toERC20(toCollateralize + ""),
        });
        await Yamato.connect(anotherRedeemee).borrow(
          toERC20(toBorrowForAnotherRedeemee + "")
        );

        /* Market Dump */
        await (await ChainLinkEthUsd.setLastPrice(dumpedPriceBase)).wait(); //dec8
        await (await ChainLinkUsdJpy.setLastPrice(877000)).wait();
      });

      it(`should redeem w/o making LICR broken and w/ reasonable gas`, async function () {
        const redeemerAddr = await redeemer.getAddress();
        const redeemeeAddr = await redeemee.getAddress();
        const licr = await PriorityRegistry.LICR();
        const nextRedeemeeAddr = await PriorityRegistry.getRankedQueue(
          licr,
          await PriorityRegistry.rankedQueueNextout(licr)
        );
        const dumpedEffectivePrice = await PriceFeed.getPrice();

        toBorrow = dumpedEffectivePrice
          .mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "")
          .sub(9 + "");

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
            toERC20(toBorrow.mul(95) + ""),
            false
          )
        ).wait();

        const redeemedPledgeAfter = await Yamato.getPledge(nextRedeemeeAddr);

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
        expect(redeemedPledgeAfter.coll).to.be.eq(0); // Note: Sometimes "dusty (= very small)" coll remaines. But it is internally adjusted to 0 in Redeemer.
        expect(redeemedPledgeAfter.priority).to.be.eq(0);
        expect(feePoolBalanceAfter).to.be.eq(feePoolBalanceBefore);
        expect(await assertDebtIntegrity(Yamato, CJPY)).to.be.true;
        expect(await assertPoolIntegrity(Pool, CJPY)).to.be.true;
        expect(await assertCollIntegrity(Pool, Yamato)).to.be.true;
      });
    });

    describe("Context - core redemption", function () {
      let dumpedPriceBase = 204000000000;
      let dumpedPrice = BigNumber.from(dumpedPriceBase).mul(1e12 + "");
      let dumpedEffectivePrice;
      let yetAnotherRedeemee;
      beforeEach(async () => {
        redeemer = accounts[0];
        redeemee = accounts[1];
        anotherRedeemee = accounts[2];
        yetAnotherRedeemee = accounts[3];
        toCollateralize = 1;
        toBorrow = (await PriceFeed.getPrice())
          .mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "")
          .sub(9 + "");

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

        await Yamato.connect(yetAnotherRedeemee).deposit({
          value: toERC20(toCollateralize * 20.05 + ""),
        });
        await Yamato.connect(yetAnotherRedeemee).borrow(
          toERC20(toBorrow.mul(20) + "")
        );

        await Yamato.connect(accounts[4]).deposit({
          value: toERC20(toCollateralize * 20.05 + ""),
        });
        await Yamato.connect(accounts[4]).borrow(
          toERC20(toBorrow.mul(20) + "")
        );

        /* Market Dump */
        await (await ChainLinkEthUsd.setLastPrice(dumpedPriceBase)).wait(); //dec8
        await (await ChainLinkUsdJpy.setLastPrice(877000)).wait();
        dumpedEffectivePrice = await PriceFeed.getPrice();

        toBorrow = dumpedEffectivePrice
          .mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "")
          .sub(9 + "");

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
        const licr = await PriorityRegistry.LICR();
        const coreRedeemeeAddr = await PriorityRegistry.getRankedQueue(
          licr,
          await PriorityRegistry.rankedQueueNextout(licr)
        );

        const redeemablePledge = await Yamato.getPledge(coreRedeemeeAddr);
        const cjpyBalanceBefore = await CJPY.balanceOf(redeemerAddr);
        const redeemerETHBefore = await Yamato.provider.getBalance(
          redeemerAddr
        );
        const feePoolBalanceBefore = await Yamato.provider.getBalance(
          FeePool.address
        );

        const txReceipt = await (
          await Yamato.connect(redeemer).redeem(
            toERC20(toBorrow.mul(1) + ""),
            true
          )
        ).wait();
        const redeemedPledge = await Yamato.getPledge(coreRedeemeeAddr);
        const cjpyBalanceAfter = await CJPY.balanceOf(redeemerAddr);
        const redeemerETHAfter = await Yamato.provider.getBalance(redeemerAddr);
        const feePoolBalanceAfter = await Yamato.provider.getBalance(
          FeePool.address
        );

        expect(cjpyBalanceAfter).to.equal(cjpyBalanceBefore);
        expect(
          redeemerETHAfter.add(
            txReceipt.gasUsed.mul(txReceipt.effectiveGasPrice)
          )
        ).to.be.gt(redeemerETHBefore);
        expect(redeemedPledge.coll).to.be.lt(redeemablePledge.coll);
        expect(feePoolBalanceAfter).to.be.gt(feePoolBalanceBefore);
        expect(await assertDebtIntegrity(Yamato, CJPY)).to.be.true;
        expect(await assertPoolIntegrity(Pool, CJPY)).to.be.true;
        expect(await assertCollIntegrity(Pool, Yamato)).to.be.true;
      });
    });

    describe("Context - A very large redemption", function () {
      const COUNT = 70;
      beforeEach(async () => {
        redeemer = accounts[0];
        toCollateralize = 1;
        toBorrow = (await PriceFeed.getPrice())
          .mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "")
          .sub(9 + "");

        /* A huge whale */
        await Yamato.connect(redeemer).deposit({
          value: toERC20(toCollateralize * 2100 + ""),
        });
        await Yamato.connect(redeemer).borrow(toERC20(toBorrow.mul(2000) + ""));

        /* Tiny retail investors */
        for (var i = 1; i < COUNT; i++) {
          await (
            await Yamato.connect(accounts[i]).deposit({
              value: toERC20(toCollateralize * 1 + ""),
            })
          ).wait();
          await (
            await Yamato.connect(accounts[i]).borrow(
              toERC20(toBorrow.mul(1) + "")
            )
          ).wait();
        }

        /* Market Dump */
        await (
          await ChainLinkEthUsd.connect(redeemer).setLastPrice("204000000000")
        ).wait(); //dec8
        await (await ChainLinkUsdJpy.setLastPrice(877000)).wait();

        toBorrow = (await PriceFeed.getPrice())
          .mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "")
          .sub(9 + "");
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
          await accounts[1].getAddress()
        );
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
        const redeemeePledgeAfter = await Yamato.getPledge(
          await accounts[1].getAddress()
        );
        const statesAfter = await Yamato.getStates();

        expect(gasEstimation).to.be.lt(30000000);
        expect(redeemerETHBalanceAfter).to.be.gt(redeemerETHBalanceBefore);
        expect(statesAfter[0]).to.be.lt(statesBefore[0]); //totalColl
        expect(statesAfter[1]).to.be.lt(statesBefore[1]); //totalDebt
        expect(redeemeePledgeAfter.coll).to.be.lt(redeemeePledgeBefore.coll);
        expect(redeemeePledgeAfter.debt).to.be.lt(redeemeePledgeBefore.debt);
        expect(await assertDebtIntegrity(Yamato, CJPY)).to.be.true;
        expect(await assertPoolIntegrity(Pool, CJPY)).to.be.true;
        expect(await assertCollIntegrity(Pool, Yamato)).to.be.true;
      });
    });
    describe("Context - A large traversing and no gas exhaustion with 1% dump", function () {
      let dumpedPriceBase = 397000000000;
      let dumpedPrice = BigNumber.from(dumpedPriceBase).mul(1e12 + "");
      beforeEach(async () => {
        await (
          await ChainLinkEthUsd.setLastPrice(Math.ceil(dumpedPriceBase * 1.01))
        ).wait(); //dec8
        await (await ChainLinkUsdJpy.setLastPrice(877000)).wait();

        redeemer = accounts[0];
        toCollateralize = 1;
        toBorrow = (await PriceFeed.getPrice())
          .mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "")
          .sub(9 + "");

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
        for (var i = 1; i < 51; i++) {
          await Yamato.connect(accounts[i]).deposit({
            value: toERC20(toCollateralize * 0.1 + ""),
          });
          await Yamato.connect(accounts[i]).borrow(
            toERC20(toBorrow.mul(1).div(10) + "")
          );
        }

        /* Market Dump */
        await (await ChainLinkEthUsd.setLastPrice(dumpedPriceBase)).wait(); //dec8
        await (await ChainLinkUsdJpy.setLastPrice(877000)).wait();
      });

      it(`should redeem all pledges to ICR 130% and LICR is 130`, async function () {
        await (
          await Yamato.connect(redeemer).redeem(
            toERC20(toBorrow.mul(9) + ""), // Note: full
            false,
            { gasLimit: 30000000 }
          )
        ).wait();
        expect(await PriorityRegistry.rankedQueueLen(0)).to.eq(0);
        expect(await PriorityRegistry.rankedQueueLen(130)).to.be.gt(0);
        expect(await PriorityRegistry.getRedeemablesCap()).to.eq(0);
        expect(await PriorityRegistry.LICR()).to.eq(130);
        expect(await assertDebtIntegrity(Yamato, CJPY)).to.be.true;
        expect(await assertPoolIntegrity(Pool, CJPY)).to.be.true;
        expect(await assertCollIntegrity(Pool, Yamato)).to.be.true;
      });
      it(`should redeem all pledges to ICR 130% and LICR is less than 130`, async function () {
        const licr1 = await PriorityRegistry.LICR();
        await (
          await Yamato.connect(redeemer).redeem(
            toERC20(toBorrow.div(10) + ""), // Note: partial
            false,
            { gasLimit: 30000000 }
          )
        ).wait();
        const licr2 = await PriorityRegistry.LICR();
        expect(await PriorityRegistry.rankedQueueLen(0)).to.eq(0);
        expect(await PriorityRegistry.rankedQueueLen(130)).to.be.gt(0);
        expect(await PriorityRegistry.getRedeemablesCap()).to.be.gt(0);
        expect(licr2).to.be.lt(130);

        await (
          await Yamato.connect(redeemer).redeem(
            toERC20(toBorrow.mul(9) + ""), // Note: full
            false,
            { gasLimit: 30000000 }
          )
        ).wait();

        const licr3 = await PriorityRegistry.LICR();

        expect(await PriorityRegistry.rankedQueueLen(0)).to.eq(0);
        expect(await PriorityRegistry.rankedQueueLen(130)).to.be.gt(0);
        expect(await PriorityRegistry.getRedeemablesCap()).to.eq(0);
        expect(licr3).to.eq(130);
        expect(licr3).to.be.gt(licr2);

        expect(await assertDebtIntegrity(Yamato, CJPY)).to.be.true;
        expect(await assertPoolIntegrity(Pool, CJPY)).to.be.true;
        expect(await assertCollIntegrity(Pool, Yamato)).to.be.true;
      });
    });

    describe("Context - A large traversing and no gas exhaustion with more than 30% dump", function () {
      let dumpedPriceBase = 204000000000;
      let dumpedPrice = BigNumber.from(dumpedPriceBase).mul(1e12 + "");
      beforeEach(async () => {
        /* Market Dump */
        await (await ChainLinkEthUsd.setLastPrice(dumpedPriceBase * 3)).wait(); //dec8
        await (await ChainLinkUsdJpy.setLastPrice(877000)).wait();
        (<any>Yamato.provider).send("evm_increaseTime", [1200]);
        (<any>Yamato.provider).send("evm_mine");

        redeemer = accounts[0];
        toCollateralize = 1;
        toBorrow = (await PriceFeed.getPrice())
          .mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "")
          .sub(9 + "");

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
        for (var i = 1; i < 51; i++) {
          await Yamato.connect(accounts[i]).deposit({
            value: toERC20(toCollateralize * 0.1 + ""),
          });
          await Yamato.connect(accounts[i]).borrow(
            toERC20(toBorrow.mul(1).div(10) + "")
          );
        }

        /* Market Dump */
        await (await ChainLinkEthUsd.setLastPrice(dumpedPriceBase)).wait(); //dec8
        await (await ChainLinkUsdJpy.setLastPrice(877000)).wait();
        (<any>Yamato.provider).send("evm_increaseTime", [1200]);
        (<any>Yamato.provider).send("evm_mine");
      });

      it(`should redeem all pledges to ICR 0% and LICR is 184`, async function () {
        await (
          await Yamato.connect(redeemer).redeem(
            toERC20(toBorrow.mul(9) + ""),
            false,
            { gasLimit: 30000000 }
          )
        ).wait();
        expect(await PriorityRegistry.rankedQueueLen(0)).to.be.gt(0);
        expect(await PriorityRegistry.rankedQueueLen(130)).to.eq(0);
        expect(await PriorityRegistry.LICR()).to.eq(184);
        expect(await assertDebtIntegrity(Yamato, CJPY)).to.be.true;
        expect(await assertPoolIntegrity(Pool, CJPY)).to.be.true;
        expect(await assertCollIntegrity(Pool, Yamato)).to.be.true;
      });
      it(`should make 'LICR-corssing' redemption and must not cause a revert`, async function () {
        await (
          await Yamato.connect(redeemer).redeem(
            toERC20(toBorrow.mul(4).div(100) + ""),
            false,
            { gasLimit: 30000000 }
          )
        ).wait();

        expect(await PriorityRegistry.LICR()).to.eq(5);

        await expect(
          Yamato.connect(redeemer).redeem(
            toERC20(toBorrow.mul(1).div(100) + ""),
            false,
            { gasLimit: 30000000 }
          )
        ).not.to.be.revertedWith("_checkDirection: impossible case");
      });
    });
  });
  describe("sweep()", function () {
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
      toBorrow = (await PriceFeed.getPrice())
        .mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "")
        .sub(9 + "");

      /* Get redemption budget by her own */
      await Yamato.connect(redeemer).deposit({
        value: toERC20(toCollateralize * 90.5 + ""),
      });
      await Yamato.connect(redeemer).borrow(toERC20(toBorrow.mul(85) + ""));

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
      await (await ChainLinkUsdJpy.setLastPrice(877000)).wait();

      toBorrow = (await PriceFeed.getPrice())
        .mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "")
        .sub(9 + "");
    });

    describe("Context - partial sweep", function () {
      beforeEach(async () => {
        await (
          await Yamato.connect(redeemer).redeem(
            toERC20(toBorrow.mul(100) + ""),
            false
          )
        ).wait();
      });

      it(`should run partial sweep`, async function () {
        const redeemerAddr = await redeemer.getAddress();

        const sweepablePledge = await Yamato.getPledge(
          await PriorityRegistry.getRankedQueue(
            0,
            await PriorityRegistry.rankedQueueNextout(0)
          )
        );
        const redeemerETHBalanceBefore = await Yamato.provider.getBalance(
          redeemerAddr
        );
        const redeemerCjpyBalanceBefore = await CJPY.balanceOf(redeemerAddr);
        const poolCjpyBalanceBefore = await CJPY.balanceOf(Pool.address);

        let receipt = await (await Yamato.connect(redeemer).sweep()).wait();

        const sweptPledge = await Yamato.getPledge(sweepablePledge.owner);
        const redeemerETHBalanceAfter = await Yamato.provider.getBalance(
          redeemerAddr
        );
        const redeemerCjpyBalanceAfter = await CJPY.balanceOf(redeemerAddr);
        const poolCjpyBalanceAfter = await CJPY.balanceOf(Pool.address);

        let txcost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
        expect(redeemerETHBalanceAfter.add(txcost)).to.eq(
          redeemerETHBalanceBefore
        );
        expect(redeemerCjpyBalanceAfter).to.be.gt(redeemerCjpyBalanceBefore);
        expect(poolCjpyBalanceAfter).to.be.lt(poolCjpyBalanceBefore);
        expect(sweptPledge.debt).to.be.lt(sweepablePledge.debt);
        expect(sweptPledge.isCreated).to.be.true;
        expect(await assertDebtIntegrity(Yamato, CJPY)).to.be.true;
        expect(await assertPoolIntegrity(Pool, CJPY)).to.be.true;
        expect(await assertCollIntegrity(Pool, Yamato)).to.be.true;
      });
    });

    describe("Context - full sweep", function () {
      beforeEach(async () => {
        await (
          await Yamato.connect(redeemer).redeem(
            toERC20(toBorrow.mul(50) + ""),
            false
          )
        ).wait();
      });
      it(`should run full sweep`, async function () {
        const redeemerAddr = await redeemer.getAddress();

        const sweepablePledge = await Yamato.getPledge(
          await PriorityRegistry.getRankedQueue(
            0,
            await PriorityRegistry.rankedQueueNextout(0)
          )
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

        expect(await assertDebtIntegrity(Yamato, CJPY)).to.be.true;
        expect(await assertPoolIntegrity(Pool, CJPY)).to.be.true;
        expect(await assertCollIntegrity(Pool, Yamato)).to.be.true;
      });
    });

    describe("Context - sweep just after core redemption", function () {
      beforeEach(async () => {
        let reserve = await Pool.redemptionReserve();
        await (
          await Yamato.connect(redeemer).redeem(
            toERC20(toBorrow.mul(50) + "").sub(reserve),
            false
          )
        ).wait();
        await (await Yamato.connect(redeemer).redeem(reserve, true)).wait();
      });
      it(`should run full sweep`, async function () {
        const redeemerAddr = await redeemer.getAddress();

        const sweepablePledge = await Yamato.getPledge(
          await PriorityRegistry.getRankedQueue(
            0,
            await PriorityRegistry.rankedQueueNextout(0)
          )
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

        expect(await assertDebtIntegrity(Yamato, CJPY)).to.be.true;
        expect(await assertPoolIntegrity(Pool, CJPY)).to.be.true;
        expect(await assertCollIntegrity(Pool, Yamato)).to.be.true;
      });
    });
  });

  describe("Context - gas estimation for max redeemees headcount (= 50 by default)", async function () {
    let initialPriceBase = 397000000000;
    let initialPrice = BigNumber.from(initialPriceBase).mul(1e12 + "");
    async function fillMinPledgesWithICR(icr) {
      await (await ChainLinkEthUsd.setLastPrice(initialPriceBase)).wait(); //dec8
      await (await ChainLinkEthUsd.setLastPrice(initialPriceBase)).wait(); //dec8

      const MCR = BigNumber.from(130);

      let redeemer = accounts[0];
      let redeemerAddr = await redeemer.getAddress();
      await (await PriceFeed.fetchPrice()).wait();
      let price = await PriceFeed.getPrice();

      await (
        await Yamato.connect(accounts[0]).deposit({
          value: BigNumber.from(1e18 + "").mul(1000),
        })
      ).wait();
      await (
        await Yamato.connect(accounts[0]).borrow(
          BigNumber.from(1e18 + "")
            .mul(10)
            .mul(price)
            .mul(100)
            .div(MCR)
            .div(1e18 + "")
            .sub(9e18 + "")
        )
      ).wait();

      let toCollateralizeFor1e17 = BigNumber.from(1e17 + "");
      let toBorrowFor1e17EthInCJPY = BigNumber.from(1e17 + "")
        .mul(price)
        .mul(100)
        .div(MCR)
        .div(1e18 + "")
        .sub(9e18 + "");

      for (var i = 1; i < 51; i++) {
        let accAddr = await accounts[i].getAddress();
        let ethBal = await Yamato.provider.getBalance(accAddr);
        await (
          await Yamato.connect(accounts[i]).deposit({
            value: toCollateralizeFor1e17,
          })
        ).wait();

        let icrWhichMustBeMCR = toCollateralizeFor1e17
          .mul(price)
          .mul(100)
          .div(toBorrowFor1e17EthInCJPY)
          .div(1e18 + "");
        if (icrWhichMustBeMCR.eq(MCR) == false) {
          throw new Error(
            `fillMinPledgesWithICR(${icr}) is failing because borrowing amount is underflowing MCR(${icrWhichMustBeMCR}).`
          );
        }
        await (
          await Yamato.connect(accounts[i]).borrow(toBorrowFor1e17EthInCJPY)
        ).wait();
        await (
          await CJPY.connect(accounts[i]).transfer(
            redeemerAddr,
            await CJPY.balanceOf(accAddr)
          )
        ).wait();
      }

      let pledgeBeforeDump = await Yamato.getPledge(
        await accounts[1].getAddress()
      );

      let beforeICRNearMCR = pledgeBeforeDump.coll
        .mul(price)
        .mul(100)
        .div(pledgeBeforeDump.debt)
        .div(1e18 + "");
      let coef = BigNumber.from(1e18 + "")
        .mul(icr)
        .div(beforeICRNearMCR);
      let adjustedPriceInUSD = price
        .div(115)
        .mul(coef)
        .div(1e18 + "")
        .div(1e10 + "");
      let adjustedPriceInJPY = price
        .mul(coef)
        .div(1e18 + "")
        .div(1e12 + "");
      await (await ChainLinkEthUsd.setLastPrice(adjustedPriceInUSD)).wait(); //dec8

      await (await PriceFeed.fetchPrice()).wait();
    }
    describe("Context - less than 100% ICR", async function () {
      beforeEach(async () => {
        await fillMinPledgesWithICR(90);
      });
      it("should redeem within 10m gas and sweep within 16m gas", async () => {
        let redeemerAddr = await accounts[0].getAddress();
        let cjpyBalanceBefore = await CJPY.balanceOf(redeemerAddr);
        let ethBalanceBefore = await Yamato.provider.getBalance(redeemerAddr);

        let fiveEthInCJPY = BigNumber.from(5e18 + "")
          .mul(await PriceFeed.getPrice())
          .div(1e18 + "")
          .add(49e18 + ""); // fill tiny diff

        let gas1 = await Yamato.estimateGas.redeem(fiveEthInCJPY, false);
        expect(gas1).to.be.lt(30000000);

        let tx1 = await Yamato.redeem(fiveEthInCJPY, false, {
          gasLimit: 30000000,
        });
        let txReceipt1 = await tx1.wait();
        expect(txReceipt1.gasUsed).to.be.lt(10000000);
        let sweepablePledge = await Yamato.getPledge(
          await PriorityRegistry.getRankedQueue(
            0,
            await PriorityRegistry.rankedQueueNextout(0)
          )
        );
        expect(sweepablePledge.coll).to.eq(0); // This test case remains a tiny coll

        let ethBalanceAfter = await Yamato.provider.getBalance(redeemerAddr);
        let redemptionReturn = ethBalanceAfter.sub(ethBalanceBefore);
        let txcost = txReceipt1.gasUsed.mul(txReceipt1.effectiveGasPrice);
        expect(redemptionReturn.add(txcost)).to.eq(BigNumber.from(500e16 + ""));

        let gas2 = await Yamato.estimateGas.sweep();
        expect(gas2).to.be.lt(30000000);

        let tx2 = await Yamato.sweep();
        let txReceipt2 = await tx2.wait();
        expect(txReceipt2.gasUsed).to.be.lt(16000000);

        expect(await assertDebtIntegrity(Yamato, CJPY)).to.be.true;
        expect(await assertPoolIntegrity(Pool, CJPY)).to.be.true;
        expect(await assertCollIntegrity(Pool, Yamato)).to.be.true;
      });
    });

    describe("Context - exactly 100% ICR", async function () {
      beforeEach(async () => {
        await fillMinPledgesWithICR(100);
      });
      it("should redeem within 10m gas and sweep within 16m gas", async () => {
        const price = await PriceFeed.getPrice();
        let redeemerAddr = await accounts[0].getAddress();
        let cjpyBalanceBefore = await CJPY.balanceOf(redeemerAddr);
        let ethBalanceBefore = await Yamato.provider.getBalance(redeemerAddr);

        let fiveEthInCJPY = BigNumber.from(5e18 + "")
          .mul(price)
          .div(1e18 + "")
          .add(49e18 + ""); // fill tiny diff

        let gas1 = await Yamato.estimateGas.redeem(fiveEthInCJPY, false);
        expect(gas1).to.be.lt(30000000);

        let tx1 = await Yamato.redeem(fiveEthInCJPY, false, {
          gasLimit: 30000000,
        });
        let txReceipt1 = await tx1.wait();
        expect(txReceipt1.gasUsed).to.be.lt(10000000);

        expect(
          (await Yamato.getPledge(await accounts[1].getAddress())).coll
        ).to.eq(0);
        expect(
          (await Yamato.getPledge(await accounts[2].getAddress())).coll
        ).to.eq(0);
        expect(
          (await Yamato.getPledge(await accounts[3].getAddress())).coll
        ).to.eq(0);
        expect(
          (await Yamato.getPledge(await accounts[50].getAddress())).coll
        ).to.eq(0);

        let ethBalanceAfter = await Yamato.provider.getBalance(redeemerAddr);
        let redemptionReturn = ethBalanceAfter.sub(ethBalanceBefore);
        let txcost = txReceipt1.gasUsed.mul(txReceipt1.effectiveGasPrice);
        expect(redemptionReturn.add(txcost)).to.eq(BigNumber.from(500e16 + ""));

        let gas2 = await Yamato.estimateGas.sweep();
        expect(gas2).to.be.lt(30000000);

        let tx2 = await Yamato.sweep();
        let txReceipt2 = await tx2.wait();
        expect(txReceipt2.gasUsed).to.be.lt(16000000);

        expect(await assertDebtIntegrity(Yamato, CJPY)).to.be.true;
        expect(await assertPoolIntegrity(Pool, CJPY)).to.be.true;
        expect(await assertCollIntegrity(Pool, Yamato)).to.be.true;
      });
    });

    describe("Context - exactly 110% ICR", async function () {
      beforeEach(async () => {
        await fillMinPledgesWithICR(110);
      });
      it("should redeem within 10m gas and sweep within 16m gas", async () => {
        let redeemerAddr = await accounts[0].getAddress();
        let cjpyBalanceBefore = await CJPY.balanceOf(redeemerAddr);
        let ethBalanceBefore = await Yamato.provider.getBalance(redeemerAddr);

        let fiveEthInCJPY = BigNumber.from(5e18 + "")
          .mul(await PriceFeed.getPrice())
          .div(1e18 + "")
          .add(49e18 + ""); // fill tiny diff

        let gas1 = await Yamato.estimateGas.redeem(fiveEthInCJPY, false);
        expect(gas1).to.be.lt(30000000);

        let tx1 = await Yamato.redeem(fiveEthInCJPY, false, {
          gasLimit: 30000000,
        });
        let txReceipt1 = await tx1.wait();
        expect(txReceipt1.gasUsed).to.be.lt(10000000);

        let ethBalanceAfter = await Yamato.provider.getBalance(redeemerAddr);
        let redemptionReturn = ethBalanceAfter.sub(ethBalanceBefore);
        let txcost = txReceipt1.gasUsed.mul(txReceipt1.effectiveGasPrice);
        expect(redemptionReturn.add(txcost)).to.lte(
          BigNumber.from(5e18 + "")
            .mul(5)
            .div(6)
        );
        expect(redemptionReturn.add(txcost)).to.gt(
          BigNumber.from(5e18 + "")
            .mul(3)
            .div(6)
        );

        expect(await assertDebtIntegrity(Yamato, CJPY)).to.be.true;
        expect(await assertPoolIntegrity(Pool, CJPY)).to.be.true;
        expect(await assertCollIntegrity(Pool, Yamato)).to.be.true;
        await expect(Yamato.sweep()).to.be.revertedWith("No sweepables.");
      });
    });

    describe("Context - exactly 120% ICR", async function () {
      beforeEach(async () => {
        await fillMinPledgesWithICR(120);
      });
      it("should redeem within 10m gas and sweep within 16m gas", async () => {
        let redeemerAddr = await accounts[0].getAddress();
        let cjpyBalanceBefore = await CJPY.balanceOf(redeemerAddr);
        let ethBalanceBefore = await Yamato.provider.getBalance(redeemerAddr);

        let fiveEthInCJPY = BigNumber.from(5e18 + "")
          .mul(await PriceFeed.getPrice())
          .div(1e18 + "")
          .add(49e18 + ""); // fill tiny diff

        let gas1 = await Yamato.estimateGas.redeem(fiveEthInCJPY, false);
        expect(gas1).to.be.lt(30000000);

        let tx1 = await Yamato.redeem(fiveEthInCJPY, false, {
          gasLimit: 30000000,
        });
        let txReceipt1 = await tx1.wait();
        expect(txReceipt1.gasUsed).to.be.lt(10000000);

        let ethBalanceAfter = await Yamato.provider.getBalance(redeemerAddr);
        let redemptionReturn = ethBalanceAfter.sub(ethBalanceBefore);
        let txcost = txReceipt1.gasUsed.mul(txReceipt1.effectiveGasPrice);
        expect(redemptionReturn.add(txcost)).to.lte(
          BigNumber.from(5e18 + "")
            .mul(3)
            .div(6)
        );
        expect(redemptionReturn.add(txcost)).to.gt(
          BigNumber.from(5e18 + "")
            .mul(1)
            .div(6)
        );

        expect(await assertDebtIntegrity(Yamato, CJPY)).to.be.true;
        expect(await assertPoolIntegrity(Pool, CJPY)).to.be.true;
        expect(await assertCollIntegrity(Pool, Yamato)).to.be.true;
        await expect(Yamato.sweep()).to.be.revertedWith("No sweepables.");
      });
      it("should accept reset and sync.", async () => {
        function icr(pledge, price) {
          if (pledge.debt.isZero()) {
            return BigNumber.from(2).pow(256);
          } else {
            return pledge.coll
              .mul(price)
              .div(pledge.debt)
              .div(1e14 + "");
          }
        }

        /*
          Dummy upsert to refrect price change to LICR
        */
        for (var i = 1; i < 51; i++) {
          await (
            await Yamato.connect(accounts[i]).deposit({ value: 1 })
          ).wait();
        }

        /*
          Get pledges for reset
        */
        let filter = Yamato.filters.Deposited(null, null);
        let logs = await Yamato.queryFilter(filter);

        let pledgeOwners = logs
          .map((log) => log.args.sender)
          .filter((value, index, self) => self.indexOf(value) === index);
        let pledges = await Promise.all(
          pledgeOwners.map(async (owner) => await Yamato.getPledge(owner))
        );
        pledges = pledges.filter((p) => p.isCreated);
        let price = await PriceFeed.getPrice();
        pledges = pledges.sort((a, b) => {
          return icr(a, price).gte(icr(b, price)) ? 1 : -1;
        });

        expect(await PriorityRegistry.getRedeemablesCap()).to.be.gt(0);
        expect(await PriorityRegistry.LICR()).to.be.eq(119);

        /*
          reset
        */
        await PriorityRegistry.resetQueue(1, pledges);

        expect(await PriorityRegistry.getRedeemablesCap()).to.be.eq(0);
        expect(await PriorityRegistry.LICR()).to.be.eq(0);

        /*
          sync
        */
        await (
          await PriorityRegistry.syncRankedQueue(pledges, {
            gasLimit: 24000000,
          })
        ).wait();

        expect(await PriorityRegistry.getRedeemablesCap()).to.be.gt(0);
        expect(await PriorityRegistry.LICR()).to.be.eq(119);
      });
    });
  });
});
