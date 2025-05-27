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
  await _import("../mods/101_deployImpl_YamatoRepayer");
  await _import("../mods/102_deployImpl_YamatoRedeemer");
  await _import("../mods/103_deployImpl_YamatoWithdrawer");
  await _import("../mods/104_deployImpl_YamatoSweeper");
  await _import("../mods/105_deployImpl_YamatoDepositor");
  await _import("../mods/106_deployImpl_YamatoBorrower");
  await _import("../mods/107_deployImpl_CurrencyOS");
  await _import("../mods/108_deployImpl_Yamato");
  await _import("../mods/109_deployImpl_FeePool");
}

main();
