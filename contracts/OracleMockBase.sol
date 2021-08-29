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

    uint8 public chaosCounter = 0;

    int256 public lastPrice;

    function setLastPrice(int256 _price) public onlyOwner {
      lastPrice = _price;
    }

    function setPriceToDefault() public virtual;

    function randomize() internal view returns (uint, bool) {
      uint randomNumber = uint(keccak256(abi.encodePacked(msg.sender,  block.timestamp,  blockhash(block.number - 1))));
      uint deviation = randomNumber % 11;
      bool sign = randomNumber % 2 == 1 ? true : false;
      return (deviation, sign);
    }

    // If chaos counter == 10, reset it to 0 and trigger chaos = 51% deviation
    // Otherwise, increment the chaos counter and return false
    function chaos() internal returns (bool) {
      if (chaosCounter == 10) {
        chaosCounter = 0;
        return true;
      }
      chaosCounter += 1;
      return false;
    }
}