pragma solidity 0.7.6;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by somewherecat
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
*/

import "./OracleMockBase.sol";

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

contract ChainLinkMock is OracleMockBase {
    uint8 public symbol;
    uint8 private ETHUSD = 1;
    uint8 private JPYUSD = 2;

    int256 public lastPrice;

    uint80 private lastRoundId;
    uint80 private lastPriceUpdateRoundId;
    uint8 private chaosCounter;
    
    // mapping from a specific roundId to previous values
    mapping(uint80 => int256) private prevAnswers;
    mapping(uint80 => uint256) private prevTimestamps;
    mapping(uint80 => uint80) private prevAnsweredInRounds;

    constructor(string memory _symbol) public {
        symbol = getSymbolId(_symbol);
        require(symbol > 0, "Only ETH/USD and JPY/USD is supported.");

        lastRoundId = 30000000000000000001;
        lastPriceUpdateRoundId = 30000000000000000001;
        chaosCounter = 0;
        setPriceToDefault();
    }

    function getSymbolId(string memory _symbol) private view returns (uint8) {
      bytes32 value = keccak256(abi.encodePacked(_symbol));
      if (value == keccak256(abi.encodePacked("ETH/USD"))) {
        return ETHUSD;
      } else if (value == keccak256(abi.encodePacked("JPY/USD"))){
        return JPYUSD;
      }
      return 0;
    }

    function setLastPrice(int256 _price) public {
      lastPrice = _price;
    }

    function setPriceToDefault() public {
      if (symbol == ETHUSD) {lastPrice = 300000000000;} // 3000 USD
      if (symbol == JPYUSD) {lastPrice = 1000000;} // 0.010 JPYUSD = 100 USDJPY
    }

    function latestRoundData() external returns (
      uint80 roundId, // The round ID.
      int256 answer, // The price.
      uint256 startedAt, // Timestamp of when the round started.
      uint256 updatedAt, // Timestamp of when the round was updated.
      uint80 answeredInRound // The round ID of the round in which the answer was computed.
    ) {
      (
        uint deviation,
        bool sign
      ) = randomize();
      
      uint80 currentRoundId = lastRoundId + 1;
    
      if (deviation == 0) {
        // no deviation, hence answeredInRound == lastPriceUpdateRoundId
        answer = lastPrice;
        answeredInRound = lastPriceUpdateRoundId;
      } else {
        if (deviation == 10) {
          if (chaos()) {
            deviation = 51;
          }
        }

        int change = lastPrice / 1000;
        change = change * int(deviation);
        answer = sign ? lastPrice + change : lastPrice - change;

        if (answer == 0) {
          // Price shouldn't be zero, reset if so
          setPriceToDefault();
          answer = lastPrice;
        } else if (answer < 0) {
          // Price shouldn't be negative, flip the sign if so
          answer = answer * -1;
        }

        lastPrice = answer;
        answeredInRound = currentRoundId;
        lastPriceUpdateRoundId = currentRoundId;
      }

      lastRoundId = currentRoundId;
      prevAnswers[currentRoundId] = answer;
      prevTimestamps[currentRoundId] = block.timestamp;
      prevAnsweredInRounds[currentRoundId] = answeredInRound;

      return (currentRoundId, answer, block.timestamp, block.timestamp, answeredInRound);
    }

    function decimals() external pure returns (uint8) {
        // For both ETH/USD and JPY/USD, decimals are static being 8
        return 8;
    }

    function getRoundData(uint80 _roundId) external view returns (
        uint80 roundId, 
        int256 answer, 
        uint256 startedAt, 
        uint256 updatedAt, 
        uint80 answeredInRound
    ) {
      uint256 timestamp = prevTimestamps[_roundId];
      require(timestamp != 0, "The specified round Id doesn't have a previous answer.");
      
      return (_roundId, prevAnswers[_roundId], timestamp, timestamp, prevAnsweredInRounds[_roundId]);
    }

    function getRoundData(uint256 _roundId) public {}
}