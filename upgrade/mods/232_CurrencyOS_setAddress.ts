import { readDeploymentAddress } from "../../src/addressUtil";
import { genABI } from "../../src/genABI";
import { createAndProposeTransaction } from "../../src/safeUtil";
import { executeTransaction } from "../../src/upgradeUtil";

const IMPL_NAME_BASE = "CurrencyOS";
const version = "V3";
async function main() {
  const implNameBase = `${IMPL_NAME_BASE}${version}`;
  const CONTRACT_ADDRESS = readDeploymentAddress(
    IMPL_NAME_BASE,
    "ERC1967Proxy"
  );
  const CONTRACT_ABI = genABI(implNameBase);
  const veYmtAddr = readDeploymentAddress("veYMT");
  const ymtAddr = readDeploymentAddress("YMT");
  const ymtMinterAddr = readDeploymentAddress("YmtMinter", "ERC1967Proxy");
  const controllerAddr = readDeploymentAddress("ScoreWeightController", "ERC1967Proxy");
  if (!veYmtAddr) return console.log("not veYMT");
  if (!ymtAddr) return console.log("not YMT");
  if (!ymtMinterAddr) return console.log("not YmtMinter");
  if (!controllerAddr) return console.log("not ScoreWeightController");

  if (process.env.NETWORK === "localhost") {
    // executeTransaction関数を使用して任意のメソッドを実行
    await executeTransaction(CONTRACT_ADDRESS, CONTRACT_ABI, "setYMT", [
      ymtAddr,
    ]);
    await executeTransaction(CONTRACT_ADDRESS, CONTRACT_ABI, "setVeYMT", [
      veYmtAddr,
    ]);
    await executeTransaction(CONTRACT_ADDRESS, CONTRACT_ABI, "setYmtMinter", [
      ymtMinterAddr,
    ]);
    await executeTransaction(CONTRACT_ADDRESS, CONTRACT_ABI, "setScoreWeightController", [
      controllerAddr,
    ]);
  } else {
    // createAndProposeTransaction関数を使用してトランザクションを作成し、提案する
    await createAndProposeTransaction(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      "setYMT",
      [ymtAddr]
    );
    await createAndProposeTransaction(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      "setVeYMT",
      [veYmtAddr]
    );
    await createAndProposeTransaction(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      "setYmtMinter",
      [ymtMinterAddr]
    );
    await createAndProposeTransaction(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      "setScoreWeightController",
      [controllerAddr]
    );
  }
}

// main();

export default main;
