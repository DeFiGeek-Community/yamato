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

import "../012_check_integrity.ts";

import "../008_upgrade_Yamato";
import "../010_upgrade_YamatoDepositor";
import "../003_upgrade_YamatoWithdrawer";
import "../002_upgrade_YamatoRedeemer";
import "../009_upgrade_YamatoSweeper";
import "../006_upgrade_Pool";
import "../005_upgrade_PriorityRegistry";
import "../011_upgrade_PriceFeed";

import "../012_check_integrity.ts";

import "../007_sync_PriorityRegistry";

import "../012_check_integrity.ts";
