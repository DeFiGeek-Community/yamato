import { ethers } from "hardhat";

import { genABI } from "./genABI";
import {
  setProvider,
  setNetwork,
  getDeploymentAddressPathWithTag,
  getFoundation,
  getDeployer,
} from "../src/deployUtil";
import {
  assertPoolIntegrity,
  assertCollIntegrityWithSelfDestruct,
  assertDebtIntegrity,
} from "../src/testUtil";

import { readFileSync, existsSync } from "fs";
import { toERC20 } from "../test/param/helper";
import { BigNumber } from "ethers";

export async function smokeTest() {
  setNetwork("goerli");
  const p = await setProvider();
  const filepath = getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy");
  if (!existsSync(filepath)) throw new Error(`${filepath} is not exist`);
  const YamatoAddr = readFileSync(filepath).toString();
  const accounts = await ethers.getSigners();

  const Yamato = new ethers.Contract(YamatoAddr, genABI("YamatoV3"), p);

  const redeemer = getFoundation();
  const redeemee = getDeployer();
  const _redeemerAddr = await redeemer.getAddress();
  const _redeemeeAddr = await redeemee.getAddress();

  const toCollateralize = 0.001;
  const MCR = BigNumber.from(130);

  const PriceFeed = new ethers.Contract(
    await Yamato.priceFeed(),
    genABI("PriceFeedV3"),
    p
  );
  console.log("---");
  const ChainLinkEthUsd = new ethers.Contract(
    await PriceFeed.ethPriceAggregatorInUSD(),
    genABI("ChainLinkMock"),
    p
  );
  console.log("---");
  process.exit();
  const Tellor = new ethers.Contract(
    await PriceFeed.tellorCaller(),
    genABI("TellorCallerMock"),
    p
  );
  const CurrencyOS = new ethers.Contract(
    await Yamato.currencyOS(),
    genABI("CurrencyOSV2"),
    p
  );
  const CJPY = new ethers.Contract(
    await CurrencyOS.currency(),
    genABI("CJPY"),
    p
  );
  const Pool = new ethers.Contract(await Yamato.pool(), genABI("PoolV2"), p);

  /*
        Market Init
    */
  await (
    await ChainLinkEthUsd.connect(redeemer).setLastPrice("404000000000")
  ).wait(); //dec8
  await (await Tellor.connect(redeemer).setLastPrice("403000000000")).wait(); //dec8

  const toBorrow = (await PriceFeed.lastGoodPrice())
    .mul(toCollateralize * 10000)
    .mul(100)
    .div(MCR)
    .div(1e18 + "")
    .div(10000);

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
    await Yamato.connect(redeemer).redeem(
      toERC20(toBorrow.div(20) + ""),
      true,
      {
        gasLimit: 20000000,
      }
    )
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
        Send money for repayment
    */
  let redeemeePledgeBeforeRepay = await Yamato.getPledge(_redeemeeAddr);
  let d = redeemeePledgeBeforeRepay.debt;
  let b = await CJPY.balanceOf(_redeemeeAddr);
  let lack: BigNumber = d.sub(b);
  if (lack.gt(0)) {
    await CJPY.connect(redeemer).transfer(_redeemeeAddr, lack);
  }

  /*
        full repay()
    */
  await (
    await Yamato.connect(redeemee).repay(d, {
      gasLimit: 1000000,
    })
  ).wait();

  /*
        check full repay
    */
  let redeemeeFullyRepaidPledge1 = await Yamato.getPledge(_redeemeeAddr);
  console.log(
    `redeemeeFullyRepaidPledge1:fullRepay? ${redeemeeFullyRepaidPledge1}`
  );

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
        .div(1e6 + ""),
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

  assertCollIntegrityWithSelfDestruct(Pool, Yamato);
  assertDebtIntegrity(Yamato, CJPY);
  assertPoolIntegrity(Pool, CJPY);
}

smokeTest().catch((e) => console.log(e.message));
