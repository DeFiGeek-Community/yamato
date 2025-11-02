import { readDeploymentAddress } from "../../src/addressUtil";
import { genABI } from "../../src/genABI";
import { createAndProposeTransaction } from "../../src/safeUtil";
import { executeTransaction } from "../../src/upgradeUtil";
import { utils } from "ethers";
import { readArtifact } from "../../src/viemUtil";

const IMPL_NAME_BASE = "CurrencyOS";
const version = "V4";
async function main() {
  const implNameBase = `${IMPL_NAME_BASE}${version}`;
  const CONTRACT_ADDRESS = readDeploymentAddress(
    IMPL_NAME_BASE,
    "ERC1967Proxy"
  );
  const CONTRACT_ABI = genABI(implNameBase);
  const ymtOSAddr = readDeploymentAddress("YmtOS", "ERC1967Proxy");
  if (!ymtOSAddr) return console.log("not ymtOSAddr");

  if (process.env.NETWORK === "localhost") {
    // executeTransaction関数を使用して任意のメソッドを実行
    const implArtifactPath = `./artifacts/contracts/${implNameBase}.sol/${implNameBase}.json`;
    const implArtifact = readArtifact(implArtifactPath);
    await executeTransaction(CONTRACT_ADDRESS, implArtifact.abi, "setYmtOS", [
      ymtOSAddr,
    ]);
  } else {
    // createAndProposeTransaction関数を使用してトランザクションを作成し、提案する
    await createAndProposeTransaction(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      "setYmtOS",
      [ymtOSAddr]
    );
  }
}

// main();

export default main;
