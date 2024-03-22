/*
    [ Upgrade target list ]

        contracts/YamatoV4.sol
        contracts/CurrencyOSV3.sol
        contracts/FeePoolV2.sol
*/

import { setNetwork } from "../../src/deployUtil";

async function main() {
  setNetwork(process.env.NETWORK);

  /*
    ======================
    Usage: Comment-in the only-needed line.  
    ======================
  */
  await _import("../mods/004_upgrade_CurrencyOS");
  await _import("../mods/008_upgrade_Yamato");
  await _import("../mods/017_upgrade_FeePool");
}

async function downgrade() {
  const runDowngrade = (await import("../../src/upgradeUtil")).runDowngrade;

  /*
    ====================
    !!! Downgrading MUST be upgrading !!!
      - Going back to the older version implies storage conflict by the newly added slot.
      - Hence you can back to the older one by adding new slot to older contract.
      - But it would be complicated.
      - Maybe hotfixing to halt the upgrade-caused-bugs to mitigate damage and then re-upgrading to the next-next version of patched contract would be better.
      - It means downgrading isn't exist and WE ARE UPONLY.
    ====================
  */

  // await runDowngrade("CurrencyOS", "");
  // await runDowngrade("Yamato", "V3", ["PledgeLib"]);
  // await runDowngrade("FeePool", "");
}

if (process.env.YMT_CLI_MODE == "upgrade") {
  main().then();
} else if (process.env.YMT_CLI_MODE == "downgrade") {
  downgrade().then();
} else {
  throw new Error("Use YMT_CLI_MODE env var.");
}

async function _import(path: string) {
  return await (await import(path)).default();
}
