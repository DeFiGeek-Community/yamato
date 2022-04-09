import { assertDebtIntegrity } from "../../src/testUtil";
import {
  setNetwork,
  getDeploymentAddressPathWithTag,
  getFoundation,
  setProvider,
} from "../../src/deployUtil";
import { genABI } from "../../src/genABI";
import { readFileSync } from "fs";
import * as ethers from "ethers";

export default async function main() {
  setNetwork("rinkeby");
  await setProvider();

  let YamatoERC1967Proxy = readFileSync(
    getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy")
  ).toString();

  let CurrencyOSERC1967Proxy = readFileSync(
    getDeploymentAddressPathWithTag("CurrencyOS", "ERC1967Proxy")
  ).toString();

  let CurrencyOS = new ethers.Contract(
    CurrencyOSERC1967Proxy,
    genABI("CurrencyOS"),
    getFoundation()
  );

  let Yamato = new ethers.Contract(
    YamatoERC1967Proxy,
    genABI("Yamato"),
    getFoundation()
  );
  let CJPY = new ethers.Contract(
    await CurrencyOS.currency(),
    genABI("CJPY"),
    getFoundation()
  );

  await assertDebtIntegrity(Yamato, CJPY);
}