import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  setProvider,
  getDeploymentAddressPath,
  getDeploymentAddressPathWithTag,
  getFoundation,
  setNetwork,
} from "../src/deployUtil";
import { readFileSync } from "fs";
import { genABI } from "../src/genABI";
import { Contract } from "ethers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  setNetwork(hre.network.name);
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

  let flagCount = 0;
  if (!(await Yamato.permitDeps(_yamatoAddr))) flagCount++;
  if (!(await Yamato.permitDeps(_yamatoDepositorAddr))) flagCount++;
  if (!(await Yamato.permitDeps(_yamatoBorrowerAddr))) flagCount++;
  if (!(await Yamato.permitDeps(_yamatoRepayerAddr))) flagCount++;
  if (!(await Yamato.permitDeps(_yamatoRedeemerAddr))) flagCount++;
  if (!(await Yamato.permitDeps(_yamatoSweeperAddr))) flagCount++;
  if (!(await Yamato.permitDeps(_poolAddr))) flagCount++;
  if (!(await Yamato.permitDeps(_priorityRegistryAddr))) flagCount++;
  if (flagCount == 0) return;

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
func.tags = ["setDeps"];
