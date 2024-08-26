import { readFileSync, writeFileSync } from "fs";
const { ethers } = require("hardhat");
import { BigNumber } from "ethers";

interface EventDetail {
  event: string;
  allScore: number;
}

interface EventMap {
  [address: string]: EventDetail[];
}

interface TokenDistribution {
  address: string;
  score: number;
  scorePercentage: number; // スコアの全体に占める割合
  distributedTokens: string; // 配布トークンの量
  distributedTokensBigNumber: BigNumber; // 配布トークンの量 BigNumber
}

export function toBigNumber(amount: number, decimals: number = 18): BigNumber {
  const roundedAmount = amount.toFixed(decimals);
  return ethers.utils.parseUnits(roundedAmount, decimals);
}

export function fromBigNumber(
  amount: BigNumber,
  decimals: number = 18
): string {
  return ethers.utils.formatUnits(amount, decimals);
}

const TOTAL_TOKEN_SUPPLY = 50000000;

function calculateTokenDistributions() {
  const eventsJson = readFileSync(
    "./scripts/events/processedEvents.json",
    "utf8"
  );
  const events: EventMap = JSON.parse(eventsJson);

  let totalScore = 0;
  let totalScoreBig = BigNumber.from(0);

  const distributions: TokenDistribution[] = [];

  Object.values(events).forEach((eventDetails) => {
    const endEvent = eventDetails.find((detail) => detail.event === "end");
    if (endEvent) {
      totalScore += Math.ceil(endEvent.allScore);
      totalScoreBig = totalScoreBig.add(toBigNumber(endEvent.allScore));
    }
  });

  const totalTokenSupplyBig = toBigNumber(TOTAL_TOKEN_SUPPLY);
  let totalDistributedTokensBig = BigNumber.from(0);

  Object.entries(events).forEach(([address, eventDetails]) => {
    const endEvent = eventDetails.find((detail) => detail.event === "end");
    if (endEvent) {
      const scorePercentage = (endEvent.allScore / totalScore) * 100;

      const scoreBig = toBigNumber(endEvent.allScore);
      const distributedTokensBig = scoreBig
        .mul(totalTokenSupplyBig)
        .div(totalScoreBig);

      totalDistributedTokensBig =
        totalDistributedTokensBig.add(distributedTokensBig);

      distributions.push({
        address: address,
        score: endEvent.allScore,
        scorePercentage: scorePercentage,
        distributedTokens: fromBigNumber(distributedTokensBig),
        distributedTokensBigNumber: distributedTokensBig,
      });
    }
  });

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

  console.log(
    "Token distribution results have been saved to TokenDistributions.json."
  );
}

calculateTokenDistributions();
