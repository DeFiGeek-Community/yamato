/*
    [ Upgrade target list ]
*/
import { _import } from "./importUtil";

async function main() {
  await _import("../mods/306_v2_YmtOS_acceptGovernance");
  await _import("../mods/307_v2_acceptGovernance");
}

main();
