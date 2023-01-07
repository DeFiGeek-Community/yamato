import {
  getDeploymentAddressPathWithTag,
  getFoundation,
  setNetwork,
  setProvider,
} from "../../src/deployUtil";
import { readFileSync } from "fs";
import { BigNumber, ethers } from "ethers";
import { genABI } from "../../src/genABI";
import { PriorityRegistryV6 } from "../../typechain";
import { isCreate } from "hardhat/internal/hardhat-network/stack-traces/opcodes";

const NAME1 = "Yamato";
const NAME2 = "PriorityRegistry";
const NAME3 = "PriceFeed";
let YamatoERC1967Proxy = readFileSync(
  getDeploymentAddressPathWithTag(NAME1, "ERC1967Proxy")
).toString();
let PriorityRegistryERC1967Proxy = readFileSync(
  getDeploymentAddressPathWithTag(NAME2, "ERC1967Proxy")
).toString();
let PriceFeedERC1967Proxy = readFileSync(
  getDeploymentAddressPathWithTag(NAME3, "ERC1967Proxy")
).toString();

export default async function main() {
  setNetwork("goerli");
  await setProvider();
  let Yamato = new ethers.Contract(
    YamatoERC1967Proxy,
    genABI(NAME1 + "V3"),
    getFoundation()
  );
  let PriorityRegistry: PriorityRegistryV6 = <PriorityRegistryV6>(
    new ethers.Contract(
      PriorityRegistryERC1967Proxy,
      genABI(NAME2 + "V6"),
      getFoundation()
    )
  );
  let PriceFeed = new ethers.Contract(
    PriceFeedERC1967Proxy,
    genABI(NAME3 + "V2"),
    getFoundation()
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
  let price = await PriceFeed.getPrice();
  pledges = pledges.sort((a, b) => {
    return icr(a, price).gte(icr(b, price)) ? 1 : -1;
  });

  console.log(`pledges.length:${pledges.length}`);

  await (
    await PriorityRegistry.resetQueue(1, pledges, { gasLimit: 14000000 })
  ).wait();

  console.log(`r-cap-before:${await PriorityRegistry.getRedeemablesCap()}`);
  console.log(`s-cap-before:${await PriorityRegistry.getSweepablesCap()}`);
  console.log(`licr-before:${await PriorityRegistry.LICR()}`);

  // await (
  //   await PriorityRegistry.resetQueue(0, pledges, { gasLimit: 14000000 })
  // ).wait();
  // await (
  //   await PriorityRegistry.resetQueue(0, pledges, { gasLimit: 14000000 })
  // ).wait();
  await (
    await PriorityRegistry.syncRankedQueue(pledges, { gasLimit: 24000000 })
  ).wait();

  console.log(`r-cap-after:${await PriorityRegistry.getRedeemablesCap()}`);
  console.log(`s-cap-aftr:${await PriorityRegistry.getSweepablesCap()}`);
  console.log(`licr-after:${await PriorityRegistry.LICR()}`);
}

function icr(pledge, price) {
  if (pledge.debt.isZero()) {
    return BigNumber.from(2).pow(256);
  } else {
    return pledge.coll.mul(price).div(pledge.debt);
  }
}
