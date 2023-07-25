import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  setProvider,
  getDeploymentAddressPath,
  getDeploymentAddressPathWithTag,
  getFoundation,
  existsSlot,
  sleep,
  setNetwork,
} from "../src/deployUtil";
import { readFileSync } from "fs";
import { genABI } from "../src/genABI";
import { Contract, constants } from "ethers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  setNetwork(hre.network.name);
  const p = await setProvider();

  const _yamatoAddr = readFileSync(
    getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy")
  ).toString();
  const Yamato = new Contract(_yamatoAddr, genABI("Yamato"), p);

  const _yamatoDepositorAddr = readFileSync(
    getDeploymentAddressPathWithTag("YamatoDepositor", "ERC1967Proxy")
  ).toString();
  const YamatoDepositor = new Contract(
    _yamatoDepositorAddr,
    genABI("YamatoDepositor"),
    p
  );
  const _yamatoBorrowerAddr = readFileSync(
    getDeploymentAddressPathWithTag("YamatoBorrower", "ERC1967Proxy")
  ).toString();
  const YamatoBorrower = new Contract(
    _yamatoBorrowerAddr,
    genABI("YamatoBorrower"),
    p
  );
  const _yamatoRepayerAddr = readFileSync(
    getDeploymentAddressPathWithTag("YamatoRepayer", "ERC1967Proxy")
  ).toString();
  const YamatoRepayer = new Contract(
    _yamatoRepayerAddr,
    genABI("YamatoRepayer"),
    p
  );
  const _yamatoWithdrawerAddr = readFileSync(
    getDeploymentAddressPathWithTag("YamatoWithdrawer", "ERC1967Proxy")
  ).toString();
  const YamatoWithdrawer = new Contract(
    _yamatoWithdrawerAddr,
    genABI("YamatoWithdrawer"),
    p
  );
  const _yamatoRedeemerAddr = readFileSync(
    getDeploymentAddressPathWithTag("YamatoRedeemer", "ERC1967Proxy")
  ).toString();
  const YamatoRedeemer = new Contract(
    _yamatoRedeemerAddr,
    genABI("YamatoRedeemer"),
    p
  );
  const _yamatoSweeperAddr = readFileSync(
    getDeploymentAddressPathWithTag("YamatoSweeper", "ERC1967Proxy")
  ).toString();
  const YamatoSweeper = new Contract(
    _yamatoSweeperAddr,
    genABI("YamatoSweeper"),
    p
  );

  await sleep(5000);
  if ((await Yamato.tester()) !== constants.AddressZero) {
    await (await Yamato.connect(getFoundation()).revokeTester()).wait();
    console.log(`log: Yamato.revokeTester() executed.`);
  } else {
    console.log(`log: Yamato.revokeTester() skipped.`);
  }

  await sleep(3000);
  if ((await YamatoDepositor.tester()) !== constants.AddressZero) {
    await YamatoDepositor.connect(getFoundation()).revokeTester();
    console.log(`log: YamatoDepositor.revokeTester() executed.`);
  } else {
    console.log(`log: YamatoDepositor.revokeTester() skipped.`);
  }

  await sleep(3000);
  if ((await YamatoBorrower.tester()) !== constants.AddressZero) {
    await YamatoBorrower.connect(getFoundation()).revokeTester();
    console.log(`log: YamatoBorrower.revokeTester() executed.`);
  } else {
    console.log(`log: YamatoBorrower.revokeTester() skipped.`);
  }

  await sleep(3000);
  if ((await YamatoRepayer.tester()) !== constants.AddressZero) {
    await YamatoRepayer.connect(getFoundation()).revokeTester();
    console.log(`log: YamatoRepayer.revokeTester() executed.`);
  } else {
    console.log(`log: YamatoRepayer.revokeTester() skipped.`);
  }

  await sleep(3000);
  if ((await YamatoWithdrawer.tester()) !== constants.AddressZero) {
    await YamatoWithdrawer.connect(getFoundation()).revokeTester();
    console.log(`log: YamatoWithdrawer.revokeTester() executed.`);
  } else {
    console.log(`log: YamatoWithdrawer.revokeTester() skipped.`);
  }

  await sleep(4000);
  if ((await YamatoRedeemer.tester()) !== constants.AddressZero) {
    await YamatoRedeemer.connect(getFoundation()).revokeTester();
    console.log(`log: YamatoRedeemer.revokeTester() executed.`);
  } else {
    console.log(`log: YamatoRedeemer.revokeTester() skipped.`);
  }

  await sleep(4000);
  if ((await YamatoSweeper.tester()) !== constants.AddressZero) {
    await YamatoSweeper.connect(getFoundation()).revokeTester();
    console.log(`log: YamatoSweeper.revokeTester() executed.`);
  } else {
    console.log(`log: YamatoSweeper.revokeTester() skipped.`);
  }
};

export default func;
func.tags = [""];
