/*
    [ Upgrade target list ]

        contracts/ScoreWeightControllerV2.sol

*/
import { _import } from "./importUtil";

async function main() {
  if (process.env.NETWORK !== "localhost") {
    console.log("not localhost");
    return;
  }
  await _import("../mods/300_v2_deployImpl_CurrencyOS");
  await _import("../mods/301_v2_deployImpl_ScoreWeightController");
}

main();
