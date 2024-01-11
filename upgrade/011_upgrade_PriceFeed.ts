import("./mods/011_upgrade_PriceFeed").catch((e) => console.log(e));

import main from "./mods/011_upgrade_PriceFeed";

main().catch((e) => {
  console.error("An error occurred during the upgrade process:", e);
});