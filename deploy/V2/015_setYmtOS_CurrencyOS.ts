import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  setProvider,
  getDeploymentAddressPath,
  getDeploymentAddressPathWithTag,
  getFoundation,
  setNetwork,
} from "../../src/deployUtil";
import { readFileSync } from "fs";
import { genABI } from "../../src/genABI";
import { Contract } from "ethers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  setNetwork(hre.network.name);
  const p = await setProvider();

  const currency = process.env.CURRENCY;

  // CURRENCYが設定されていない場合は終了
  if (!currency) {
    console.error("CURRENCY environment variable is not set.");
    return;
  }

  const _currencyOSAddr = readFileSync(
    getDeploymentAddressPathWithTag("CurrencyOS", "ERC1967Proxy", currency)
  ).toString();
  const CurrencyOS = new Contract(_currencyOSAddr, genABI("CurrencyOS"), p);

  const _ymtosAddr = readFileSync(
    getDeploymentAddressPathWithTag("YmtOS", "ERC1967Proxy")
  ).toString();

  if (await CurrencyOS.exists(_ymtosAddr)) {
    console.log(`log: CurrencyOS.setYmtOS() skipped.`);
    return;
  }
  await (
    await CurrencyOS.connect(getFoundation()).setYmtOS(_ymtosAddr, {
      gasLimit: 2000000,
    })
  ).wait();

  console.log(`log: CurrencyOS.setYmtOS() executed.`);
};
export default func;
func.tags = ["setYmtOS_V2"];
