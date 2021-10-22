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

  const FeePool = await deploy("FeePool", {
    args: [],
    getContractFactory,
    deployments,
  })
  if(typeof FeePool.upgradeTo !== 'function') throw new Error(`FeePool has to inherit UUPSUpgradeable to have upgradeTo().`);
  await FeePool.initialize()

};
export default func;
func.tags = ["FeePool"];
