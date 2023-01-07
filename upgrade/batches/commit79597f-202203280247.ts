/*
    [ Upgrade target list ]
        - git diff 79597f872101412dade7f652f333df5b9c267b8c b81bb529c123d36a53e1e0a61a19b8154c483f0f --name-only

        contracts/YamatoV3.sol
        contracts/YamatoDepositorV2.sol
        contracts/YamatoWithdrawerV2.sol
        contracts/YamatoRedeemerV4.sol
        contracts/YamatoSweeperV2.sol
        contracts/PoolV2.sol
        contracts/PriorityRegistryV6.sol
        contracts/PriceFeed.sol
*/

// delete PledgeLib goerli cache file
import { setNetwork } from "../../src/deployUtil";

async function main() {
  setNetwork("goerli");

  /*
    ======================
    Usage: Comment-in the only-needed line.  
    ======================
  */

  // await _import("../mods/012_check_integrity");
  // await _import("../mods/013_toggle_Yamato");

  // await _import("../mods/011_upgrade_PriceFeed");
  // await _import( "../mods/008_upgrade_Yamato");
  // await _import( "../mods/010_upgrade_YamatoDepositor");
  // await _import( "../mods/003_upgrade_YamatoWithdrawer");
  await _import("../mods/002_upgrade_YamatoRedeemer");
  // await _import("../mods/014_upgrade_YamatoSweeper");
  // await _import("../mods/006_upgrade_Pool");
  // await _import("../mods/005_upgrade_PriorityRegistry");

  await _import("../mods/012_check_integrity");
  // await new Promise((resolve) => setTimeout(resolve, 20000));

  // await _import("../mods/007_sync_PriorityRegistry");

  // await _import( "../mods/012_check_integrity");

  // await _import( "../mods/015_adjustIntegrity");

  // await _import( "../mods/012_check_integrity");

  // await _import( "../mods/013_toggle_Yamato");
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

  // await runDowngrade("PriceFeed", "");
  // await runDowngrade("Yamato", "V2", ["PledgeLib"]);
  // await runDowngrade("YamatoDepositor", "", ["PledgeLib"]);
  // await runDowngrade("YamatoWithdrawer", "", ["PledgeLib"]);
  // await runDowngrade("YamatoRedeemer", "V3", ["PledgeLib"]);
  // await runDowngrade("YamatoSweeper", "", ["PledgeLib"]);
  // await runDowngrade("PriorityRegistry", "V5", ["PledgeLib"]);
  // await runDowngrade("Pool", "");
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
