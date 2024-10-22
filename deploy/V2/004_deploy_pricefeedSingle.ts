import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  deploy,
  getFoundation,
  setProvider,
  getDeploymentAddressPath,
  getDeploymentAddressPathWithTag,
  setNetwork,
} from "../../src/deployUtil";
import { genABI } from "../../src/genABI";
import { Contract } from "ethers";
import { PriceFeedSingle, PriceFeedSingle__factory } from "../../typechain";
import { getProxy } from "../../src/testUtil";
import { readFileSync, writeFileSync, existsSync } from "fs";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const currency = process.env.CURRENCY;

  // CURRENCYが設定されていない場合は終了
  if (!currency) {
    console.error("CURRENCY environment variable is not set.");
    return;
  }

  if (
    existsSync(
      getDeploymentAddressPathWithTag(
        "PriceFeedSingle",
        "ERC1967Proxy",
        currency
      )
    )
  )
    return;

  setNetwork(hre.network.name);
  const p = await setProvider();
  const { ethers, deployments } = hre;
  const { getContractFactory } = ethers;

  let ChainLinkEthUsd;

  if (hre.network.name == "mainnet") {
    ChainLinkEthUsd = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";
  } else if (hre.network.name == "goerli") {
    ChainLinkEthUsd = "0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e";
  } else if (hre.network.name == "sepolia") {
    ChainLinkEthUsd = "0x694AA1769357215DE4FAC081bf1f309aDC325306";
  } else if (hre.network.name == "localhost") {
    ChainLinkEthUsd = readFileSync(
      getDeploymentAddressPathWithTag("ChainLinkMock", "EthUsd")
    ).toString();
  }

  const inst = await getProxy<PriceFeedSingle, PriceFeedSingle__factory>(
    "PriceFeedSingle",
    [ChainLinkEthUsd]
  );
  const implAddr = await inst.getImplementation();

  console.log(
    `PriceFeedSingle is deployed as ${
      inst.address
    } with impl(${implAddr}) by ${await inst.signer.getAddress()} on ${
      (await inst.provider.getNetwork()).name
    } at ${await inst.provider.getBlockNumber()}`
  );

  writeFileSync(
    getDeploymentAddressPathWithTag(
      "PriceFeedSingle",
      "ERC1967Proxy",
      currency
    ),
    inst.address
  );
  writeFileSync(
    getDeploymentAddressPathWithTag("PriceFeedSingle", "UUPSImpl", currency),
    implAddr
  );
};
export default func;
func.tags = ["PriceFeedSingle_V2"];
