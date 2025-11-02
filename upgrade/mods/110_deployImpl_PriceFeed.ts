import { deployImplContract } from "../../src/deployUtil";
import { deployImplContractWithViem } from "../../src/viemUtil";

const IMPL_NAME_BASE = "priceFeed";
const version = "V3";

async function main() {
  const implNameBase = `${IMPL_NAME_BASE}${version}`;
  await deployImplContractWithViem(implNameBase, false);
}

// main().catch((error) => {
//   console.error(error);
//   process.exitCode = 1;
// });

export default main;
