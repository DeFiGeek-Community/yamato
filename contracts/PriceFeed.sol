pragma solidity 0.7.6;

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
    function fetchPrice() external pure returns (uint jpyPerETH);
}

interface AggregatorV3Interface {}
interface ITellorCaller {}

contract PriceFeed is IPriceFeed {
    AggregatorV3Interface public priceAggregator;  // Mainnet Chainlink aggregator
    ITellorCaller public tellorCaller;  // Wrapper contract that calls the Tellor system
    constructor(address _priceAggregatorAddress, address _tellorCallerAddress){
        priceAggregator = AggregatorV3Interface(_priceAggregatorAddress);
        tellorCaller = ITellorCaller(_tellorCallerAddress);
    }


    function fetchPrice() public pure override returns (uint jpyPerETH) {
        jpyPerETH = 11111;
    }
}

