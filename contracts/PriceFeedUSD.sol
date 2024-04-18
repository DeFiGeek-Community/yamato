pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2024 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "./Interfaces/IPriceFeedUSD.sol";
import "./Dependencies/AggregatorV3Interface.sol";
import "./Dependencies/BaseMath.sol";
import "./Dependencies/UUPSBase.sol";

/*
 * PriceFeedUSD for mainnet deployment, connected to Chainlink's live ETH:USD aggregator.
 * It uses Chainlink as the primary oracle and contains logic for handling oracle failures and timeouts.
 */
contract PriceFeedUSD is IPriceFeedUSD, UUPSBase, BaseMath {
    /*
        =========================
        ~~~ SAFE HAVEN ~~~
        =========================
    */
    string constant EthPriceAggregatorInUSD_SLOT_ID =
        "deps.EthPriceAggregatorInUSD";
    // Use to convert a price answer to an 18-digit precision uint
    uint256 public constant TARGET_DIGITS = 18;
    uint8 constant ETHUSD_DIGITS = 8;

    // Maximum time period allowed since Chainlink's latest round data timestamp, beyond which Chainlink is considered frozen.
    uint256 public constant ETHUSD_TIMEOUT = 3600; // 1 hours: 60 * 60

    /*
        =========================
        ~~~ SAFE HAVEN ~~~
        =========================
    */

    /*
        =========================
        !!! DANGER ZONE !!!
        - Proxy patterns (UUPS) stores state onto ERC1967Proxy via `delegatecall` opcode.
        - So modifying storage slot order in the next version of implementation would cause storage layout confliction.
        - You can check whether your change will conflict or not by using `@openzeppelin/upgrades`
        - Read more => https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable#modifying-your-contracts
        =========================
    */
    // The last good price seen from an oracle by Chainlink
    uint256 public override lastGoodPrice;
    uint256 public lastSeen;
    // The current status of the PricFeed, which determines the conditions for the next price fetch attempt
    Status public status;
    /*
        =========================
        --- END DANGER ZONE ---
        =========================
    */

    event LastGoodPriceUpdated(uint256 _lastGoodPrice);
    event PriceFeedStatusChanged(Status newStatus);

    function initialize(
        address _ethPriceAggregatorInUSDAddress
    ) public initializer {
        __UUPSBase_init();

        bytes32 EthPriceAggregatorInUSD_KEY = bytes32(
            keccak256(abi.encode(EthPriceAggregatorInUSD_SLOT_ID))
        );
        assembly {
            sstore(EthPriceAggregatorInUSD_KEY, _ethPriceAggregatorInUSDAddress)
        }

        // Explicitly set initial system status
        status = Status.chainlinkWorking;

        //Get an initial price from Chainlink to serve as first reference for lastGoodPrice
        ChainlinkResponse
            memory chainlinkResponse = _getCurrentChainlinkResponse();

        require(
            !_chainlinkIsBroken(chainlinkResponse) &&
                !_chainlinkIsFrozen(chainlinkResponse),
            "PriceFeed: Chainlink must be working."
        );

        _storeChainlinkPrice(chainlinkResponse);
    }

    // --- Functions ---

    /// @notice ChainLink ETH-USD oracle contract
    function ethPriceAggregatorInUSD()
        public
        view
        override
        returns (address _ethPriceAggregatorInUSD)
    {
        bytes32 EthPriceAggregatorInUSD_KEY = bytes32(
            keccak256(abi.encode(EthPriceAggregatorInUSD_SLOT_ID))
        );
        assembly {
            _ethPriceAggregatorInUSD := sload(EthPriceAggregatorInUSD_KEY)
        }
    }

    /// @notice Mutable price getter.
    function fetchPrice() external override returns (uint256) {
        uint256 _price = _simulatePrice();

        _storePrice(_price);

        return _price;
    }

    /// @notice Immutable price getter.
    function getPrice() external view override returns (uint256) {
        uint256 _price = _simulatePrice();

        return _price;
    }

    /// @notice Immutable status getter.
    function getStatus() external view override returns (Status) {
        _simulatePrice();
        return status;
    }

    /// @dev An internal function to dry run oracle usage determination logic. Can use it for view func or write func. ChainLink is the main oracle.
    function _simulatePrice() internal view returns (uint256 _price) {
        /*
            The early quit by 0xMotoko (Oct 13, 2021)
        */
        if (lastSeen == block.number) return (lastGoodPrice);

        // Get current and previous price data from Chainlink
        ChainlinkResponse
            memory chainlinkResponse = _getCurrentChainlinkResponse();

        if (_chainlinkIsBroken(chainlinkResponse)) {
            revert("chainlink is broken");
        }

        // If Chainlink is frozen
        if (_chainlinkIsFrozen(chainlinkResponse)) {
            revert("chainlink is frozen");
        }

        _price = _scaleChainlinkPriceByDigits(
            uint256(chainlinkResponse.answer),
            chainlinkResponse.decimals
        );
        return _price;
    }

    // --- Helper functions ---

    /* Chainlink is considered broken if its current or previous round data is in any way bad. We check the previous round
     * for two reasons:
     *
     * 1) It is necessary data for the price deviation check in case 1,
     * and
     * 2) Chainlink is the PriceFeed's preferred primary oracle - having two consecutive valid round responses adds
     * peace of mind when using or returning to Chainlink.
     */
    function _chainlinkIsBroken(
        ChainlinkResponse memory _response
    ) internal view returns (bool) {
        // Check for response call reverted
        if (!_response.success) {
            return true;
        }
        // Check for an invalid roundId that is 0
        if (_response.roundId == 0) {
            return true;
        }
        // Check for an invalid timeStamp that is 0, or in the future
        if (_response.timestamp == 0 || _response.timestamp > block.timestamp) {
            return true;
        }
        // Check for non-positive price
        if (_response.answer <= 0) {
            return true;
        }

        return false;
    }

    function _chainlinkIsFrozen(
        ChainlinkResponse memory _response
    ) internal view returns (bool) {
        return block.timestamp - _response.timestamp > ETHUSD_TIMEOUT;
    }

    /// @notice Internal calculator of ChainLink digits padding.
    function _scaleChainlinkPriceByDigits(
        uint256 _price,
        uint256 _answerDigits
    ) internal pure returns (uint256 price) {
        /*
         * Convert the price returned by the Chainlink oracle to an 18-digit decimal for use by Liquity.
         * At date of Liquity launch, Chainlink uses an 8-digit price, but we also handle the possibility of
         * future changes.
         *
         */
        if (_answerDigits >= TARGET_DIGITS) {
            // Scale the returned price value down to Liquity's target precision
            price = _price / (10 ** (_answerDigits - TARGET_DIGITS));
        } else {
            // Scale the returned price value up to Liquity's target precision
            price = _price * (10 ** (TARGET_DIGITS - _answerDigits));
        }
        return price;
    }

    /// @notice Internal price changer.
    function _storePrice(uint256 _currentPrice) internal {
        if (lastSeen == block.number) return;

        lastGoodPrice = _currentPrice;
        lastSeen = block.number;
        emit LastGoodPriceUpdated(_currentPrice);
    }

    /// @notice Internal price changer with digits calc.
    function _storeChainlinkPrice(
        ChainlinkResponse memory _chainlinkResponse
    ) internal returns (uint256) {
        uint256 scaledChainlinkPrice = _scaleChainlinkPriceByDigits(
            uint256(_chainlinkResponse.answer),
            _chainlinkResponse.decimals
        );
        _storePrice(scaledChainlinkPrice);

        return scaledChainlinkPrice;
    }

    // --- Oracle response wrapper functions ---

    /// @notice ChainLink oracle response wrapper
    function _getCurrentChainlinkResponse()
        internal
        view
        returns (ChainlinkResponse memory chainlinkResponse)
    {
        ChainlinkResponse memory ethChainlinkResponseInUSD;

        // First, try to get current decimal precision:
        try
            AggregatorV3Interface(ethPriceAggregatorInUSD()).decimals()
        returns (uint8 decimals) {
            // If call to Chainlink succeeds, record the current decimal precision
            ethChainlinkResponseInUSD.decimals = decimals;
        } catch {
            // If call to Chainlink aggregator reverts, return a zero response with success = false
            return chainlinkResponse;
        }

        // Secondly, try to get latest price data:
        try
            AggregatorV3Interface(ethPriceAggregatorInUSD()).latestRoundData()
        returns (
            uint80 roundId,
            int256 answer,
            uint256 /* startedAt */,
            uint256 timestamp,
            uint80 /* answeredInRound */
        ) {
            // If call to Chainlink succeeds, return the response and success = true
            ethChainlinkResponseInUSD.roundId = roundId;
            ethChainlinkResponseInUSD.answer = answer;
            ethChainlinkResponseInUSD.timestamp = timestamp;
            ethChainlinkResponseInUSD.success = true;
        } catch {
            // If call to Chainlink aggregator reverts, return a zero response with success = false
            return chainlinkResponse;
        }
        return ethChainlinkResponseInUSD;
    }
}
