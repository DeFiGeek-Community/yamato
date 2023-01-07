pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by somewherecat
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

import "./OracleMockBase.sol";
import "./Interfaces/ITellorCaller.sol";
import "hardhat/console.sol";

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

contract TellorCallerMock is OracleMockBase, ITellorCaller {
    uint256 public lastSeen;

    constructor() {
        setPriceToDefault();
    }

    function getTellorCurrentValue(
        uint256 _requestId
    )
        external
        view
        virtual
        override
        returns (bool ifRetrieve, uint256 value, uint256 _timestampRetrieved)
    {
        require(_requestId == 59, "Only ETH/JPY is supported.");
        return (true, uint256(lastPrice), lastSeen);
    }

    function simulatePriceMove(
        uint256 deviation,
        bool sign
    ) internal override onlyOwner {
        uint256 _lastPrice = uint256(lastPrice);
        uint256 value;
        if (deviation != 0) {
            // nothing to do if deviation is zero
            uint256 change = _lastPrice / 1000;
            change = change * deviation;
            value = sign ? _lastPrice + change : _lastPrice - change;

            if (value == 0) {
                // Price shouldn't be zero, reset if so
                setPriceToDefault();
                value = _lastPrice;
            }
            _update(int256(value));
        }
    }

    function setPriceToDefault() public override onlyOwner {
        _update(410000000000);
    }

    function _update(int256 price) internal {
        lastPrice = price; // 410000 JPY per ETH
        lastSeen = block.timestamp;
    }

    function setLastPrice(int256 _price) public override onlyOwner {
        super.setLastPrice(_price);
        _update(_price);
    }
}
