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

  const _scoreRegistryAddr = readFileSync(
    getDeploymentAddressPathWithTag("ScoreRegistry", "ERC1967Proxy")
  ).toString();

  const Yamato = new Contract(_yamatoAddr, genABI("YamatoV4"), p);

  await (
    await Yamato.connect(getFoundation()).setScoreRegistry(_scoreRegistryAddr)
  ).wait();
  console.log(`log: Yamato.setScoreRegistry() executed.`);
};
export default func;
func.tags = ["setScoreRegistry"];
