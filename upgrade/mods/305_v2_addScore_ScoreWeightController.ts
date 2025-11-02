import { readDeploymentAddress } from "../../src/addressUtil";
import { genABI } from "../../src/genABI";
import { createAndProposeTransaction } from "../../src/safeUtil";
import { executeTransaction } from "../../src/upgradeUtil";
import { utils } from "ethers";
import { readArtifact } from "../../src/viemUtil";

const IMPL_NAME_BASE = "ScoreWeightController";
const version = "V2";
async function main() {
  const currency = process.env.CURRENCY;

  // CURRENCYが設定されていない場合は終了
  if (!currency) {
    console.error("CURRENCY environment variable is not set.");
    return;
  }

  const implNameBase = `${IMPL_NAME_BASE}${version}`;
  const CONTRACT_ADDRESS = readDeploymentAddress(
    IMPL_NAME_BASE,
    "ERC1967Proxy"
  );
  const CONTRACT_ABI = genABI(implNameBase);
  const scoreRegistryAddr = readDeploymentAddress(
    "ScoreRegistry",
    "ERC1967Proxy",
    currency
  );
  if (!scoreRegistryAddr) return console.log("not scoreRegistryAddr");

  if (process.env.NETWORK === "localhost") {
    // executeTransaction関数を使用して任意のメソッドを実行
    const implArtifactPath = `./artifacts/contracts/${implNameBase}.sol/${implNameBase}.json`;
    const implArtifact = readArtifact(implArtifactPath);
    await executeTransaction(CONTRACT_ADDRESS, implArtifact.abi, "addScore", [
      scoreRegistryAddr,
      utils.parseEther("1"),
    ]);
  } else {
    // createAndProposeTransaction関数を使用してトランザクションを作成し、提案する
    await createAndProposeTransaction(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      "addScore",
      [scoreRegistryAddr, utils.parseEther("1")]
    );
  }
}

// main();

export default main;
