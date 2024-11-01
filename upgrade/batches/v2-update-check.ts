/*
    [ Upgrade target list ]

        contracts/ScoreWeightControllerV2.sol

*/
import { _import } from "./importUtil";

async function main() {
  if (process.env.NETWORK !== "localhost") {
    return;
  }
  await _import("../mods/310_check_impl");
  await _import("../mods/311_check_setAddress");
  await _import("../mods/312_check_governance");
}

main();
