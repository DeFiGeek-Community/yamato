import { readDeploymentAddress } from "../../src/addressUtil";
import { genABI } from "../../src/genABI";
import { createAndProposeTransaction } from "../../src/safeUtil";
import { executeTransaction } from "../../src/upgradeUtil";

const IMPL_NAME_BASE = "Yamato";
const version = "V4";
async function main() {
  const implNameBase = `${IMPL_NAME_BASE}${version}`;
  const CONTRACT_ADDRESS = readDeploymentAddress(
    IMPL_NAME_BASE,
    "ERC1967Proxy"
  );
  const CONTRACT_ABI = genABI(implNameBase);
  const scoreRegistryAddr = readDeploymentAddress(
    "ScoreRegistry",
    "ERC1967Proxy"
  );
  if (!scoreRegistryAddr) return console.log("not Proxy");

  if (process.env.NETWORK === "localhost") {
    // executeTransaction関数を使用して任意のメソッドを実行
    await executeTransaction(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      "setScoreRegistry",
      [scoreRegistryAddr]
    );
  } else {
    // createAndProposeTransaction関数を使用してトランザクションを作成し、提案する
    await createAndProposeTransaction(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      "setScoreRegistry",
      [scoreRegistryAddr]
    );
  }
}

// main();

export default main;
