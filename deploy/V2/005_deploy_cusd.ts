import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  deploy,
  setNetwork,
  setProvider,
  getDeploymentAddressPath,
} from "../../src/deployUtil";
import { existsSync } from "fs";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const currency = process.env.CURRENCY;

  // CURRENCYが設定されていない場合は終了
  if (!currency) {
    console.error("CURRENCY environment variable is not set.");
    return;
  }

  if (existsSync(getDeploymentAddressPath(currency, currency))) return;

  setNetwork(hre.network.name);
  const p = await setProvider();
  const { ethers, deployments } = hre;
  const { getContractFactory } = ethers;

  await deploy(
    currency,
    {
      args: [],
      getContractFactory,
      deployments,
    },
    currency
  ).catch((e) => console.trace(e.message));
};
export default func;
func.tags = ["CURRENCY_V2"];
