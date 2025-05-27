import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deploy, setNetwork, setProvider } from "../src/deployUtil";
import { getDeploymentAddressPath } from "../src/deployUtil";
import { readFileSync, existsSync } from "fs";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if (existsSync(getDeploymentAddressPath("veYMT"))) return;

  setNetwork(hre.network.name);
  const p = await setProvider();
  const { ethers, deployments } = hre;
  const { getContractFactory } = ethers;

  const ymtAddr = readFileSync(getDeploymentAddressPath("YMT")).toString();

  await deploy("veYMT", {
    args: [ymtAddr],
    getContractFactory,
    deployments,
  }).catch((e) => console.trace(e.message));
};
export default func;
func.tags = ["veYMT"];
