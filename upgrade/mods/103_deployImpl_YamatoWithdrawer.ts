import { deployImplContractWithViem } from "../../src/viemUtil";

const IMPL_NAME_BASE = "YamatoWithdrawer";
const version = "V3";

async function main() {
  const implNameBase = `${IMPL_NAME_BASE}${version}`;
  await deployImplContractWithViem(implNameBase, true);
}

// main().catch((error) => {
//   console.error(error);
//   process.exitCode = 1;
// });

export default main;
