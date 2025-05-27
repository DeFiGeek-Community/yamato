import { BigNumber, providers, Contract } from "ethers";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { PriceFeedV3__factory } from "../typechain/factories/contracts/PriceFeedV3__factory";

async function fetchLastGoodPrice(blockNum: number) {
  const networkName = "mainnet";
  const priceFeedProxyAddress = readFileSync(
    `deployments/${networkName}/PriceFeedERC1967Proxy`
  ).toString();

  if (!process.env.INFURA_URL) {
    console.error("INFURA_URLが設定されていません。");
    return;
  }

  const priceFeedProvider = new providers.JsonRpcProvider(
    process.env.INFURA_URL,
    networkName
  );
  const priceFeedAbi = PriceFeedV3__factory.abi;
  const priceFeedContract = new Contract(
    priceFeedProxyAddress,
    priceFeedAbi,
    priceFeedProvider
  );

  try {
    const lastPrice = await priceFeedContract.lastGoodPrice({
      blockTag: blockNum,
    });
    return lastPrice;
  } catch (error) {
    console.error("エラーが発生しました:", error);
  }
}

export async function processPriceData() {
  const eventsJson = readFileSync(
    "./scripts/events/extractedEvents.json",
    "utf8"
  );
  const eventsData = JSON.parse(eventsJson);

  type PriceData = {
    [blockNumber: number]: {
      price: BigNumber;
    };
  };

  let priceData: PriceData = {};
  if (existsSync("./scripts/events/priceData.json")) {
    const existingPriceDataJson = readFileSync(
      "./scripts/events/priceData.json",
      "utf8"
    );
    priceData = JSON.parse(existingPriceDataJson);
  }

  const blockNumList: number[] = [];

  for (const userAddress in eventsData) {
    eventsData[userAddress].forEach((eventData, index) => {
      if (
        !blockNumList.includes(eventData.blockNumber) &&
        !priceData[eventData.blockNumber]
      ) {
        blockNumList.push(eventData.blockNumber);
      }
    });
  }

  for (const blockNum of blockNumList) {
    const price = await fetchLastGoodPrice(Number(blockNum));
    priceData[blockNum] = { price: price };
  }

  writeFileSync(
    "./scripts/events/priceData.json",
    JSON.stringify(priceData, null, 2)
  );
  console.log("イベント処理が完了し、ファイルに出力されました。");
}

(async () => {
  await processPriceData();
})();
