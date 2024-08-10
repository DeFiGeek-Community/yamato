import { readDeploymentAddress } from "../..//src/addressUtil";
import { genABI } from "../../src/genABI";
import { createAndProposeTransaction } from "../../src/safeUtil";
const IMPL_NAME_BASE = "YamatoWithdrawer";
const version = "V3";
async function main() {
  const implNameBase = `${IMPL_NAME_BASE}${version}`;
  const CONTRACT_ADDRESS = readDeploymentAddress(
    IMPL_NAME_BASE,
    "ERC1967Proxy"
  );
  const CONTRACT_ABI = genABI(implNameBase);
  const implAddress = readDeploymentAddress(IMPL_NAME_BASE, "UUPSImpl");
  if (!implAddress) return console.log("not UUPSImpl");

  // createAndProposeTransaction関数を使用してトランザクションを作成し、提案する
  await createAndProposeTransaction(
    CONTRACT_ADDRESS,
    CONTRACT_ABI,
    "upgradeTo",
    [implAddress]
  );
}

// main();

export default main;
