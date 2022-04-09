import {
  getDeploymentAddressPathWithTag,
  getFoundation,
  setProvider,
} from "../../src/deployUtil";

import { readFileSync } from "fs";
import { ethers } from "ethers";
import { genABI } from "../../src/genABI";

const NAME1 = "Yamato";
let YamatoERC1967Proxy = readFileSync(
  getDeploymentAddressPathWithTag(NAME1, "ERC1967Proxy")
).toString();

export default async function main() {
  await setProvider();
  let Yamato = new ethers.Contract(
    YamatoERC1967Proxy,
    genABI(NAME1),
    getFoundation()
  );

  console.log(`paused: ${await Yamato.paused()}`);
  await (await Yamato.toggle()).wait();
  console.log(`paused: ${await Yamato.paused()}`);
}
