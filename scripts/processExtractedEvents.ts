import { BigNumber } from "ethers";
import { readFileSync, writeFileSync } from "fs";

export function processExtractedEvents() {
  const extractedEventsJson = readFileSync(
    "./scripts/events/extractedEvents.json",
    "utf8"
  );
  const extractedEvents = JSON.parse(extractedEventsJson);

  const blockNumber: number[] = [];

  for (const address in extractedEvents) {
    extractedEvents[address].forEach((event, index) => {
      if (index === 0) {
        event.coll = "0";
        event.debt = "0";
      } else if (event.event !== "Redeemed") {
        event.coll = extractedEvents[address][index - 1].coll;
        event.debt = extractedEvents[address][index - 1].debt;
      }

      if (!blockNumber.includes(event.blockNumber)) {
        blockNumber.push(event.blockNumber);
      }
      if (event.event !== "Redeemed") {
        event.args = BigNumber.from(event.args).toString();
      }

      switch (event.event) {
        case "Deposited":
          event.coll = BigNumber.from(event.coll)
            .add(BigNumber.from(event.args))
            .toString();
          break;
        case "Withdrawn":
          event.coll = BigNumber.from(event.coll)
            .sub(BigNumber.from(event.args))
            .toString();
          break;
        case "Borrowed":
          event.debt = BigNumber.from(event.debt)
            .add(BigNumber.from(event.args))
            .toString();
          break;
        case "Repaid":
          event.debt = BigNumber.from(event.debt)
            .sub(BigNumber.from(event.args))
            .toString();
          break;
        case "Redeemed":
          event.coll = BigNumber.from(event.coll).toString();
          event.debt = BigNumber.from(event.debt).toString();
          break;
        default:
      }
    });
  }

  writeFileSync(
    "./scripts/events/processedEvents.json",
    JSON.stringify(extractedEvents, null, 2)
  );

  writeFileSync(
    "./scripts/events/blockNumbers.json",
    JSON.stringify(blockNumber, null, 2)
  );
  console.log("イベント処理が完了し、ファイルに出力されました。");
}
