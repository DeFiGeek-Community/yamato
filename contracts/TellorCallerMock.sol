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

    uint256 public lastPrice;

    constructor() {
        setPriceToDefault();
    }

    function getTellorCurrentValue(uint256 _requestId) external returns (bool ifRetrieve, uint256 value, uint256 _timestampRetrieved){
        require(_requestId == 59, "Only ETH/JPY is supported.");
        (
        uint deviation,
        bool sign
        ) = randomize();

        if (deviation == 0) {
            // no deviation
            value = lastPrice;
        } else {
            if (deviation == 10) {
                if (chaos()) {
                    deviation = 51;
                }
            }

            uint change = lastPrice / 100;
            change = change * deviation;
            value = sign ? lastPrice + change : lastPrice - change;

            if (value == 0) {
                // Price shouldn't be zero, reset if so
                setPriceToDefault();
                value = lastPrice;
            }
            lastPrice = value;
        }
        
        return (true, lastPrice, block.timestamp);
    }

    function setLastPrice(uint256 _price) public {
      lastPrice = _price;
    }

    function setPriceToDefault() public {
      lastPrice = 300000000000; // 300000 JPY
    }
}