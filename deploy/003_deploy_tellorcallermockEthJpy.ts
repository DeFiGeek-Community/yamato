import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { parseEther } from "ethers/lib/utils";
import {
  deploy,
  goToEmbededMode,
  hardcodeFactoryAddress,
  singletonProvider,
  getFoundation,
  getDeployer,
  extractEmbeddedFactoryAddress,
  recoverFactoryAddress,
  setProvider,
  isInitMode,
  isEmbeddedMode,
  backToInitMode,
  sleep,
  getDeploymentAddressPath,
  setNetwork,
} from "../src/deployUtil";
import { existsSync } from "fs";
import { Wallet } from "ethers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  return;
  if (existsSync(getDeploymentAddressPath("TellorCallerMock"))) return;
  if (hre.network.name == "mainnet") return;

  setNetwork(hre.network.name);
  await setProvider();
  const { ethers, deployments } = hre;
  const { getContractFactory, Contract, BigNumber, Signer, getSigners } =
    ethers;

  const tellor = await deploy("TellorCallerMock", {
    args: [],
    getContractFactory,
    deployments,
  }).catch((e) => console.trace(e.message));
};
export default func;
func.tags = ["TellorCallerMock"];
