import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  setProvider,
  getDeploymentAddressPathWithTag,
  setNetwork,
} from "../src/deployUtil";
import { readFileSync } from "fs";
import { genABI } from "../src/genABI";
import { Contract } from "ethers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  setNetwork(hre.network.name);
  const p = await setProvider();

  const _currencyOSAddr = readFileSync(
    getDeploymentAddressPathWithTag("CurrencyOS", "ERC1967Proxy")
  ).toString();
  const CurrencyOS = new Contract(_currencyOSAddr, genABI("CurrencyOS"), p);

  // const _ymtOSProxyAddr = readFileSync(getDeploymentAddressPath('YmtOSProxy')).toString()
  // const _ymtAddr = readFileSync(getDeploymentAddressPath('YMT')).toString()
  // const _veymtAddr = readFileSync(getDeploymentAddressPath('veYMT')).toString()
  // await ( await CurrencyOS.setYmtOSProxy(_ymtOSProxyAddr) ).wait();
  // await ( await CurrencyOS.setGovernanceTokens(_ymtAddr, _veymtAddr) ).wait();

  // console.log(`log: CurrencyOS.setYmtOSProxy() executed.`);
  // console.log(`log: CurrencyOS.setGovernanceTokens() executed.`);
};
export default func;
func.tags = [""];
