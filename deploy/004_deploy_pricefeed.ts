import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { readFileSync } from "fs";
import {
  deploy,
  getFoundation,
  setProvider,
  getDeploymentAddressPath,
  getDeploymentAddressPathWithTag,
} from "../src/deployUtil";
import { genABI } from "../src/genABI";
import { Contract } from "ethers";
import { PriceFeed, PriceFeed__factory } from "../typechain";
import { getProxy } from "../src/testUtil";
import { writeFileSync } from "fs";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const p = await setProvider();
  const { ethers, deployments } = hre;
  const { getContractFactory } = ethers;

  const ChainLinkEthUsd = readFileSync(
    getDeploymentAddressPathWithTag("ChainLinkMock", "EthUsd")
  ).toString();
  const ChainLinkJpyUsd = readFileSync(
    getDeploymentAddressPathWithTag("ChainLinkMock", "JpyUsd")
  ).toString();
  const TellorEthJpy = readFileSync(
    getDeploymentAddressPath("TellorCallerMock")
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

  const inst = await await getProxy<PriceFeed, PriceFeed__factory>(
    "PriceFeed",
    [ChainLinkEthUsd, ChainLinkJpyUsd, TellorEthJpy]
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
