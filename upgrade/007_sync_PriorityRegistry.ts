import {
  getDeploymentAddressPathWithTag,
  getFoundation,
  setProvider,
} from "../src/deployUtil";
import { readFileSync } from "fs";
import { ethers } from "ethers";
import { genABI } from "../src/genABI";
import { PriorityRegistryV3 } from "../typechain";

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
  let PriorityRegistry: PriorityRegistryV3 = <PriorityRegistryV3>(
    new ethers.Contract(
      PriorityRegistryERC1967Proxy,
      genABI(NAME2 + "V3"),
      getFoundation()
    )
  );

  let filter = Yamato.filters.Deposited(null, null);
  let logs = await Yamato.queryFilter(filter);

  let pledgeOwners = logs
    .map((log) => log.args.sender)
    .filter((value, index, self) => self.indexOf(value) === index);
  let pledges = await Promise.all(
    pledgeOwners.map(async (owner) => await Yamato.getPledge(owner))
  );
  pledges = pledges.filter((p) => p.isCreated);

  console.log(pledges.length);

  // await PriorityRegistry.syncRankedQueue(pledges);
}

main().catch((e) => console.log(e));
