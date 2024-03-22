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

  const _feePoolAddr = readFileSync(
    getDeploymentAddressPathWithTag("FeePool", "ERC1967Proxy")
  ).toString();

  const veYmtAddr = readFileSync(getDeploymentAddressPath("veYMT")).toString();

  const FeePool = new Contract(_feePoolAddr, genABI("FeePoolV2"), p);

  await (await FeePool.connect(getFoundation()).setVeYMT(veYmtAddr)).wait();
  console.log(`log: FeePool.setVeYMT() executed.`);
};
export default func;
func.tags = ["setVeYMT"];
