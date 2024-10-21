import { readDeploymentAddress } from "../../src/addressUtil";
import { genABI } from "../../src/genABI";
import { createAndProposeTransaction } from "../../src/safeUtil";
import { executeTransaction } from "../../src/upgradeUtil";

const IMPL_NAME_BASE = "FeePool";
const version = "V2";
async function main() {
  const implNameBase = `${IMPL_NAME_BASE}${version}`;
  const CONTRACT_ADDRESS = readDeploymentAddress(
    IMPL_NAME_BASE,
    "ERC1967Proxy"
  );
  const CONTRACT_ABI = genABI(implNameBase);
  const veYmtAddr = readDeploymentAddress("veYMT");
  if (!veYmtAddr) return console.log("not veYMT");

  if (process.env.NETWORK === "localhost") {
    // executeTransaction関数を使用して任意のメソッドを実行
    await executeTransaction(CONTRACT_ADDRESS, CONTRACT_ABI, "setVeYMT", [
      veYmtAddr,
    ]);
  } else {
    // createAndProposeTransaction関数を使用してトランザクションを作成し、提案する
    await createAndProposeTransaction(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      "setVeYMT",
      [veYmtAddr]
    );
  }
}

// main();

export default main;
