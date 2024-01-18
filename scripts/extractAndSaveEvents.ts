import { readFileSync, writeFileSync } from "fs";
import { BigNumber, providers, Contract } from "ethers";
import { YamatoV4__factory } from "../typechain/factories/contracts/YamatoV4__factory";

const lastBlockNumber = 19030664;

async function getPledgeOutput(address: string, blockNumber: number) {
  const network = "mainnet";
  const YamatoERC1967ProxyAddress = readFileSync(
    `deployments/${network}/YamatoERC1967Proxy`
  ).toString();

  if (!process.env.INFURA_URL) {
    console.error("INFURA_URLが設定されていません。");
    return;
  }

  const provider = new providers.JsonRpcProvider(
    process.env.INFURA_URL,
    network
  );
  const abi = YamatoV4__factory.abi;
  const Yamato = new Contract(YamatoERC1967ProxyAddress, abi, provider);

  try {
    const p = await Yamato.getPledge(address, { blockTag: blockNumber });
    return p;
  } catch (error) {
    console.error("エラーが発生しました:", error);
  }
}

interface EventData {
  depositedEvents: any[];
  borrowedEvents: any[];
  repaidEvents: any[];
  withdrawnEvents: any[];
  redeemedEvents: any[];
  redeemedMetaEvents: any[];
  sweptEvents: any[];
}

function readEventJsonFiles(): EventData {
  const events: EventData = {
    depositedEvents: JSON.parse(
      readFileSync(`./scripts/events/deposited.json`, "utf-8")
    ),
    borrowedEvents: JSON.parse(
      readFileSync(`./scripts/events/borrowed.json`, "utf-8")
    ),
    repaidEvents: JSON.parse(
      readFileSync(`./scripts/events/repaid.json`, "utf-8")
    ),
    withdrawnEvents: JSON.parse(
      readFileSync(`./scripts/events/withdrawn.json`, "utf-8")
    ),
    redeemedEvents: JSON.parse(
      readFileSync(`./scripts/events/redeemed.json`, "utf-8")
    ),
    redeemedMetaEvents: JSON.parse(
      readFileSync(`./scripts/events/redeemedMeta.json`, "utf-8")
    ),
    sweptEvents: JSON.parse(
      readFileSync(`./scripts/events/swept.json`, "utf-8")
    ),
  };

  return events;
}

const events = readEventJsonFiles();

const extractedEvents = Object.values(events).reduce(
  async (accPromise, eventArray) => {
    const acc = await accPromise;
    for (const event of eventArray) {
      const eventName = event.event;
      if (
        eventName === "Deposited" ||
        eventName === "Borrowed" ||
        eventName === "Repaid" ||
        eventName === "Withdrawn"
      ) {
        const address = event.args[0];
        if (!acc[address]) {
          acc[address] = [];
        }
        acc[address].push({
          blockNumber: event.blockNumber,
          event: event.event,
          args: BigNumber.from(event.args[1]),
        });
      } else if (eventName === "Redeemed") {
        const nonZeroAddresses = event.args[3].filter(
          (address) => address !== "0x0000000000000000000000000000000000000000"
        );
        for (const address of nonZeroAddresses) {
          if (!acc[address]) {
            acc[address] = [];
          }
          const pledge = await getPledgeOutput(address, event.blockNumber);
          acc[address].push({
            blockNumber: event.blockNumber,
            event: event.event,
            coll: BigNumber.from(pledge.coll),
            debt: BigNumber.from(pledge.debt),
          });
        }
      }
    }
    return acc;
  },
  Promise.resolve({})
);

extractedEvents.then((events) => {
  Object.keys(events).forEach((address) => {
    events[address].sort((a, b) => a.blockNumber - b.blockNumber);
  });

  Object.keys(events).forEach((address) => {
    events[address].push({
      blockNumber: lastBlockNumber,
      event: "end",
      args: 0,
    });
  });

  try {
    const jsonContent = JSON.stringify(events, null, 2);
    writeFileSync(
      "./scripts/events/extractedEvents.json",
      jsonContent,
      "utf-8"
    );
    console.log("結果がjsonファイルに保存されました。");
  } catch (error) {
    console.error("ファイルの保存中にエラーが発生しました:", error);
  }
});
