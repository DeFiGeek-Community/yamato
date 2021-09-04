pragma solidity 0.7.6;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by somewherecat
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
*/

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "./Dependencies/Ownable.sol";

// Base class to create a oracle mock contract for a specific provider
abstract contract OracleMockBase is Ownable {

    int256 internal lastPrice;
    uint private lastBlockNumber;

    function setLastPrice(int256 _price) public onlyOwner {
      lastPrice = _price;
      lastBlockNumber = block.number;
    }

    function setPriceToDefault() public virtual;

    function simulatePriceMove(uint deviation, bool sign) internal virtual;

    function simulatePriceMove() public onlyOwner {
      require(block.number != lastBlockNumber, "Price cannot be updated twice in the same block.");
      lastBlockNumber = block.number;

      uint randomNumber = uint(keccak256(abi.encodePacked(msg.sender,  block.timestamp,  blockhash(block.number - 1))));
      uint deviation = randomNumber % 11;
      bool sign = randomNumber % 2 == 1 ? true : false;
      simulatePriceMove(deviation, sign);
    }
}