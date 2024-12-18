/*
    [ Upgrade target list ]

        contracts/ScoreWeightControllerV2.sol

*/
import { _import } from "./importUtil";

async function main() {
  await _import("../mods/300_v2_deployImpl_CurrencyOS");
  await _import("../mods/301_v2_deployImpl_ScoreWeightController");
}

main();
