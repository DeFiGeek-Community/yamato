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
} from "@src/deployUtil";
import { Wallet } from "ethers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
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
