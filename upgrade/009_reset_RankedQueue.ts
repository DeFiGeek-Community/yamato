import {
  getDeploymentAddressPathWithTag,
  getFoundation,
  setProvider,
} from "../src/deployUtil";
import { readFileSync } from "fs";
import { ethers } from "ethers";
import { genABI } from "../src/genABI";
import { PriorityRegistryV5 } from "../typechain";

const NAME2 = "PriorityRegistry";
let PriorityRegistryERC1967Proxy = readFileSync(
  getDeploymentAddressPathWithTag(NAME2, "ERC1967Proxy")
).toString();

async function main() {
  await setProvider();
  let PriorityRegistry: PriorityRegistryV5 = <PriorityRegistryV5>(
    new ethers.Contract(
      PriorityRegistryERC1967Proxy,
      genABI(NAME2 + "V5"),
      getFoundation()
    )
  );

  console.log(`nextResetRank: ${await PriorityRegistry.nextResetRank()}`);

  await (await PriorityRegistry.resetQueue(0, { gasLimit: 14000000 })).wait();

  console.log(`nextResetRank: ${await PriorityRegistry.nextResetRank()}`);
}

main().catch((e) => console.log(e));
