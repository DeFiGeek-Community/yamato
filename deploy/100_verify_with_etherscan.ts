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
  setNetwork,
  setProvider,
  isInitMode,
  isEmbeddedMode,
  backToInitMode,
  sleep,
  getDeploymentAddressPath,
  verifyWithEtherscan,
} from "../src/deployUtil";
import { Wallet } from "ethers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  await setProvider();
  setNetwork(hre.network.name);
  verifyWithEtherscan();
};
export default func;
func.tags = ["Verify"];
