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
  await _import("../mods/230_Yamato_setScoreRegistry");
  await _import("../mods/231_FeePool_setVeYMT");
  await _import("../mods/232_CurrencyOS_setAddress");
}

main();
