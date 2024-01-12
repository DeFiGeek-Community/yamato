import { existsSync, readFileSync, writeFileSync } from "fs";
import { getDeploymentAddressPathWithTag } from "../src/deployUtil";
import { ethers } from "hardhat";
import { YamatoV4__factory } from "../typechain/factories/contracts/YamatoV4__factory";

const network = "mainnet";
const YamatoERC1967ProxyAddress = readFileSync(
  `deployments/${network}/YamatoERC1967Proxy`
).toString();
console.log(`YamatoERC1967Proxyのアドレス: ${YamatoERC1967ProxyAddress}`);

async function fetchEvents() {
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.ALCHEMY_URL as string,
    network as string
  );
  const abi = YamatoV4__factory.abi;
  const Yamato = new ethers.Contract(YamatoERC1967ProxyAddress, abi, provider);

  const depositedFilter = Yamato.filters.Deposited();
  const borrowedFilter = Yamato.filters.Borrowed();
  const repaidFilter = Yamato.filters.Repaid();
  const withdrawnFilter = Yamato.filters.Withdrawn();
  const redeemedFilter = Yamato.filters.Redeemed();
  const redeemedMetaFilter = Yamato.filters.RedeemedMeta();
  const sweptFilter = Yamato.filters.Swept();

  const depositedEvents = await Yamato.queryFilter(depositedFilter);
  const borrowedEvents = await Yamato.queryFilter(borrowedFilter);
  const repaidEvents = await Yamato.queryFilter(repaidFilter);
  const withdrawnEvents = await Yamato.queryFilter(withdrawnFilter);
  const redeemedEvents = await Yamato.queryFilter(redeemedFilter);
  const redeemedMetaEvents = await Yamato.queryFilter(redeemedMetaFilter);
  const sweptEvents = await Yamato.queryFilter(sweptFilter);

  writeFileSync(
    `./scripts/events/deposited.json`,
    JSON.stringify(depositedEvents, null, 2)
  );
  writeFileSync(
    `./scripts/events/borrowed.json`,
    JSON.stringify(borrowedEvents, null, 2)
  );
  writeFileSync(
    `./scripts/events/repaid.json`,
    JSON.stringify(repaidEvents, null, 2)
  );
  writeFileSync(
    `./scripts/events/withdrawn.json`,
    JSON.stringify(withdrawnEvents, null, 2)
  );
  writeFileSync(
    `./scripts/events/redeemed.json`,
    JSON.stringify(redeemedEvents, null, 2)
  );
  writeFileSync(
    `./scripts/events/redeemedMeta.json`,
    JSON.stringify(redeemedMetaEvents, null, 2)
  );
  writeFileSync(
    `./scripts/events/swept.json`,
    JSON.stringify(sweptEvents, null, 2)
  );

  return {
    depositedEvents,
    borrowedEvents,
    repaidEvents,
    withdrawnEvents,
    redeemedEvents,
    redeemedMetaEvents,
    sweptEvents,
  };
}

fetchEvents()
  .then((events) => {
    console.log("Depositedイベント:", events.depositedEvents.length);
    console.log("Borrowedイベント:", events.borrowedEvents.length);
    console.log("Repaidイベント:", events.repaidEvents.length);
    console.log("Withdrawnイベント:", events.withdrawnEvents.length);
    console.log("Redeemedイベント:", events.redeemedEvents.length);
    console.log("RedeemedMetaイベント:", events.redeemedMetaEvents.length);
    console.log("Sweptイベント:", events.sweptEvents.length);
  })
  .catch((error) => {
    console.error(`イベントの取得中にエラーが発生しました: ${error.message}`);
  });
