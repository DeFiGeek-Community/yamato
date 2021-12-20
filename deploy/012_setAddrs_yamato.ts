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
  const { ethers, deployments } = hre;
  const { getContractFactory } = ethers;

  const _yamatoAddr = readFileSync(
    getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy")
  ).toString();
  const _yamatoDepositorAddr = readFileSync(
    getDeploymentAddressPathWithTag("YamatoDepositor", "ERC1967Proxy")
  ).toString();
  const _yamatoBorrowerAddr = readFileSync(
    getDeploymentAddressPathWithTag("YamatoBorrower", "ERC1967Proxy")
  ).toString();
  const _yamatoRepayerAddr = readFileSync(
    getDeploymentAddressPathWithTag("YamatoRepayer", "ERC1967Proxy")
  ).toString();
  const _yamatoWithdrawerAddr = readFileSync(
    getDeploymentAddressPathWithTag("YamatoWithdrawer", "ERC1967Proxy")
  ).toString();
  const _yamatoRedeemerAddr = readFileSync(
    getDeploymentAddressPathWithTag("YamatoRedeemer", "ERC1967Proxy")
  ).toString();
  const _yamatoSweeperAddr = readFileSync(
    getDeploymentAddressPathWithTag("YamatoSweeper", "ERC1967Proxy")
  ).toString();
  const _poolAddr = readFileSync(
    getDeploymentAddressPathWithTag("Pool", "ERC1967Proxy")
  ).toString();
  const _priorityRegistryAddr = readFileSync(
    getDeploymentAddressPathWithTag("PriorityRegistry", "ERC1967Proxy")
  ).toString();

  const Yamato = new Contract(_yamatoAddr, genABI("Yamato"), p);

  if (await Yamato.permitDeps(_yamatoAddr)) return;
  if (await Yamato.permitDeps(_yamatoDepositorAddr)) return;
  if (await Yamato.permitDeps(_yamatoBorrowerAddr)) return;
  if (await Yamato.permitDeps(_yamatoRepayerAddr)) return;
  if (await Yamato.permitDeps(_yamatoRedeemerAddr)) return;
  if (await Yamato.permitDeps(_yamatoSweeperAddr)) return;
  if (await Yamato.permitDeps(_poolAddr)) return;
  if (await Yamato.permitDeps(_priorityRegistryAddr)) return;

  await (
    await Yamato.connect(getFoundation()).setDeps(
      _yamatoDepositorAddr,
      _yamatoBorrowerAddr,
      _yamatoRepayerAddr,
      _yamatoWithdrawerAddr,
      _yamatoRedeemerAddr,
      _yamatoSweeperAddr,
      _poolAddr,
      _priorityRegistryAddr
    )
  ).wait();
  console.log(`log: Yamato.setDeps() executed.`);
};
export default func;
func.tags = [""];
