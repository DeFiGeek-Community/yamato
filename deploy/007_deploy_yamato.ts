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

  const _cjpyosAddr = readFileSync(
    getDeploymentAddressPath("CjpyOS")
  ).toString();

  await deploy("PledgeLib", {
    args: [],
    getContractFactory,
    deployments,
    isDependency: true,
  }).catch((e) => console.trace(e.message));

  const PledgeLib = readFileSync(
    getDeploymentAddressPath("PledgeLib")
  ).toString();
  console.log(`PledgeLib: ${PledgeLib}`);

  await deploy("Yamato", {
    args: [_cjpyosAddr],
    getContractFactory,
    deployments,
    libraries: { PledgeLib },
  }).catch((e) => console.trace(e.message));
};
export default func;
func.tags = ["Yamato"];
