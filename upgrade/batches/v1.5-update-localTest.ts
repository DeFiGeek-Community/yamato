/*
    [ Upgrade target list ]

        contracts/YamatoRepayerV3.sol
        contracts/YamatoRedeemerV5.sol
        contracts/YamatoWithdrawerV3.sol
        contracts/YamatoSweeperV3.sol
        contracts/YamatoDepositorV3.sol
        contracts/YamatoBorrowerV2.sol
        contracts/CurrencyOSV3.sol
        contracts/YamatoV4.sol
        contracts/FeePoolV2.sol
*/
import { _import } from "./importUtil";

async function main() {
  if (process.env.NETWORK !== "localhost") {
    console.log("not localhost");
    return;
  }
  await _import("../mods/201_YamatoRepayer_upgradeTo");
  await _import("../mods/202_YamatoRedeemer_upgradeTo");
  await _import("../mods/203_YamatoWithdrawer_upgradeTo");
  await _import("../mods/204_YamatoSweeper_upgradeTo");
  await _import("../mods/205_YamatoDepositor_upgradeTo");
  await _import("../mods/206_YamatoBorrower_upgradeTo");
  await _import("../mods/207_CurrencyOS_upgradeTo");
  await _import("../mods/208_Yamato_upgradeTo");
  await _import("../mods/209_FeePool_upgradeToAndCall");
  await _import("../mods/230_Yamato_setScoreRegistry");
  await _import("../mods/231_FeePool_setVeYMT");
}

main();
