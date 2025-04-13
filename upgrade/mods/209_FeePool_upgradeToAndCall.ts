import { ethers } from "ethers";
import { readDeploymentAddress } from "../../src/addressUtil";

import { genABI } from "../../src/genABI";
import { createAndProposeTransaction } from "../../src/safeUtil";
import { executeTransaction } from "../../src/upgradeUtil";
import { network } from "hardhat";

const IMPL_NAME_BASE = "FeePool";
const version = "V2";
async function main() {
  const implNameBase = `${IMPL_NAME_BASE}${version}`;
  const CONTRACT_ADDRESS = readDeploymentAddress(
    IMPL_NAME_BASE,
    "ERC1967Proxy"
  );
  const CONTRACT_ABI = genABI(implNameBase);
  const implAddress = readDeploymentAddress(IMPL_NAME_BASE, "UUPSImpl");
  if (!implAddress) return console.log("not UUPSImpl");

  // 現在のブロックタイムスタンプを取得
  const latestBlock = await network.provider.send("eth_getBlockByNumber", [
    "latest",
    false,
  ]);
  const currentTimestamp = parseInt(latestBlock.timestamp, 16);

  // 3ヶ月後のタイムスタンプを計算（秒単位）
  // 1ヶ月を30日と仮定: 30日 * 3ヶ月 * 24時間 * 60分 * 60秒
  const threeMonthsInSeconds = 30 * 3 * 24 * 60 * 60;
  const number = currentTimestamp + threeMonthsInSeconds;
  console.log("現在のタイムスタンプ:", currentTimestamp);
  console.log("3ヶ月後のタイムスタンプ:", number);

  const bytes32Number = ethers.utils.solidityPack(["uint256"], [number]);
  const functionSelector = CONTRACT_ABI.getSighash("initializeV2(uint256)");

  const packedBytes = ethers.utils.solidityPack(
    ["bytes", "uint256"],
    [functionSelector, bytes32Number]
  );
  console.log(packedBytes);

  if (process.env.NETWORK === "localhost") {
    // executeTransaction関数を使用して任意のメソッドを実行
    await executeTransaction(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      "upgradeToAndCall",
      [implAddress, packedBytes]
    );
  } else {
    // createAndProposeTransaction関数を使用してトランザクションを作成し、提案する
    await createAndProposeTransaction(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      "upgradeToAndCall",
      [implAddress, packedBytes]
    );
  }
}

// main();

export default main;
