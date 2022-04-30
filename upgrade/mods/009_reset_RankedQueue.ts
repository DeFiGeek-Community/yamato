import {
  getDeploymentAddressPathWithTag,
  getFoundation,
  setProvider,
} from "../../src/deployUtil";
import { readFileSync } from "fs";
import { ethers } from "ethers";
import { genABI } from "../../src/genABI";
import { PriorityRegistryV6 } from "../../typechain";

const NAME2 = "PriorityRegistry";
let PriorityRegistryERC1967Proxy = readFileSync(
  getDeploymentAddressPathWithTag(NAME2, "ERC1967Proxy")
).toString();

export default async function main() {
  await setProvider();
  let PriorityRegistry: PriorityRegistryV6 = <PriorityRegistryV6>(
    new ethers.Contract(
      PriorityRegistryERC1967Proxy,
      genABI(NAME2 + "V6"),
      getFoundation()
    )
  );

  console.log(
    `nextResetRank[before]: ${await PriorityRegistry.nextResetRank()}`
  );
  console.log(
    `getRedeemablesCap[before]: ${await PriorityRegistry.getRedeemablesCap()}`
  );

  await (await PriorityRegistry.resetQueue(1, { gasLimit: 14000000 })).wait(); // Given 0, 300 additive deletions. Given 1, 300 deletions from rank=1.

  console.log(
    `nextResetRank[after]: ${await PriorityRegistry.nextResetRank()}`
  );
  console.log(
    `getRedeemablesCap[after]: ${await PriorityRegistry.getRedeemablesCap()}`
  );
}
