import { readDeploymentAddress } from "../src/addressUtil";
import { genABI } from "../src/genABI";
import { createAndProposeTransaction } from "../src/safeUtil";
import { executeTransaction } from "../src/upgradeUtil";
import { readFileSync } from "fs";
import { BigNumber } from "ethers";

async function main() {
  // YmtVestingコントラクトの名前ベース
  const IMPL_NAME_BASE = "YmtVesting";
  const CONTRACT_ADDRESS = readDeploymentAddress(IMPL_NAME_BASE);
  const CONTRACT_ABI = genABI(IMPL_NAME_BASE);

  // TokenDistributions.jsonから配布データを読み込む
  const distributionsJson = readFileSync(
    "./scripts/events/TokenDistributions.json",
    "utf8"
  );
  const distributions = JSON.parse(distributionsJson).distributions;

  // 配布データをアドレスと金額の配列に変換
  const addresses = distributions.map(
    (distribution: any) => distribution.address
  );
  const amounts = distributions.map((distribution: any) =>
    BigNumber.from(distribution.distributedTokensBigNumber).toString()
  );
  if (process.env.NETWORK === "localhost") {
    // executeTransaction関数を使用して任意のメソッドを実行
    await executeTransaction(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      "setMultipleClaimAmounts",
      [addresses, amounts]
    );
  } else {
    // createAndProposeTransaction関数を使用してトランザクションを作成し、提案する
    await createAndProposeTransaction(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      "setMultipleClaimAmounts",
      [addresses, amounts]
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
