import { ethers } from "ethers";
import { readDeploymentAddress } from "../../src/addressUtil";
import { setNetwork, setProvider, getFoundation } from "../../src/deployUtil";
import { genABI } from "../../src/genABI";
import { createAndProposeTransaction } from "../../src/safeUtil";
import { executeTransaction } from "../../src/upgradeUtil";

const IMPL_NAME_BASE = "ScoreWeightController";
const version = "V2";
async function main() {
  setNetwork(process.env.NETWORK);
  await setProvider();

  const implNameBase = `${IMPL_NAME_BASE}${version}`;

  const ScoreRegistryAddr = readDeploymentAddress(
    "ScoreRegistry",
    "ERC1967Proxy"
  );
  const CONTRACT_ADDRESS = readDeploymentAddress(
    IMPL_NAME_BASE,
    "ERC1967Proxy"
  );
  const CONTRACT_ABI = genABI(implNameBase);
  const implAddress = readDeploymentAddress(IMPL_NAME_BASE, "UUPSImpl");
  if (!implAddress) return console.log("not UUPSImpl");

  const scoreRegistryInstance = new ethers.Contract(
    ScoreRegistryAddr,
    genABI("ScoreRegistry"),
    getFoundation()
  );

  const v1time = await scoreRegistryInstance.periodTimestamp(0);
  console.log(Number(v1time));
  const packedBytes = ethers.utils.defaultAbiCoder.encode(
    ["address", "uint256"],
    [ScoreRegistryAddr, Number(v1time)]
  );

  const functionSelector = CONTRACT_ABI.getSighash(
    "initializeV2(address,uint256)"
  );

  const data = functionSelector + packedBytes.slice(2);

  if (process.env.NETWORK === "localhost") {
    // executeTransaction関数を使用して任意のメソッドを実行
    await executeTransaction(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      "upgradeToAndCall",
      [implAddress, data]
    );
  } else {
    // createAndProposeTransaction関数を使用してトランザクションを作成し、提案する
    await createAndProposeTransaction(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      "upgradeToAndCall",
      [implAddress, data]
    );
  }
}

// main();

export default main;
