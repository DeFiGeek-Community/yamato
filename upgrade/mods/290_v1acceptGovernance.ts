import { readDeploymentAddress } from "../..//src/addressUtil";
import { genABI } from "../../src/genABI";
import { createAndProposeTransaction } from "../../src/safeUtil";

async function main() {
  // コントラクトの情報を配列に格納
  const contracts = [
    "PriceFeed",
    "FeePool",
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
  ].map((name) => ({
    name,
    address: readDeploymentAddress(name, "ERC1967Proxy"),
    abi: genABI(name),
  }));

  // 各コントラクトに対してacceptGovernanceを呼び出す
  for (const { name, address, abi } of contracts) {
    await createAndProposeTransaction(address, abi, "acceptGovernance");

    console.log(`log: ${name}.acceptGovernance() executed.`);
  }
}

// main();

export default main;
