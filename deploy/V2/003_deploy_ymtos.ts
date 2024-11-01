import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  deploy,
  setProvider,
  getDeploymentAddressPath,
  getDeploymentAddressPathWithTag,
  setNetwork,
} from "../../src/deployUtil";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { CurrencyOS, CurrencyOS__factory } from "../../typechain";
import { getProxy } from "../../src/testUtil";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  setNetwork(hre.network.name);
  const p = await setProvider();
  const { ethers, deployments } = hre;
  const { getContractFactory } = ethers;

  const currency = process.env.CURRENCY;

  // CURRENCYが設定されていない場合は終了
  if (!currency) {
    console.error("CURRENCY environment variable is not set.");
    return;
  }

  if (existsSync(getDeploymentAddressPathWithTag("YmtOS", "ERC1967Proxy")))
    return;

  const currencyosAddr = readFileSync(
    getDeploymentAddressPathWithTag("CurrencyOS", "ERC1967Proxy")
  ).toString();

  const inst = await getProxy<CurrencyOS, CurrencyOS__factory>("YmtOS", [
    currencyosAddr,
  ]);
  const implAddr = await inst.getImplementation();

  writeFileSync(
    getDeploymentAddressPathWithTag("YmtOS", "ERC1967Proxy"),
    inst.address
  );
  writeFileSync(getDeploymentAddressPathWithTag("YmtOS", "UUPSImpl"), implAddr);
};
export default func;
func.tags = ["YmtOS_V2"];
