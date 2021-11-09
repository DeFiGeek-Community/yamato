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

  const _yamatoHelperAddr = readFileSync(
    getDeploymentAddressPathWithTag("YamatoHelper", "ERC1967Proxy")
  ).toString();
  const YamatoHelper = new Contract(
    _yamatoHelperAddr,
    genABI("YamatoHelper"),
    p
  );

  const _poolAddr = readFileSync(getDeploymentAddressPath("Pool")).toString();
  let _priorityRegistryAddr = readFileSync(
    getDeploymentAddressPathWithTag("PriorityRegistry", "ERC1967Proxy")
  ).toString();
  await (await YamatoHelper.connect(getFoundation()).setPool(_poolAddr)).wait();
  console.log(`log: YamatoHelper.setPool() executed.`);
  await (
    await YamatoHelper.connect(getFoundation()).setPriorityRegistry(
      _priorityRegistryAddr
    )
  ).wait();
  console.log(`log: YamatoHelper.setPriorityRegistry() executed.`);
};
export default func;
func.tags = [""];
