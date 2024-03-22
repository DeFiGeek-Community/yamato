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
import { Contract, utils } from "ethers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  setNetwork(hre.network.name);
  const p = await setProvider();
  const { ethers, deployments } = hre;
  const { getContractFactory } = ethers;

  const _controllerAddr = readFileSync(
    getDeploymentAddressPathWithTag("ScoreWeightController", "ERC1967Proxy")
  ).toString();

  const _ScoreRegistry = readFileSync(
    getDeploymentAddressPathWithTag("ScoreRegistry", "ERC1967Proxy")
  ).toString();

  const ScoreWeightController = new Contract(
    _controllerAddr,
    genABI("ScoreWeightController"),
    p
  );

  await (
    await ScoreWeightController.connect(getFoundation()).addCurrency(
      _ScoreRegistry,
      utils.parseEther("1")
    )
  ).wait();
  console.log(`log: ScoreWeightController.addCurrency() executed.`);
};
export default func;
func.tags = ["addCurrency"];
