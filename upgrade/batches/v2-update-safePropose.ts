/*
    [ Upgrade target list ]

        contracts/ScoreWeightControllerV2.sol

*/
import { _import } from "./importUtil";

async function main() {
  await _import("../mods/302_CurrencyOS_upgradeTo");
  await _import("../mods/303_ScoreWeightController_upgradeToAndCall");
  await _import("../mods/304_v2_CurrencyOS_addYamato");
  await _import("../mods/305_v2_addScore_ScoreWeightController");
  await _import("../mods/306_v2_acceptGovernance");
}

main();
