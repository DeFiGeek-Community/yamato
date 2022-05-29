import {
  setNetwork,
  getDeploymentAddressPathWithTag,
  getFoundation,
  setProvider,
} from "../../src/deployUtil";

import { getPledges } from "../../src/testUtil";

import { genABI } from "../../src/genABI";
import { readFileSync } from "fs";
import * as ethers from "ethers";
const { BigNumber } = ethers;

let YamatoERC1967Proxy = readFileSync(
  getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy")
).toString();

let PoolERC1967Proxy = readFileSync(
  getDeploymentAddressPathWithTag("Pool", "ERC1967Proxy")
).toString();

export default async function main() {
  let Yamato = new ethers.Contract(
    YamatoERC1967Proxy,
    genABI("Yamato"),
    getFoundation()
  );
  let Pool = new ethers.Contract(
    PoolERC1967Proxy,
    genABI("Pool"),
    getFoundation()
  );

  let pledges: any = await getPledges(Yamato);
  let acmTotalColl = BigNumber.from(0);
  for (var i = 0; i < pledges.length; i++) {
    acmTotalColl = acmTotalColl.add(pledges[i].coll);
  }

  await Pool.refreshColl(acmTotalColl);
}
