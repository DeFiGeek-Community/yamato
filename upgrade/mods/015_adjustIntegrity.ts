import {
  setNetwork,
  getDeploymentAddressPathWithTag,
  getFoundation,
  setProvider,
} from "../../src/deployUtil";

import { genABI } from "../../src/genABI";
import { readFileSync } from "fs";
import * as ethers from "ethers";

let YamatoERC1967Proxy = readFileSync(
  getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy")
).toString();

export default async function main() {
  let Yamato = new ethers.Contract(
    YamatoERC1967Proxy,
    genABI("Yamato"),
    getFoundation()
  );

  await (await Yamato.adjustIntegrity(18, 0)).wait();
}
