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

// delete PledgeLib rinkeby cache file
import { setNetwork } from "../../src/deployUtil";

async function main() {
  setNetwork("rinkeby");

  await _import("../mods/012_check_integrity");
  // await _import("../mods/013_toggle_Yamato");

  // await _import( "../mods/008_upgrade_Yamato");
  // await _import( "../mods/010_upgrade_YamatoDepositor");
  // await _import( "../mods/003_upgrade_YamatoWithdrawer");
  // await _import( "../mods/002_upgrade_YamatoRedeemer");
  // await _import( "../mods/009_upgrade_YamatoSweeper");
  // await _import( "../mods/006_upgrade_Pool");
  // await _import( "../mods/005_upgrade_PriorityRegistry");
  // await _import( "../mods/011_upgrade_PriceFeed");

  // await _import( "../mods/012_check_integrity");

  // await _import( "../mods/007_sync_PriorityRegistry");

  // await _import( "../mods/012_check_integrity");

  // await _import( "../mods/013_toggle_Yamato");
}

main().then();

async function _import(path: string) {
  return await (await import(path)).default();
}
