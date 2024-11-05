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
import { PriceFeed, PriceFeed__factory } from "../../typechain";
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
        "PriceFeed",
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
  let ChainLinkEurUsd;

  if (hre.network.name == "mainnet") {
    ChainLinkEthUsd = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";
    ChainLinkEurUsd = "0xb49f677943BC038e9857d61E7d053CaA2C1734C1";
  } else if (hre.network.name == "sepolia") {
    ChainLinkEthUsd = "0x694AA1769357215DE4FAC081bf1f309aDC325306";
    ChainLinkEurUsd = "0x1a81afB8146aeFfCFc5E50e8479e826E7D55b910";
  } else if (hre.network.name == "localhost") {
    ChainLinkEthUsd = readFileSync(
      getDeploymentAddressPathWithTag("ChainLinkMock", "EthUsd")
    ).toString();
    ChainLinkEurUsd = readFileSync(
      getDeploymentAddressPathWithTag("ChainLinkMock", "EurUsd")
    ).toString();
  }

  const inst = await getProxy<PriceFeed, PriceFeed__factory>(
    "PriceFeed",
    [ChainLinkEthUsd, ChainLinkEurUsd],
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
    getDeploymentAddressPathWithTag(
      "PriceFeed",
      "ERC1967Proxy",
      currency
    ),
    inst.address
  );
  writeFileSync(
    getDeploymentAddressPathWithTag("PriceFeed", "UUPSImpl", currency),
    implAddr
  );
};
export default func;
func.tags = ["PriceFeed_EUR_V2"];
