import { deployImplContract } from "../../src/deployUtil";

const IMPL_NAME_BASE = "YamatoRedeemer";
const version = "V5";

async function main() {
  const implNameBase = `${IMPL_NAME_BASE}${version}`;
  await deployImplContract(implNameBase, true);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});