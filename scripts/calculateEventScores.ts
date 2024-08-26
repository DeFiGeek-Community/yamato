import { BigNumber, utils } from "ethers";
import { readFileSync, writeFileSync } from "fs";

// イベントデータを表すインターフェース
interface EventData {
  coll: string | BigNumber; // 担保額
  debt: string | BigNumber; // 借入額
  price: string; // 価格
  args: string; // イベント引数
  event: string; // イベントタイプ
  icr: number; // 担保率
  cjpy: number; // JPYでの借入額
  icrScore: number; // ICRから計算されたスコア
  baseScore: number; // 基本スコア
  diffScore: number; // 差分スコア
  allScore: number; // 全スコア
}

function calculateICR(
  collateral: BigNumber,
  debt: BigNumber,
  price: BigNumber
): number {
  const collateralValue = Number(utils.formatUnits(collateral, 18));
  const debtValue = Number(utils.formatUnits(debt, 18));
  const priceValue = Number(utils.formatUnits(price, 18));
  const collateralInCurrency = collateralValue * priceValue;

  return collateralValue === 0 || debtValue === 0
    ? 0
    : (100 * collateralInCurrency) / debtValue;
}

function calculateScore(icr: number): number {
  if (icr >= 250) {
    return 2.5;
  } else if (icr >= 200) {
    return 2;
  } else if (icr >= 150) {
    return 1.5;
  } else if (icr >= 130) {
    return 1;
  }
  return 0;
}

export function processExtractedEvents() {
  const extractedEventsJson = readFileSync(
    "./scripts/events/extractedEvents.json",
    "utf8"
  );
  const extractedEvents = JSON.parse(extractedEventsJson);

  const priceDataJson = readFileSync("./scripts/events/priceData.json", "utf8");
  const priceData = JSON.parse(priceDataJson);

  for (const address in extractedEvents) {
    extractedEvents[address].forEach((event, index) => {
      if (index === 0) {
        event.coll = "0";
        event.debt = "0";
      } else if (event.event !== "Redeemed") {
        event.coll = extractedEvents[address][index - 1].coll;
        event.debt = extractedEvents[address][index - 1].debt;
      }

      if (event.event !== "Redeemed") {
        event.args = BigNumber.from(event.args).toString();
      }

      if (priceData[event.blockNumber]) {
        event.price = BigNumber.from(
          priceData[event.blockNumber].price
        ).toString();
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
          // Redeemed events do not modify coll or debt
          break;
        default:
        // No action for other events
      }

      event.icr = calculateICR(
        BigNumber.from(event.coll),
        BigNumber.from(event.debt),
        BigNumber.from(event.price)
      );
      event.cjpy = Number(utils.formatUnits(event.debt, 18));
      event.icrScore = calculateScore(event.icr);

      const baseScore = event.icrScore * event.cjpy;
      event.baseScore = baseScore;
      const previousEvent =
        index > 0 ? extractedEvents[address][index - 1] : null;
      const timeDifference = previousEvent
        ? event.blockNumber - previousEvent.blockNumber
        : 0;
      event.diffScore =
        previousEvent && previousEvent.diffScore !== 0
          ? baseScore * timeDifference
          : baseScore;

      event.allScore = previousEvent
        ? previousEvent.allScore + event.diffScore
        : event.diffScore;
    });
  }

  writeFileSync(
    "./scripts/events/processedEvents.json",
    JSON.stringify(extractedEvents, null, 2)
  );

  console.log("イベント処理が完了し、ファイルに出力されました。");
}

processExtractedEvents();
