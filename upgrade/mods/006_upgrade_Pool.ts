import { runUpgrade } from "../../src/upgradeUtil";

const IMPL_NAME_BASE = "Pool";

export default async function main() {
  await runUpgrade(IMPL_NAME_BASE);
}
