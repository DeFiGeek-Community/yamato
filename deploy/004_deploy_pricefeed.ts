import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { parseEther } from "ethers/lib/utils";
import { readFileSync } from "fs";
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
} from "@src/deployUtil";
import { genABI } from "@src/genABI";
import { Wallet, Contract } from "ethers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const p = await setProvider();
  const { ethers, deployments } = hre;
  const { getContractFactory, BigNumber, Signer, getSigners } = ethers;

  const ChainLinkEthUsd = readFileSync(
    getDeploymentAddressPath("ChainLinkMock", "EthUsd")
  ).toString();
  const ChainLinkJpyUsd = readFileSync(
    getDeploymentAddressPath("ChainLinkMock", "JpyUsd")
  ).toString();
  const TellorEthJpy = readFileSync(
    getDeploymentAddressPath("TellorCallerMock", "")
  ).toString();

  const chainlinkEthUsd = new Contract(
    ChainLinkEthUsd,
    genABI("ChainLinkMock"),
    p
  );
  const chainlinkJpyUsd = new Contract(
    ChainLinkJpyUsd,
    genABI("ChainLinkMock"),
    p
  );

  await (
    await chainlinkEthUsd.connect(getFoundation()).latestRoundData()
  ).wait();
  await (
    await chainlinkJpyUsd.connect(getFoundation()).latestRoundData()
  ).wait();

  const feed = await deploy("PriceFeed", {
    args: [ChainLinkEthUsd, ChainLinkJpyUsd, TellorEthJpy],
    getContractFactory,
    deployments,
  }).catch((e) => console.trace(e.message));
};
export default func;
func.tags = ["PriceFeed"];
