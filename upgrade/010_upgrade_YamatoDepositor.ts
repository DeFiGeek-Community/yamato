import("./mods/010_upgrade_YamatoDepositor").catch((e) => console.log(e));


import main from "./mods/010_upgrade_YamatoDepositor";

main().catch((e) => {
  console.error("An error occurred during the upgrade process:", e);
});