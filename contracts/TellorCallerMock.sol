pragma solidity 0.7.6;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by somewherecat
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
*/

import "./OracleMockBase.sol";

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

contract TellorCallerMock is OracleMockBase {

    constructor() {
        setPriceToDefault();
    }

    function getTellorCurrentValue(uint256 _requestId) external returns (bool ifRetrieve, uint256 value, uint256 _timestampRetrieved){
        require(_requestId == 59, "Only ETH/JPY is supported.");
        (
        uint deviation,
        bool sign
        ) = randomize();

        uint256 _lastPrice = uint256(lastPrice);
        if (deviation == 0) {
            // no deviation
            value = _lastPrice;
        } else {
            if (deviation == 10) {
                if (chaos()) {
                    deviation = 51;
                }
            }

            uint change = _lastPrice / 100;
            change = change * deviation;
            value = sign ? _lastPrice + change : _lastPrice - change;

            if (value == 0) {
                // Price shouldn't be zero, reset if so
                setPriceToDefault();
                value = _lastPrice;
            }
            lastPrice = int256(value);
        }
        
        return (true, value, block.timestamp);
    }

    function setPriceToDefault() public override onlyOwner {
      lastPrice = 300000000000; // 300000 JPY
    }
}