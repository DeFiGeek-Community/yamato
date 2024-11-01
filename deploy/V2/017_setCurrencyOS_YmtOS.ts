import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  setProvider,
  getDeploymentAddressPath,
  getFoundation,
  getDeploymentAddressPathWithTag,
  existsSlot,
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

  const _YmtOSAddr = readFileSync(
    getDeploymentAddressPathWithTag("YmtOS", "ERC1967Proxy")
  ).toString();
  const YmtOS = new Contract(_YmtOSAddr, genABI("YmtOS"), p);

  const _currencyOSAddr = readFileSync(
    getDeploymentAddressPathWithTag("CurrencyOS", "ERC1967Proxy", currency)
  ).toString();

  if (await YmtOS.exists(_currencyOSAddr)) {
    console.log(`log: YmtOS.addCurrencyOS() skipped.`);
    return;
  }

  await (
    await YmtOS.connect(getFoundation()).addCurrencyOS(_currencyOSAddr, {
      gasLimit: 2000000,
    })
  ).wait();

  console.log(`log: YmtOS.addCurrencyOS() executed.`);
};
export default func;
func.tags = ["addCurrencyOS_YmtOS_V2"];
