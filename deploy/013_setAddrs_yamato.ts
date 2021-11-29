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
  const _yamatoHelperAddr = readFileSync(
    getDeploymentAddressPathWithTag("YamatoHelper", "ERC1967Proxy")
  ).toString();
  const Yamato = new Contract(_yamatoAddr, genABI("Yamato"), p);

  await (
    await Yamato.connect(getFoundation()).setYamatoHelper(_yamatoHelperAddr)
  ).wait();
  console.log(`log: Yamato.setYamatoHelper() executed.`);

  const _poolAddr = readFileSync(getDeploymentAddressPath("Pool")).toString();
  let _priorityRegistryAddr = readFileSync(
    getDeploymentAddressPathWithTag("PriorityRegistry", "ERC1967Proxy")
  ).toString();
  await (await Yamato.connect(getFoundation()).setPool(_poolAddr)).wait();
  console.log(`log: Yamato.setPool() executed.`);

  await (
    await Yamato.connect(getFoundation()).setPriorityRegistry(
      _priorityRegistryAddr
    )
  ).wait();
  console.log(`log: Yamato.setPriorityRegistry() executed.`);
};
export default func;
func.tags = [""];
