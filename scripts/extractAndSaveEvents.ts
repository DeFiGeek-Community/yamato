import { readFileSync, writeFileSync } from "fs";

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
// console.log(events);
const extractedEvents = Object.values(events).reduce((acc, eventArray) => {
  eventArray.forEach((event) => {
    const address = event.args[0];
    if (!acc[address]) {
      acc[address] = [];
    }
    const eventName = event.event;
    if (
      eventName === "Deposited" ||
      eventName === "Borrowed" ||
      eventName === "Repaid" ||
      eventName === "Withdrawn"
    ) {
      acc[address].push({
        blockNumber: event.blockNumber,
        event: event.event,
        args: BigInt(event.args[1].hex).toString(),
      });
    }
  });
  return acc;
}, {});

try {
  const jsonContent = JSON.stringify(extractedEvents, null, 2);
  writeFileSync("./scripts/events/extractedEvents.json", jsonContent, "utf-8");
  console.log("結果がjsonファイルに保存されました。");
} catch (error) {
  console.error("ファイルの保存中にエラーが発生しました:", error);
}
