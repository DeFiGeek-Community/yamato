import { readFileSync, writeFileSync } from "fs";
const { ethers } = require("hardhat");
import { BigNumber } from "ethers";

/* ===== 型定義 ===== */
interface EventDetail {
  event: string;
  allScore: number;
  cjpy?: number;            // processedEvents.json にある借入額(JPY)
}

interface EventMap {
  [address: string]: EventDetail[];
}

interface TokenDistribution {
  address: string;
  score: number;
  scorePercentage: number;
  distributedTokens: string;
  distributedTokensBigNumber: BigNumber;
  /* new */ maxBorrow: number;                // 最大借入額(CJPY)
  /* new */ maxBorrowBigNumber: BigNumber;    // 18dec BigNumber
}

export function toBigNumber(amount: number, decimals: number = 18): BigNumber {
  return ethers.utils.parseUnits(amount.toFixed(decimals), decimals);
}
export function fromBigNumber(
  amount: BigNumber,
  decimals: number = 18
): string {
  return ethers.utils.formatUnits(amount, decimals);
}

/* ===== 定数 ===== */
const TOTAL_TOKEN_SUPPLY = 50_000_000;
const EXCLUDED_ADDRESSES = [
  "0x153d9DD730083e53615610A0d2f6F95Ab5A0Bc01",
];

/* ===== メイン ===== */
function calculateTokenDistributions() {
  const events: EventMap = JSON.parse(
    readFileSync("./scripts/events/processedEvents.json", "utf8")
  );

  let totalScore = 0;
  let totalScoreBig = BigNumber.from(0);
  const distributions: TokenDistribution[] = [];

  /* ---- 合計スコアを集計 ---- */
  for (const [address, eventDetails] of Object.entries(events)) {
    const endEvent = eventDetails.find((d) => d.event === "end");
    if (endEvent && !EXCLUDED_ADDRESSES.includes(address)) {
      totalScore += endEvent.allScore;
      totalScoreBig = totalScoreBig.add(toBigNumber(endEvent.allScore));
    }
  }

  const totalTokenSupplyBig = toBigNumber(TOTAL_TOKEN_SUPPLY);
  let totalDistributedTokensBig = BigNumber.from(0);

  /* ---- 個別配分計算 ---- */
  for (const [address, eventDetails] of Object.entries(events)) {
    const endEvent = eventDetails.find((d) => d.event === "end");
    if (!endEvent || EXCLUDED_ADDRESSES.includes(address)) continue;

    const scorePercentage = (endEvent.allScore / totalScore) * 100;

    /* ---- 最大借入額(CJPY)を取得 ---- */
    const maxBorrow = eventDetails.reduce(
      (max, ev) => (ev.cjpy && ev.cjpy > max ? ev.cjpy : max),
      0
    );
    const maxBorrowBig = toBigNumber(maxBorrow);

    const scoreBig = toBigNumber(endEvent.allScore);
    const distributedTokensBig = scoreBig
      .mul(totalTokenSupplyBig)
      .div(totalScoreBig);

    if (distributedTokensBig.isZero()) continue;

    totalDistributedTokensBig =
      totalDistributedTokensBig.add(distributedTokensBig);

    distributions.push({
      address,
      score: endEvent.allScore,
      scorePercentage,
      distributedTokens: fromBigNumber(distributedTokensBig),
      distributedTokensBigNumber: distributedTokensBig,
      /* new */ maxBorrow,
      /* new */ maxBorrowBigNumber: maxBorrowBig,
    });
  }

  /* ---- 出力 ---- */
  const result = {
    totalScore,
    totalDistributedTokensBig: fromBigNumber(totalDistributedTokensBig),
    distributions,
  };
  writeFileSync(
    "./scripts/events/TokenDistributions.json",
    JSON.stringify(result, null, 2)
  );

  console.log(
    "totalDistributedTokens",
    fromBigNumber(totalDistributedTokensBig)
  );
  console.log("Token distribution results have been saved to TokenDistributions.json.");
}

calculateTokenDistributions();
