import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  setProvider,
  getDeploymentAddressPath,
  getDeploymentAddressPathWithTag,
  getFoundation,
} from "../src/deployUtil";
import { readFileSync } from "fs";
import { genABI } from "../src/genABI";
import { Contract } from "ethers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
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

  await (await Yamato.connect(getFoundation()).revokeTester()).wait();
  console.log(`log: Yamato.revokeTester() executed.`);

  await YamatoDepositor.connect(getFoundation()).revokeTester()
  console.log(`log: YamatoDepositor.revokeTester() executed.`);
  await YamatoBorrower.connect(getFoundation()).revokeTester()
  console.log(`log: YamatoBorrower.revokeTester() executed.`);
  await YamatoRepayer.connect(getFoundation()).revokeTester()
  console.log(`log: YamatoRepayer.revokeTester() executed.`);
  await YamatoWithdrawer.connect(getFoundation()).revokeTester()
  console.log(`log: YamatoWithdrawer.revokeTester() executed.`);
  await YamatoRedeemer.connect(getFoundation()).revokeTester()
  console.log(`log: YamatoRedeemer.revokeTester() executed.`);
  await YamatoSweeper.connect(getFoundation()).revokeTester()
  console.log(`log: YamatoSweeper.revokeTester() executed.`);
};
export default func;
func.tags = [""];
