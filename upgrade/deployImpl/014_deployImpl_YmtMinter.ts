import { deployImplContract } from "../../src/deployUtil";

const IMPL_NAME_BASE = "YmtMinter";
const version = "";

async function main() {
  const implNameBase = `${IMPL_NAME_BASE}${version}`;
  await deployImplContract(implNameBase, false);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
