import { ethers } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
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
  const implAddress = readDeploymentAddress(IMPL_NAME_BASE, "UUPSImpl");
  if (!implAddress) return console.log("not UUPSImpl");

  const number = await time.latest();
  console.log("timeNumber", Number(number));

  const bytes32Number = ethers.utils.solidityPack(
    ["uint256"],
    [Number(number)]
  );
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
