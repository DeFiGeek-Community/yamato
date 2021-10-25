import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  deploy,
  setProvider,
  getDeploymentAddressPath,
} from "../src/deployUtil";
import { readFileSync } from "fs";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const p = await setProvider();
  const { ethers, deployments } = hre;
  const { getContractFactory } = ethers;

  const cjpyAddr = readFileSync(getDeploymentAddressPath("CJPY")).toString();
  const feePoolAddr = readFileSync(
    getDeploymentAddressPath("FeePoolERC1967Proxy")
  ).toString();
  const feedAddr = readFileSync(
    getDeploymentAddressPath("PriceFeedERC1967Proxy")
  ).toString();

  await deploy("CjpyOS", {
    args: [cjpyAddr, feedAddr, feePoolAddr],
    getContractFactory,
    deployments,
  }).catch((e) => console.trace(e.message));
};
export default func;
func.tags = ["CjpyOS"];
