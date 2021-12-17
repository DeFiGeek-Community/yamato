pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by somewherecat
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

// Base class to create a oracle mock contract for a specific provider
abstract contract OracleMockBase {
    int256 internal lastPrice;
    uint256 private lastBlockNumber;
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    function setLastPrice(int256 _price) public virtual onlyOwner {
        lastPrice = _price;
        lastBlockNumber = block.number;
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(owner == msg.sender, "You are not the owner.");
        _;
    }

    function setPriceToDefault() public virtual;

    function transferOwnership(address _newOwner) public onlyOwner {
        owner = _newOwner;
    }

    function simulatePriceMove(uint256 deviation, bool sign) internal virtual;

    function simulatePriceMove() public onlyOwner {
        // Within each block, only once price update is allowed (volatility control)
        if (block.number != lastBlockNumber) {
            lastBlockNumber = block.number;

            uint256 randomNumber = uint256(
                keccak256(
                    abi.encodePacked(
                        msg.sender,
                        block.timestamp,
                        blockhash(block.number - 1)
                    )
                )
            );
            uint256 deviation = randomNumber % 11;
            bool sign = randomNumber % 2 == 1 ? true : false;
            simulatePriceMove(deviation, sign);
        }
    }
}
