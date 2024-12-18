/*
  Check the address registration
*/
import { _import } from "./importUtil";

async function main() {
  await _import("../mods/190_check_impl");
  await _import("../mods/191_check_setAddress");
  await _import("../mods/192_check_governance");
}

main();
