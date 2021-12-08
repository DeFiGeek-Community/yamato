import { runUpgrade } from "../src/upgradeUtil";

const IMPL_NAME_BASE = "YamatoRedeemer";

async function main() {
  await runUpgrade(IMPL_NAME_BASE)
}

main().catch((e) => console.log(e));
