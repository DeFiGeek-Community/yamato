import {
  getDeploymentAddressPathWithTag,
  getFoundation,
  setProvider,
} from "../src/deployUtil";
import { readFileSync } from "fs";
import { ethers } from "ethers";
import { genABI } from "../src/genABI";

const NAME1 = "Yamato";
const NAME2 = "PriorityRegistry";
let YamatoERC1967Proxy = readFileSync(
  getDeploymentAddressPathWithTag(NAME1, "ERC1967Proxy")
).toString();
let PriorityRegistryERC1967Proxy = readFileSync(
  getDeploymentAddressPathWithTag(NAME2, "ERC1967Proxy")
).toString();

async function main() {
    await setProvider();
  let Yamato = new ethers.Contract(
    YamatoERC1967Proxy,
    genABI(NAME1),
    getFoundation()
  );
  let PriorityRegistry = new ethers.Contract(
    PriorityRegistryERC1967Proxy,
    genABI(NAME2),
    getFoundation()
  );

//   await (await Yamato.pause()).wait();

  let filter = Yamato.filters.Deposited(null, null)
  let logs = await Yamato.queryFilter(filter);

  let pledges = await Promise.all(logs.map(async (log) => {
    return await Yamato.getPledge(log.args.sender);
  }))
  console.log(pledges);

//   await PriorityRegistry.syncRankedQueue(pledges);

//   await (await Yamato.unpause()).wait();
}

main().catch((e) => console.log(e));
