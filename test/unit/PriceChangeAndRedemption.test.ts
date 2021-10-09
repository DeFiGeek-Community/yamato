import { ethers } from "hardhat";
import { smock } from "@defi-wonderland/smock";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { Signer, BigNumber } from "ethers";
import { toERC20 } from "../param/helper";
import {
  ChainLinkMock,
  TellorCallerMock,
  PriceFeed,
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
  PriorityRegistry__factory,
} from "../../typechain";

chai.use(smock.matchers);
chai.use(solidity);

describe("PriceChangeAndRedemption :: contract Yamato", () => {
  let ChainLinkEthUsd: ChainLinkMock;
  let ChainLinkUsdJpy: ChainLinkMock;
  let Tellor: TellorCallerMock;
  let PriceFeed: PriceFeed;
  let CJPY: CJPY;
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

    PriceFeed = await (<PriceFeed__factory>(
      await ethers.getContractFactory("PriceFeed")
    )).deploy(ChainLinkEthUsd.address, ChainLinkUsdJpy.address, Tellor.address);

    CJPY = await (<CJPY__factory>(
      await ethers.getContractFactory("CJPY")
    )).deploy();

    CjpyOS = await (<CjpyOS__factory>(
      await ethers.getContractFactory("CjpyOS")
    )).deploy(
      CJPY.address,
      PriceFeed.address
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
        PRICE = await PriceFeed.lastGoodPrice();
        toCollateralize = 1;
        toBorrow = PRICE.mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "");

        /* Get redemption budget by her own */
        await Yamato.connect(redeemer).deposit({
          value: toERC20(toCollateralize * 100 + ""),
        });
        await Yamato.connect(redeemer).borrow(toERC20(toBorrow.mul(10) + ""));

        /* Set the only and to-be-lowest ICR */
        await Yamato.connect(redeemee).deposit({
          value: toERC20(toCollateralize + ""),
        });
        await Yamato.connect(redeemee).borrow(toERC20(toBorrow + ""));

        /* Market Dump */
        await (await ChainLinkEthUsd.setLastPrice("204000000000")).wait(); //dec8
        await (await Tellor.setLastPrice("203000000000")).wait(); //dec8
      });

      it(`should redeem a lowest pledge w/o infinite traversing.`, async function () {
        let redeemerAddr = await redeemer.getAddress();
        let redeemeeAddr = await redeemee.getAddress();

        const totalSupplyBefore = await CJPY.totalSupply();
        const redeemerCJPYBalanceBefore = await CJPY.balanceOf(redeemerAddr);
        const redeemerETHBalanceBefore = await Yamato.provider.getBalance(
          redeemerAddr
        );

        const redeemedPledgeBefore = await Yamato.getPledge(redeemeeAddr);

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

        expect(totalSupplyAfter).to.be.lt(totalSupplyBefore);
        expect(redeemerCJPYBalanceAfter).to.be.lt(redeemerCJPYBalanceBefore);
        expect(redeemerETHBalanceAfter.add(txReceipt.gasUsed)).to.be.gt(
          redeemerETHBalanceBefore
        ); //gas?
        expect(redeemedPledgeAfter.coll).to.be.eq(0);
        expect(redeemedPledgeAfter.lastUpsertedTimeICRpertenk).to.be.eq(0);
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
          value: toERC20(toCollateralize * 100 + ""),
        });
        await Yamato.connect(redeemer).borrow(toERC20(toBorrow.mul(100) + ""));

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
          value: toERC20(toCollateralize * 100 + ""),
        });
        await Yamato.connect(redeemer).borrow(toERC20(toBorrow.mul(10) + ""));

        /* Set the only and to-be-lowest ICR */
        console.log("redeemee:deposit");
        await Yamato.connect(redeemee).deposit({
          value: toERC20(toCollateralize + ""),
        });
        console.log("redeemee:borrow");
        await Yamato.connect(redeemee).borrow(toERC20(toBorrow + ""));

        /* Market Dump */
        await (await ChainLinkEthUsd.setLastPrice("200000000000")).wait(); //dec8
        await (await Tellor.setLastPrice("200000000000")).wait(); //dec8
        console.log("=== dump");

        /* redeemee's pledge is sweepable */
        console.log("firstRedemption");
        await Yamato.connect(redeemer).redeem(
          toERC20(toBorrow.mul(3) + ""),
          false
        );

        /* Market Pump */
        await (await ChainLinkEthUsd.setLastPrice("400000000000")).wait(); //dec8
        await (await Tellor.setLastPrice("400000000000")).wait(); //dec8
        console.log("=== pump");

        /* Set anotherRedeemee's pledge to be redeemable */
        console.log("anotherRedeemee:deposit");
        await Yamato.connect(anotherRedeemee).deposit({
          value: toERC20(toCollateralize + ""),
        });
        console.log("anotherRedeemee:borrow");
        await Yamato.connect(anotherRedeemee).borrow(toERC20(toBorrow + ""));

        /* Market Dump */
        await (await ChainLinkEthUsd.setLastPrice("100000000000")).wait(); //dec8
        await (await Tellor.setLastPrice("100000000000")).wait(); //dec8
        console.log("=== dump");
      });

      it.only(`should redeem without making LICR broken`, async function () {
        const licrBefore = await PriorityRegistry.currentLICRpertenk();

        // Bug: redeemeePledge is "sweepabilized" and LICR is not traversed.
        const addrBefore = await PriorityRegistry.getLevelIndice(licrBefore, 0);
        const pledgeBefore = await Yamato.getPledge(addrBefore);

        console.log(
          await Promise.all(
            ( await Promise.all(
              ( await Promise.all(
                accounts.map(async (el)=>{
                  return await el.getAddress()
                })
              ) )
              .map(async addr=>{
                return await Yamato.getPledge(addr); 
              })
            ) ).map(async p=>{
              return `owner:${p.owner} lastUpsertedTimeICRpertenk:${p.lastUpsertedTimeICRpertenk} icr:${p.debt.isZero ? 'inf' : p.coll.mul(await PriceFeed.lastGoodPrice()).div(p.debt).mul(10000)}`
            })
          )
        )

        toBorrow = (await PriceFeed.lastGoodPrice())
          .mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "");
        console.log("lastRedemption");
        const txReceipt = await (
          await Yamato.connect(redeemer).redeem(
            toERC20(toBorrow.mul(3) + ""),
            false
          )
        ).wait();

        const licrAfter = await PriorityRegistry.currentLICRpertenk();
        const addrAfter = await PriorityRegistry.getLevelIndice(licrAfter, 0);
        const pledgeAfter = await Yamato.getPledge(addrAfter);

        console.log(pledgeAfter); //it must be lastICR=0; but in reality, failed.
      });
    });
  });
});
