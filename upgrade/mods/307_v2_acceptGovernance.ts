import { readDeploymentAddress } from "../../src/addressUtil";
import { genABI } from "../../src/genABI";
import { createAndProposeTransaction } from "../../src/safeUtil";
import { executeTransaction } from "../../src/upgradeUtil";

async function main() {
  const currency = process.env.CURRENCY;

  // CURRENCYが設定されていない場合は終了
  if (!currency) {
    console.error("CURRENCY environment variable is not set.");
    return;
  }

  // コントラクトの情報を配列に格納
  const contracts = [
    currency === "CUSD" ? "PriceFeedSingle" : "PriceFeed",
    "CurrencyOS",
    "Pool",
    "PriorityRegistry",
    "Yamato",
    "YamatoDepositor",
    "YamatoBorrower",
    "YamatoRepayer",
    "YamatoWithdrawer",
    "YamatoRedeemer",
    "YamatoSweeper",
    "ScoreRegistry",
  ].map((name) => {
    return {
      name,
      address: readDeploymentAddress(name, "ERC1967Proxy", currency),
      abi: genABI(name),
    };
  });

  // 各コントラクトに対してacceptGovernanceを呼び出す
  for (const { name, address, abi } of contracts) {
    if (process.env.NETWORK === "localhost") {
      await executeTransaction(address, abi, "acceptGovernance");
    } else {
      await createAndProposeTransaction(address, abi, "acceptGovernance");
    }
    console.log(`log: ${name}.acceptGovernance() executed.`);
  }
}

// main();

export default main;
