import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  deploy,
  getFoundation,
  setProvider,
  getDeploymentAddressPath,
  getDeploymentAddressPathWithTag,
  setNetwork,
} from "../src/deployUtil";
import { genABI } from "../src/genABI";
import { Contract } from "ethers";
import { PriceFeed, PriceFeed__factory } from "../typechain";
import { getProxy } from "../src/testUtil";
import { readFileSync, writeFileSync, existsSync } from "fs";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if (existsSync(getDeploymentAddressPathWithTag("PriceFeed", "ERC1967Proxy")))
    return;

  setNetwork(hre.network.name);
  const p = await setProvider();
  const { ethers, deployments } = hre;
  const { getContractFactory } = ethers;

  let ChainLinkEthUsd;
  let ChainLinkJpyUsd;

  if (hre.network.name == "mainnet") {
    ChainLinkEthUsd = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";
    ChainLinkJpyUsd = "0xBcE206caE7f0ec07b545EddE332A47C2F75bbeb3";
  } else if (hre.network.name == "goerli") {
    ChainLinkEthUsd = "0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e";
    ChainLinkJpyUsd = "0x982B232303af1EFfB49939b81AD6866B2E4eeD0B";
  } else if (hre.network.name == "sepolia") {
    ChainLinkEthUsd = "0x694AA1769357215DE4FAC081bf1f309aDC325306";
    ChainLinkJpyUsd = "0x8A6af2B75F23831ADc973ce6288e5329F63D86c6";
  } else if (hre.network.name == "localhost") {
    ChainLinkEthUsd = readFileSync(
      getDeploymentAddressPathWithTag("ChainLinkMock", "EthUsd")
    ).toString();
    ChainLinkJpyUsd = readFileSync(
      getDeploymentAddressPathWithTag("ChainLinkMock", "JpyUsd")
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
      await chainlinkEthUsd
        .connect(getFoundation())
        .simulatePriceMove({ gasLimit: 200000 })
    ).wait();
    await (
      await chainlinkJpyUsd
        .connect(getFoundation())
        .simulatePriceMove({ gasLimit: 200000 })
    ).wait();
    await (
      await chainlinkEthUsd
        .connect(getFoundation())
        .simulatePriceMove({ gasLimit: 200000 })
    ).wait();
    await (
      await chainlinkJpyUsd
        .connect(getFoundation())
        .simulatePriceMove({ gasLimit: 200000 })
    ).wait();
  }

  const inst = await getProxy<PriceFeed, PriceFeed__factory>(
    "PriceFeed",
    [ChainLinkEthUsd, ChainLinkJpyUsd],
    3
  );
  const implAddr = await inst.getImplementation();

  console.log(
    `PriceFeed is deployed as ${
      inst.address
    } with impl(${implAddr}) by ${await inst.signer.getAddress()} on ${
      (await inst.provider.getNetwork()).name
    } at ${await inst.provider.getBlockNumber()}`
  );

  writeFileSync(
    getDeploymentAddressPathWithTag("PriceFeed", "ERC1967Proxy"),
    inst.address
  );
  writeFileSync(
    getDeploymentAddressPathWithTag("PriceFeed", "UUPSImpl"),
    implAddr
  );
};
export default func;
func.tags = ["PriceFeed"];
