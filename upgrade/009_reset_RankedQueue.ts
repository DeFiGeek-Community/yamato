import("./mods/009_reset_RankedQueue").catch((e) => console.log(e));

import main from "./mods/009_reset_RankedQueue";

main().catch((e) => {
  console.error("An error occurred during the upgrade process:", e);
});
