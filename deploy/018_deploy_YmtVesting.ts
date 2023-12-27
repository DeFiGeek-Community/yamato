import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deploy, setNetwork, setProvider } from "../src/deployUtil";
import { getDeploymentAddressPath } from "../src/deployUtil";
import { existsSync } from "fs";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if (existsSync(getDeploymentAddressPath("YmtVesting"))) return;

  setNetwork(hre.network.name);
  const p = await setProvider();
  const { ethers, deployments } = hre;
  const { getContractFactory } = ethers;

  await deploy("YmtVesting", {
    args: [],
    getContractFactory,
    deployments,
  }).catch((e) => console.trace(e.message));
};
export default func;
func.tags = ["YmtVesting"];