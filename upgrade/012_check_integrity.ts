import("./mods/012_check_integrity").catch((e) => console.log(e));

import main from "./mods/012_check_integrity";

main().catch((e) => {
  console.error("An error occurred during the upgrade process:", e);
});
