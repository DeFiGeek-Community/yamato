pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
*/

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

interface IYamato {
    struct Pledge {
        uint coll;
        uint debt;
        bool isCreated;
        address owner;
        uint lastUpsertedTimeICRpertenk;
    }
    function getPledge(address _owner) external view returns (Pledge memory); 
    function feed() external view returns (address); 
    function MCR() external view returns (uint8);
}
