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

  const currencyAddr = readFileSync(
    getDeploymentAddressPath(currency, currency)
  ).toString();
  const feePoolAddr = readFileSync(
    getDeploymentAddressPath("FeePoolERC1967Proxy")
  ).toString();
  const feedAddr = readFileSync(
    getDeploymentAddressPathWithTag(
      currency === "CUSD" ? "PriceFeedSingle" : "PriceFeed",
      "ERC1967Proxy",
      currency
    )
  ).toString();

  const inst = await getProxy<CurrencyOS, CurrencyOS__factory>(
    "CurrencyOS",
    [currencyAddr, feedAddr, feePoolAddr],
    4
  );
  const implAddr = await inst.getImplementation();

  writeFileSync(
    getDeploymentAddressPathWithTag("CurrencyOS", "ERC1967Proxy", currency),
    inst.address
  );
  writeFileSync(
    getDeploymentAddressPathWithTag("CurrencyOS", "UUPSImpl", currency),
    implAddr
  );
};
export default func;
func.tags = ["CurrencyOS_V2"];
