import { runUpgrade } from "../src/upgradeUtil";

const IMPL_NAME_BASE = "PriorityRegistry";

async function main() {
  await runUpgrade(IMPL_NAME_BASE, ["PledgeLib"]);
}

main().catch((e) => console.log(e));
