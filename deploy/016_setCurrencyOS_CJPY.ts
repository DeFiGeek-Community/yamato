import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  setProvider,
  getDeploymentAddressPath,
  getFoundation,
  getDeploymentAddressPathWithTag,
} from "../src/deployUtil";
import { readFileSync } from "fs";
import { genABI } from "../src/genABI";
import { Contract } from "ethers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const p = await setProvider();

  const _currencyOSAddr = readFileSync(
    getDeploymentAddressPathWithTag("CurrencyOS", "ERC1967Proxy")
  ).toString();
  const _CJPY = readFileSync(getDeploymentAddressPath("CJPY")).toString();
  const CJPY = new Contract(_CJPY, genABI("CJPY"), p);

  console.log(`log: CJPY.setCurrencyOS() will be executed.`);
  await (
    await CJPY.connect(getFoundation()).setCurrencyOS(_currencyOSAddr, {
      gasLimit: 10000000,
    })
  ).wait();
  console.log(`log: CJPY.setCurrencyOS() executed.`);
  await (await CJPY.connect(getFoundation()).revokeGovernance()).wait();
  console.log(`log: CJPY.revokeGovernance() executed.`);
};
export default func;
func.tags = [""];