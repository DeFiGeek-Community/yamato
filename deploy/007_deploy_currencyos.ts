import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  deploy,
  setProvider,
  getDeploymentAddressPath,
  getDeploymentAddressPathWithTag,
  setNetwork,
} from "../src/deployUtil";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { CurrencyOS, CurrencyOS__factory } from "../typechain";
import { getProxy } from "../src/testUtil";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if (existsSync(getDeploymentAddressPathWithTag("CurrencyOS", "ERC1967Proxy")))
    return;

  setNetwork(hre.network.name);
  const p = await setProvider();
  const { ethers, deployments } = hre;
  const { getContractFactory } = ethers;

  const cjpyAddr = readFileSync(getDeploymentAddressPath("CJPY")).toString();
  const feePoolAddr = readFileSync(
    getDeploymentAddressPath("FeePoolERC1967Proxy")
  ).toString();
  const feedAddr = readFileSync(
    getDeploymentAddressPath("PriceFeedERC1967Proxy")
  ).toString();

  const inst = await getProxy<CurrencyOS, CurrencyOS__factory>("CurrencyOS", [
    cjpyAddr,
    feedAddr,
    feePoolAddr,
  ]);
  const implAddr = await inst.getImplementation();

  writeFileSync(
    getDeploymentAddressPathWithTag("CurrencyOS", "ERC1967Proxy"),
    inst.address
  );
  writeFileSync(
    getDeploymentAddressPathWithTag("CurrencyOS", "UUPSImpl"),
    implAddr
  );
};
export default func;
func.tags = ["CurrencyOS"];
