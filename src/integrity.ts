import { ethers } from "hardhat";

import { genABI } from "./genABI";
import {
  setProvider,
  setNetwork,
  getDeploymentAddressPathWithTag,
  getFoundation,
  getDeployer,
} from "../src/deployUtil";
import { readFileSync, existsSync } from "fs";
import { toERC20 } from "../test/param/helper";
import { BigNumber } from "ethers";

export async function smokeTest() {
  setNetwork("rinkeby");
  const p = await setProvider();
  const filepath = getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy");
  if (!existsSync(filepath)) throw new Error(`${filepath} is not exist`);
  const YamatoAddr = readFileSync(filepath).toString();
  const accounts = await ethers.getSigners();

  const Yamato = new ethers.Contract(YamatoAddr, genABI("Yamato"), p);

  const redeemer = getFoundation();
  const redeemee = getDeployer();
  const _redeemerAddr = await redeemer.getAddress();
  const _redeemeeAddr = await redeemee.getAddress();

  const toCollateralize = 0.001;
  const MCR = BigNumber.from(130);
  const PriceFeed = new ethers.Contract(
    await Yamato.feed(),
    genABI("PriceFeed"),
    p
  );
  const ChainLinkEthUsd = new ethers.Contract(
    await PriceFeed.ethPriceAggregatorInUSD(),
    genABI("ChainLinkMock"),
    p
  );
  const Tellor = new ethers.Contract(
    await PriceFeed.tellorCaller(),
    genABI("TellorCallerMock"),
    p
  );

  const toBorrow = (await PriceFeed.lastGoodPrice())
    .mul(toCollateralize * 10000)
    .mul(100)
    .div(MCR)
    .div(1e18 + "")
    .div(10000);

  /*
        Market Init
    */
  await (
    await ChainLinkEthUsd.connect(redeemer).setLastPrice("404000000000")
  ).wait(); //dec8
  await (await Tellor.connect(redeemer).setLastPrice("403000000000")).wait(); //dec8

  /*
        Get redemption budget by her own
    */
  await (
    await Yamato.connect(redeemer).deposit({
      value: BigNumber.from(toCollateralize * 7.1 * 10000 + "")
        .mul(1e18 + "")
        .div(1e4 + ""),
    })
  ).wait();
  await (
    await Yamato.connect(redeemer).borrow(toERC20(toBorrow.mul(3) + ""), {
      gasLimit: 1000000,
    })
  ).wait();
  await (
    await Yamato.connect(redeemer).borrow(toERC20(toBorrow.mul(2) + ""), {
      gasLimit: 1000000,
    })
  ).wait();

  /*
        Set target account
    */
  await (
    await Yamato.connect(redeemee).deposit({
      value: BigNumber.from(toCollateralize * 4 * 10000 + "")
        .mul(1e18 + "")
        .div(1e4 + ""),
      gasLimit: 1000000,
    })
  ).wait();
  await (
    await Yamato.connect(redeemee).borrow(toERC20(toBorrow.mul(4) + ""), {
      gasLimit: 1000000,
    })
  ).wait();

  /*
        Market Dump
    */
  await (
    await ChainLinkEthUsd.connect(redeemer).setLastPrice("204000000000")
  ).wait(); //dec8
  await (await Tellor.connect(redeemer).setLastPrice("203000000000")).wait(); //dec8

  /*
        redeem()
    */
  await (
    await Yamato.connect(redeemer).redeem(
      toERC20(toBorrow.div(2) + ""),
      false,
      { gasLimit: 20000000 }
    )
  ).wait();
  await (
    await Yamato.connect(redeemer).redeem(toERC20(toBorrow.div(20) + ""), true, {
      gasLimit: 20000000,
    })
  ).wait();
  await (
    await Yamato.connect(redeemer).redeem(
      toERC20(toBorrow.div(2) + ""),
      false,
      { gasLimit: 20000000 }
    )
  ).wait();

  /*
        Market pump
    */
  await (
    await ChainLinkEthUsd.connect(redeemer).setLastPrice("404000000000")
  ).wait(); //dec8
  await (await Tellor.connect(redeemer).setLastPrice("403000000000")).wait(); //dec8

  /*
        full repay()
    */
  await (
    await Yamato.connect(redeemee).repay(toERC20(toBorrow.mul(10) + ""), {
      gasLimit: 1000000,
    })
  ).wait();

  /*
        check full repay
    */
  let redeemeePledge1 = await Yamato.getPledge(_redeemeeAddr);
  console.log(`redeemeePledge1:fullRepay? ${redeemeePledge1}`);

  /*
        deposit() from zero pledge
    */
  await (
    await Yamato.connect(redeemee).deposit({
      value: BigNumber.from(toCollateralize * 1 * 10000 + "")
        .mul(1e18 + "")
        .div(1e4 + ""),
      gasLimit: 1000000,
    })
  ).wait();
  let redeemeePledge2 = await Yamato.getPledge(_redeemeeAddr);
  console.log(`redeemeePledge2:re-deposit? ${redeemeePledge2}`);

  /*
        withdraw()
    */
  await (
    await Yamato.connect(redeemer).withdraw(
      BigNumber.from(toCollateralize * 10000 + "")
        .mul(1e18 + "")
        .div(1e4 + ""),
      { gasLimit: 1000000 }
    )
  ).wait();

  /*
        Set redeemee again
    */
  await (
    await Yamato.connect(redeemee).deposit({
      value: BigNumber.from(toCollateralize * 10000 + "")
        .mul(1e18 + "")
        .div(1e4 + ""),
      gasLimit: 1000000,
    })
  ).wait();
  await (
    await Yamato.connect(redeemee).borrow(toERC20(toBorrow + ""), {
      gasLimit: 1000000,
    })
  ).wait();

  const CurrencyOS = new ethers.Contract(
    await Yamato.currencyOS(),
    genABI("CurrencyOS"),
    p
  );
  const CJPY = new ethers.Contract(
    await CurrencyOS.currency(),
    genABI("CJPY"),
    p
  );
  const Pool = new ethers.Contract(await Yamato.pool(), genABI("Pool"), p);

  const redeemerCJPYBalance = await CJPY.balanceOf(_redeemerAddr);
  const redeemeeCJPYBalance = await CJPY.balanceOf(_redeemeeAddr);

  const redeemerDebt = (await Yamato.getPledge(_redeemerAddr)).debt;
  const redeemeeDebt = (await Yamato.getPledge(_redeemeeAddr)).debt;

  const poolRedemptionReserve = await Pool.redemptionReserve();
  const poolSweepReserve = await Pool.sweepReserve();

  console.log(`
     \\ alice borrow /        \\ bob borrow /       \\ alice&bob fee part1 /   \\ alice&bob fee part2 /             \\ alice&bob debt /
    redeemerCJPYBalance  +  redeemeeCJPYBalance  +  poolRedemptionReserve     +    poolSweepReserve           =  redeemerDebt + redeemeeDebt

 s${redeemerCJPYBalance} + ${redeemeeCJPYBalance} + ${poolRedemptionReserve} + ${poolSweepReserve}       =  ${redeemerDebt} + ${redeemeeDebt}

    ${redeemerCJPYBalance
      .add(redeemeeCJPYBalance)
      .add(poolRedemptionReserve)
      .add(poolSweepReserve)} = ${redeemerDebt.add(redeemeeDebt)}
    `);
}

smokeTest().catch((e) => console.log(e.message));
