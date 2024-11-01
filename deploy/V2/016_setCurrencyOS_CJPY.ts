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

  const _currencyOSAddr = readFileSync(
    getDeploymentAddressPathWithTag("CurrencyOS", "ERC1967Proxy", currency)
  ).toString();
  const _currency = readFileSync(
    getDeploymentAddressPath(currency, currency)
  ).toString();
  const CURRRECY = new Contract(_currency, genABI(currency), p);

  console.log(`log: CJPY.setCurrencyOS() will be executed.`);
  await (
    await CURRRECY.connect(getFoundation()).setCurrencyOS(_currencyOSAddr, {
      gasLimit: 10000000,
    })
  ).wait();

  if (await existsSlot(p, CURRRECY.address, 1)) {
    console.log(`log: CURRRECY.setCurrencyOS() executed.`);
    await (await CURRRECY.connect(getFoundation()).revokeGovernance()).wait();
    console.log(`log: CURRRECY.revokeGovernance() executed.`);
  } else {
    console.log(`log: CURRRECY.setCurrencyOS() skipped.`);
  }
};
export default func;
func.tags = ["setCurrencyOS_CURRRECY_V2"];
