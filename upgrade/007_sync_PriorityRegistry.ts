import main from "./mods/007_sync_PriorityRegistry";

main().catch((e) => {
  console.error("An error occurred during the upgrade process:", e);
});
