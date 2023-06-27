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
  getDeploymentAddressPathWithTag,
  setNetwork,
} from "../src/deployUtil";
import { existsSync } from "fs";
import { Wallet } from "ethers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if (existsSync(getDeploymentAddressPathWithTag("ChainLinkMock", "EthUsd")))
    return;
  if (
    hre.network.name == "mainnet" ||
    hre.network.name == "goerli" ||
    hre.network.name == "sepolia"
  )
    return;
  setNetwork(hre.network.name);
  await setProvider();
  const { ethers, deployments } = hre;
  const { getContractFactory, Contract, BigNumber, Signer, getSigners } =
    ethers;

  const chainlinkEthUsd = await deploy("ChainLinkMock", {
    args: ["ETH/USD"],
    getContractFactory,
    deployments,
    tag: "EthUsd",
  }).catch((e) => console.trace(e.message));
};
export default func;
func.tags = ["ChainLinkMockEthUsd"];
