pragma solidity ^0.8.3;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Yamato
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 *
 * This Factory is a fork of Murray Software's deliverables.
 * And this entire project is including the fork of Hegic Protocol.
 * Hence the license is alinging to the GPL-3.0
*/

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

interface IPriceFeed {
    function fetchPrice() external returns (uint jpyPerUSD, uint ethPerUSD);
}



contract PriceFeed is IPriceFeed {
    function fetchPrice() public override returns (uint jpyPerUSD, uint ethPerUSD) {
        jpyPerUSD = 100;
        ethPerUSD = (1/2500 * 10**18);
    }
}

