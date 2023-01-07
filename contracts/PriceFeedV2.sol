pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "./Interfaces/IPriceFeed.sol";
import "./Interfaces/IPriceFeedV2.sol";
import "./Interfaces/ITellorCaller.sol";
import "./Dependencies/AggregatorV3Interface.sol";
import "./Dependencies/BaseMath.sol";
import "./Dependencies/LiquityMath.sol";
import "./Dependencies/UUPSBase.sol";

import "hardhat/console.sol";

/*
 * PriceFeed for mainnet deployment, to be connected to Chainlink's live ETH:USD aggregator reference
 * contract, and a wrapper contract TellorCaller, which connects to TellorMaster contract.
 *
 * The PriceFeed uses Chainlink as primary oracle, and Tellor as fallback. It contains logic for
 * switching oracles based on oracle failures, timeouts, and conditions for returning to the primary
 * Chainlink oracle.
 */
contract PriceFeedV2 is IPriceFeedV2, UUPSBase, BaseMath {
    /*
        =========================
        ~~~ SAFE HAVEN ~~~
        =========================
    */
    string constant EthPriceAggregatorInUSD_SLOT_ID =
        "deps.EthPriceAggregatorInUSD";
    string constant JpyPriceAggregatorInUSD_SLOT_ID =
        "deps.JpyPriceAggregatorInUSD";
    string constant TellorCaller_SLOT_ID = "deps.TellorCaller";
    uint256 public constant ETHUSD_TELLOR_REQ_ID = 59;
    // Use to convert a price answer to an 18-digit precision uint
    uint256 public constant TARGET_DIGITS = 18;
    uint8 constant ETHUSD_DIGITS = 8;
    uint8 constant USDJPY_DIGITS = 8;
    uint256 public constant TELLOR_DIGITS = 6;

    // Maximum time period allowed since Chainlink's latest round data timestamp, beyond which Chainlink is considered frozen.
    uint256 public constant TIMEOUT = 14400; // 4 hours: 60 * 60 * 4

    // Maximum deviation allowed between two consecutive Chainlink oracle prices. 18-digit precision.
    uint256 public constant MAX_PRICE_DEVIATION_FROM_PREVIOUS_ROUND = 5e17; // 50%

    /*
     * The maximum relative price difference between two oracle responses allowed in order for the PriceFeed
     * to return to using the Chainlink oracle. 18-digit precision.
     */
    uint256 public constant MAX_PRICE_DIFFERENCE_BETWEEN_ORACLES = 5e16; // 5%
    uint256 public constant MAX_PRICE_DIFFERENCE_FOR_TELLOR_ADJUSTMENT = 5e16; // 5%
    uint256 public constant ADJUSTMENT_COOLTIME = 1000; // in blocks
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
    // The last good price seen from an oracle by Liquity
    uint256 public override lastGoodPrice;
    uint256 public lastSeen;
    // The current status of the PricFeed, which determines the conditions for the next price fetch attempt
    Status public status;
    uint256 public lastAdjusted;
    /*
        =========================
        --- END DANGER ZONE ---
        =========================
    */

    event LastGoodPriceUpdated(uint256 _lastGoodPrice);
    event PriceFeedStatusChanged(Status newStatus);

    function initialize(
        address _ethPriceAggregatorInUSDAddress,
        address _jpyPriceAggregatorInUSDAddress,
        address _tellorCallerAddress
    ) public initializer {
        __UUPSBase_init();

        bytes32 EthPriceAggregatorInUSD_KEY = bytes32(
            keccak256(abi.encode(EthPriceAggregatorInUSD_SLOT_ID))
        );
        bytes32 JpyPriceAggregatorInUSD_KEY = bytes32(
            keccak256(abi.encode(JpyPriceAggregatorInUSD_SLOT_ID))
        );
        bytes32 TellorCaller_KEY = bytes32(
            keccak256(abi.encode(TellorCaller_SLOT_ID))
        );
        assembly {
            sstore(EthPriceAggregatorInUSD_KEY, _ethPriceAggregatorInUSDAddress)
            sstore(JpyPriceAggregatorInUSD_KEY, _jpyPriceAggregatorInUSDAddress)
            sstore(TellorCaller_KEY, _tellorCallerAddress)
        }

        // Explicitly set initial system status
        status = Status.chainlinkWorking;

        //Get an initial price from Chainlink to serve as first reference for lastGoodPrice
        ChainlinkResponse
            memory chainlinkResponse = _getCurrentChainlinkResponse();
        ChainlinkResponse
            memory prevChainlinkResponse = _getPrevChainlinkResponse(
                chainlinkResponse.roundId,
                ETHUSD_DIGITS,
                chainlinkResponse.subAnswer,
                chainlinkResponse.subDecimal
            );

        require(
            !_chainlinkIsBroken(chainlinkResponse, prevChainlinkResponse) &&
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

    /// @notice ChainLink JPY-USD oracle contract
    function jpyPriceAggregatorInUSD()
        public
        view
        override
        returns (address _jpyPriceAggregatorInUSD)
    {
        bytes32 JpyPriceAggregatorInUSD_KEY = bytes32(
            keccak256(abi.encode(JpyPriceAggregatorInUSD_SLOT_ID))
        );
        assembly {
            _jpyPriceAggregatorInUSD := sload(JpyPriceAggregatorInUSD_KEY)
        }
    }

    /// @notice Tellor ETH-JPY oracle contract
    function tellorCaller()
        public
        view
        override
        returns (address _tellorCaller)
    {
        bytes32 TellorCaller_KEY = bytes32(
            keccak256(abi.encode(TellorCaller_SLOT_ID))
        );
        assembly {
            _tellorCaller := sload(TellorCaller_KEY)
        }
    }

    /// @notice Mutable price getter.
    function fetchPrice() external override returns (uint256) {
        (uint256 _price, Status _status, bool _isAdjusted) = _simulatePrice();

        _changeStatus(_status);

        _storePrice(_price);

        if (_isAdjusted) {
            lastAdjusted = block.number;
        }

        return _price;
    }

    /// @notice Immutable price getter.
    function getPrice() external view override returns (uint256) {
        (uint256 _price, , ) = _simulatePrice();

        return _price;
    }

    /// @notice Immutable status getter.
    function getStatus() external view override returns (Status) {
        (, Status _status, ) = _simulatePrice();

        return _status;
    }

    /// @notice Immutable drastic-change adjusting flag getter.
    function getIsAdjusted() external view override returns (bool) {
        (, , bool _isAdjusted) = _simulatePrice();

        return _isAdjusted;
    }

    /// @dev An internal function to dry run oracle usage determination logic. Can use it for view func or write func. ChainLink is the main oracle.
    function _simulatePrice()
        internal
        view
        returns (uint256 _price, Status _status, bool _isAdjusted)
    {
        /*
            The early quit by 0xMotoko (Oct 13, 2021)
        */
        if (lastSeen == block.number) return (lastGoodPrice, status, false);

        // Get current and previous price data from Chainlink, and current price data from Tellor
        ChainlinkResponse
            memory chainlinkResponse = _getCurrentChainlinkResponse();
        ChainlinkResponse
            memory prevChainlinkResponse = _getPrevChainlinkResponse(
                chainlinkResponse.roundId,
                ETHUSD_DIGITS,
                chainlinkResponse.subAnswer,
                chainlinkResponse.subDecimal
            );
        TellorResponse memory tellorResponse = _getCurrentTellorResponse();

        // --- CASE 1: System fetched last price from Chainlink  ---
        if (status == Status.chainlinkWorking) {
            // If Chainlink is broken, try Tellor
            if (_chainlinkIsBroken(chainlinkResponse, prevChainlinkResponse)) {
                // If Tellor is broken then both oracles are untrusted, so return the last good price
                if (_tellorIsBroken(tellorResponse)) {
                    // _changeStatus(Status.bothOraclesUntrusted);
                    _price = lastGoodPrice;
                    _status = Status.bothOraclesUntrusted;
                    return (_price, _status, false);
                }
                /*
                 * If Tellor is only frozen but otherwise returning valid data, return the last good price.
                 * Tellor may need to be tipped to return current data.
                 */
                if (_tellorIsFrozen(tellorResponse)) {
                    // _changeStatus(Status.usingTellorChainlinkUntrusted);
                    _price = lastGoodPrice;
                    _status = Status.usingTellorChainlinkUntrusted;
                    return (_price, _status, false);
                }

                // [ Deprecated ]
                // If Chainlink is broken and Tellor is working, switch to Tellor and return current Tellor price
                // _changeStatus(Status.usingTellorChainlinkUntrusted);
                //
                // [ New Design - @0xMotoko Mar 2, 2022 ]
                // If Chainlink is broken and Tellor is working, check Tellor and compare with lastGoodPrice. Because unconditional trust for Tellor price is less secure.
                // If that diff is less than 5%, apply that Tellor price.
                // Unless, gracefully adjust lastGoodPrice by 5% toward the Tellor price direction.
                // This graceful adjustment must be permitted only once in the 1000 blocks to take a day for 30% price adjustment.

                return
                    _safeUsingTellorOrGracefulAdjustment(
                        tellorResponse,
                        Status.usingTellorChainlinkUntrusted
                    );
            }

            // If Chainlink is frozen, try Tellor
            if (_chainlinkIsFrozen(chainlinkResponse)) {
                // If Tellor is broken too, remember Tellor broke, and return last good price
                if (_tellorIsBroken(tellorResponse)) {
                    // _changeStatus(Status.usingChainlinkTellorUntrusted);
                    _price = lastGoodPrice;
                    _status = Status.usingChainlinkTellorUntrusted;
                    return (_price, _status, false);
                }

                // If Tellor is frozen or working, remember Chainlink froze, and switch to Tellor
                // _changeStatus(Status.usingTellorChainlinkFrozen);
                _status = Status.usingTellorChainlinkFrozen;

                if (_tellorIsFrozen(tellorResponse)) {
                    _price = lastGoodPrice;
                    return (_price, _status, false);
                }

                return
                    _safeUsingTellorOrGracefulAdjustment(
                        tellorResponse,
                        _status
                    );
            }

            // If Chainlink price has changed by > 50% between two consecutive rounds, compare it to Tellor's price
            if (
                _chainlinkPriceChangeAboveMax(
                    chainlinkResponse,
                    prevChainlinkResponse
                )
            ) {
                // If Tellor is broken, both oracles are untrusted, and return last good price
                if (_tellorIsBroken(tellorResponse)) {
                    // _changeStatus(Status.bothOraclesUntrusted);
                    _price = lastGoodPrice;
                    _status = Status.bothOraclesUntrusted;
                    return (_price, _status, false);
                }

                // If Tellor is frozen, switch to Tellor and return last good price
                if (_tellorIsFrozen(tellorResponse)) {
                    // _changeStatus(Status.usingTellorChainlinkUntrusted);
                    _price = lastGoodPrice;
                    _status = Status.usingTellorChainlinkUntrusted;
                    return (_price, _status, false);
                }

                /*
                 * If Tellor is live and both oracles have a similar price, conclude that Chainlink's large price deviation between
                 * two consecutive rounds was likely a legitmate market price movement, and so continue using Chainlink
                 */
                if (
                    _bothOraclesSimilarPrice(chainlinkResponse, tellorResponse)
                ) {
                    _price = _scaleChainlinkPriceByDigits(
                        uint256(chainlinkResponse.answer),
                        chainlinkResponse.decimals
                    );
                    _status = Status.chainlinkWorking;
                    return (_price, _status, false);
                }

                return
                    _safeUsingTellorOrGracefulAdjustment(
                        tellorResponse,
                        Status.usingTellorChainlinkUntrusted
                    );
            }

            // If Chainlink is working and Tellor is broken, remember Tellor is broken
            if (_tellorIsBroken(tellorResponse)) {
                // _changeStatus(Status.usingChainlinkTellorUntrusted);
                _status = Status.usingChainlinkTellorUntrusted;
            }

            // If Chainlink is working, return Chainlink current price (no status change)
            _price = _scaleChainlinkPriceByDigits(
                uint256(chainlinkResponse.answer),
                chainlinkResponse.decimals
            );
            return (_price, _status, false);
        }

        // --- CASE 2: The system fetched last price from Tellor ---
        if (status == Status.usingTellorChainlinkUntrusted) {
            // If both Tellor and Chainlink are live, unbroken, and reporting similar prices, switch back to Chainlink
            // When chainlink just recovered, this condition won't be met because prev is broken. One more tick is needed.
            if (
                _bothOraclesLiveAndUnbrokenAndSimilarPrice(
                    chainlinkResponse,
                    prevChainlinkResponse,
                    tellorResponse
                )
            ) {
                // _changeStatus(Status.chainlinkWorking);
                _price = _scaleChainlinkPriceByDigits(
                    uint256(chainlinkResponse.answer),
                    chainlinkResponse.decimals
                );
                _status = Status.chainlinkWorking;
                return (_price, _status, false);
            }

            if (_tellorIsBroken(tellorResponse)) {
                // _changeStatus(Status.bothOraclesUntrusted);
                _price = lastGoodPrice;
                _status = Status.bothOraclesUntrusted;
                return (_price, _status, false);
            }

            /*
             * If Tellor is only frozen but otherwise returning valid data, just return the last good price.
             * Tellor may need to be tipped to return current data.
             */
            if (_tellorIsFrozen(tellorResponse)) {
                _price = lastGoodPrice;
                _status = status;
                return (_price, _status, false);
            }

            // Otherwise, use Tellor price
            _price = _scaleTellorPriceByDigits(tellorResponse.value);
            _status = status;
            return (_price, _status, false);
        }

        // --- CASE 3: Both oracles were untrusted at the last price fetch ---
        if (status == Status.bothOraclesUntrusted) {
            /*
             * If both oracles are now live, unbroken and similar price, we assume that they are reporting
             * accurately, and so we switch back to Chainlink.
             */
            if (
                _bothOraclesLiveAndUnbrokenAndSimilarPrice(
                    chainlinkResponse,
                    prevChainlinkResponse,
                    tellorResponse
                )
            ) {
                // _changeStatus(Status.chainlinkWorking);
                _price = _scaleChainlinkPriceByDigits(
                    uint256(chainlinkResponse.answer),
                    chainlinkResponse.decimals
                );
                _status = Status.chainlinkWorking;
                return (_price, _status, false);
            }

            // Otherwise, return the last good price - both oracles are still untrusted (no status change)
            _price = lastGoodPrice;
            _status = status;
            return (_price, _status, false);
        }

        // --- CASE 4: Using Tellor, and Chainlink is frozen ---
        if (status == Status.usingTellorChainlinkFrozen) {
            if (_chainlinkIsBroken(chainlinkResponse, prevChainlinkResponse)) {
                // If both Oracles are broken, return last good price
                if (_tellorIsBroken(tellorResponse)) {
                    // _changeStatus(Status.bothOraclesUntrusted);
                    _price = lastGoodPrice;
                    _status = Status.bothOraclesUntrusted;
                    return (_price, _status, false);
                }

                // If Chainlink is broken, remember it and switch to using Tellor
                // _changeStatus(Status.usingTellorChainlinkUntrusted);
                _status = Status.usingTellorChainlinkUntrusted;

                if (_tellorIsFrozen(tellorResponse)) {
                    _price = lastGoodPrice;
                    return (_price, _status, false);
                }

                // If Tellor is working, return Tellor current price
                _price = _scaleTellorPriceByDigits(tellorResponse.value);
                return (_price, _status, false);
            }

            if (_chainlinkIsFrozen(chainlinkResponse)) {
                // if Chainlink is frozen and Tellor is broken, remember Tellor broke, and return last good price
                if (_tellorIsBroken(tellorResponse)) {
                    // _changeStatus(Status.usingChainlinkTellorUntrusted);
                    _price = lastGoodPrice;
                    _status = Status.usingChainlinkTellorUntrusted;
                    return (_price, _status, false);
                }

                // If both are frozen, just use lastGoodPrice
                if (_tellorIsFrozen(tellorResponse)) {
                    _price = lastGoodPrice;
                    _status = status;
                    return (_price, _status, false);
                }

                // if Chainlink is frozen and Tellor is working, keep using Tellor (no status change)
                _price = _scaleTellorPriceByDigits(tellorResponse.value);
                _status = status;
                return (_price, _status, false);
            }

            // if Chainlink is live and Tellor is broken, remember Tellor broke, and return Chainlink price
            if (_tellorIsBroken(tellorResponse)) {
                // _changeStatus(Status.usingChainlinkTellorUntrusted);
                _price = _scaleChainlinkPriceByDigits(
                    uint256(chainlinkResponse.answer),
                    chainlinkResponse.decimals
                );
                _status = Status.usingChainlinkTellorUntrusted;
                return (_price, _status, false);
            }

            // If Chainlink is live and Tellor is frozen, just use last good price (no status change) since we have no basis for comparison
            if (_tellorIsFrozen(tellorResponse)) {
                _price = lastGoodPrice;
                _status = status;
                return (_price, _status, false);
            }

            // If Chainlink is live and Tellor is working, compare prices. Switch to Chainlink
            // if prices are within 5%, and return Chainlink price.
            if (_bothOraclesSimilarPrice(chainlinkResponse, tellorResponse)) {
                // _changeStatus(Status.chainlinkWorking);
                _price = _scaleChainlinkPriceByDigits(
                    uint256(chainlinkResponse.answer),
                    chainlinkResponse.decimals
                );
                _status = Status.chainlinkWorking;
                return (_price, _status, false);
            }

            // Otherwise if Chainlink is live but price not within 5% of Tellor, distrust Chainlink, and return Tellor price
            // _changeStatus(Status.usingTellorChainlinkUntrusted);
            _price = _scaleTellorPriceByDigits(tellorResponse.value);
            _status = Status.usingTellorChainlinkUntrusted;
            return (_price, _status, false);
        }

        // --- CASE 5: Using Chainlink, Tellor is untrusted ---
        if (status == Status.usingChainlinkTellorUntrusted) {
            // If Chainlink breaks, now both oracles are untrusted
            if (_chainlinkIsBroken(chainlinkResponse, prevChainlinkResponse)) {
                // _changeStatus(Status.bothOraclesUntrusted);
                _price = lastGoodPrice;
                _status = Status.bothOraclesUntrusted;
                return (_price, _status, false);
            }

            // If Chainlink is frozen, return last good price (no status change)
            if (_chainlinkIsFrozen(chainlinkResponse)) {
                _price = lastGoodPrice;
                _status = status;
                return (_price, _status, false);
            }

            // If Chainlink and Tellor are both live, unbroken and similar price, switch back to chainlinkWorking and return Chainlink price
            if (
                _bothOraclesLiveAndUnbrokenAndSimilarPrice(
                    chainlinkResponse,
                    prevChainlinkResponse,
                    tellorResponse
                )
            ) {
                // _changeStatus(Status.chainlinkWorking);
                _price = _scaleChainlinkPriceByDigits(
                    uint256(chainlinkResponse.answer),
                    chainlinkResponse.decimals
                );
                _status = Status.chainlinkWorking;
                return (_price, _status, false);
            }

            // If Chainlink is live but deviated >50% from it's previous price and Tellor is still untrusted, switch
            // to bothOraclesUntrusted and return last good price
            if (
                _chainlinkPriceChangeAboveMax(
                    chainlinkResponse,
                    prevChainlinkResponse
                )
            ) {
                // _changeStatus(Status.bothOraclesUntrusted);
                _price = lastGoodPrice;
                _status = Status.bothOraclesUntrusted;
                return (_price, _status, false);
            }

            // Otherwise if Chainlink is live and deviated <50% from it's previous price and Tellor is still untrusted,
            // return Chainlink price (no status change)

            _price = _scaleChainlinkPriceByDigits(
                uint256(chainlinkResponse.answer),
                chainlinkResponse.decimals
            );
            _status = status;
            return (_price, _status, false);
        }
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
        ChainlinkResponse memory _currentResponse,
        ChainlinkResponse memory _prevResponse
    ) internal view returns (bool) {
        return
            _badChainlinkResponse(_currentResponse) ||
            _badChainlinkResponse(_prevResponse);
    }

    function _badChainlinkResponse(
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
        return block.timestamp - _response.timestamp > TIMEOUT;
    }

    function _chainlinkPriceChangeAboveMax(
        ChainlinkResponse memory _currentResponse,
        ChainlinkResponse memory _prevResponse
    ) internal pure returns (bool) {
        uint256 currentScaledPrice = _scaleChainlinkPriceByDigits(
            uint256(_currentResponse.answer),
            _currentResponse.decimals
        );
        uint256 prevScaledPrice = _scaleChainlinkPriceByDigits(
            uint256(_prevResponse.answer),
            _prevResponse.decimals
        );

        uint256 minPrice = LiquityMath._min(
            currentScaledPrice,
            prevScaledPrice
        );
        uint256 maxPrice = LiquityMath._max(
            currentScaledPrice,
            prevScaledPrice
        );

        /*
         * Use the larger price as the denominator:
         * - If price decreased, the percentage deviation is in relation to the the previous price.
         * - If price increased, the percentage deviation is in relation to the current price.
         */
        uint256 percentDeviation = ((maxPrice - minPrice) * DECIMAL_PRECISION) /
            maxPrice;

        // Return true if price has more than doubled, or more than halved.
        return percentDeviation > MAX_PRICE_DEVIATION_FROM_PREVIOUS_ROUND;
    }

    /// @notice internal logic of tellor mulfunctioning flag
    function _tellorIsBroken(
        TellorResponse memory _response
    ) internal view returns (bool) {
        // Check for response call reverted
        if (!_response.success) {
            return true;
        }
        // Check for an invalid timeStamp that is 0, or in the future
        if (_response.timestamp == 0 || _response.timestamp > block.timestamp) {
            return true;
        }
        // Check for zero price
        if (_response.value == 0) {
            return true;
        }

        return false;
    }

    /// @notice internal logic of tellor stopping flag
    function _tellorIsFrozen(
        TellorResponse memory _tellorResponse
    ) internal view returns (bool) {
        return block.timestamp - _tellorResponse.timestamp > TIMEOUT;
    }

    /// @notice Recovery logic of malfunctioning oracles
    function _bothOraclesLiveAndUnbrokenAndSimilarPrice(
        ChainlinkResponse memory _chainlinkResponse,
        ChainlinkResponse memory _prevChainlinkResponse,
        TellorResponse memory _tellorResponse
    ) internal view returns (bool) {
        // Return false if either oracle is broken or frozen
        if (
            _tellorIsBroken(_tellorResponse) ||
            _tellorIsFrozen(_tellorResponse) ||
            _chainlinkIsBroken(_chainlinkResponse, _prevChainlinkResponse) ||
            _chainlinkIsFrozen(_chainlinkResponse)
        ) {
            return false;
        }

        return _bothOraclesSimilarPrice(_chainlinkResponse, _tellorResponse);
    }

    /// @notice Price comparison logic of the two oracles.
    function _bothOraclesSimilarPrice(
        ChainlinkResponse memory _chainlinkResponse,
        TellorResponse memory _tellorResponse
    ) internal pure returns (bool) {
        uint256 scaledChainlinkPrice = _scaleChainlinkPriceByDigits(
            uint256(_chainlinkResponse.answer),
            _chainlinkResponse.decimals
        );
        uint256 scaledTellorPrice = _scaleTellorPriceByDigits(
            _tellorResponse.value
        );

        // Get the relative price difference between the oracles. Use the lower price as the denominator, i.e. the reference for the calculation.
        uint256 minPrice = LiquityMath._min(
            scaledTellorPrice,
            scaledChainlinkPrice
        );
        uint256 maxPrice = LiquityMath._max(
            scaledTellorPrice,
            scaledChainlinkPrice
        );
        uint256 percentPriceDifference = ((maxPrice - minPrice) *
            DECIMAL_PRECISION) / minPrice;

        /*
         * Return true if the relative price difference is <= 3%: if so, we assume both oracles are probably reporting
         * the honest market price, as it is unlikely that both have been broken/hacked and are still in-sync.
         */
        return percentPriceDifference <= MAX_PRICE_DIFFERENCE_BETWEEN_ORACLES;
    }

    /// @notice Price comparison between currenct latest price and tellor
    function _tellorAndLastGoodPriceSimilarPrice(
        TellorResponse memory _tellorResponse
    ) internal view returns (bool) {
        uint256 scaledTellorPrice = _scaleTellorPriceByDigits(
            _tellorResponse.value
        );
        uint256 minPrice = LiquityMath._min(scaledTellorPrice, lastGoodPrice);
        uint256 maxPrice = LiquityMath._max(scaledTellorPrice, lastGoodPrice);
        uint256 percentPriceDifference = ((maxPrice - minPrice) *
            DECIMAL_PRECISION) / minPrice;
        return
            percentPriceDifference <=
            MAX_PRICE_DIFFERENCE_FOR_TELLOR_ADJUSTMENT;
    }

    /// @notice A drastic change mitigator which is not implemented in Liquity's PriceFeed
    function _safeUsingTellorOrGracefulAdjustment(
        TellorResponse memory _tellorResponse,
        Status _inheritedStatus
    ) internal view returns (uint256 _price, Status _status, bool _isAdjusted) {
        if (
            _tellorAndLastGoodPriceSimilarPrice(_tellorResponse) == false &&
            /* CL is broken and Tellor is far away! Danger zone! */
            (lastAdjusted == 0 ||
                lastAdjusted + ADJUSTMENT_COOLTIME < block.number)
        ) {
            _price =
                (lastGoodPrice *
                    (1e18 + MAX_PRICE_DIFFERENCE_FOR_TELLOR_ADJUSTMENT)) /
                1e18;
            _status = Status.bothOraclesUntrusted;
            _isAdjusted = true;
        } else if (
            _tellorAndLastGoodPriceSimilarPrice(_tellorResponse) == false &&
            /* CL is broken and Tellor is far away! Danger zone! */
            (lastAdjusted == 0 ||
                lastAdjusted + ADJUSTMENT_COOLTIME >= block.number)
        ) {
            // Note: It means, adjusted once, and tried "fetchPrice" again.
            //       Must use lastGoodPrice, not Tellor's potentially-fructuated price.
            _price = lastGoodPrice;
            _status = _inheritedStatus;
            _isAdjusted = false; // Note: Don't update "lastAdjusted".
        } else {
            _price = _scaleTellorPriceByDigits(_tellorResponse.value);
            _status = _inheritedStatus;
            _isAdjusted = false;
        }
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

    /// @notice Internal calculator of Tellor digits padding.
    function _scaleTellorPriceByDigits(
        uint256 _price
    ) internal pure returns (uint256 price) {
        return price = _price * (10 ** (TARGET_DIGITS - TELLOR_DIGITS));
    }

    /// @notice Internal status changer.
    function _changeStatus(Status _status) internal {
        status = _status;
        emit PriceFeedStatusChanged(_status);
    }

    /// @notice Internal price changer.
    function _storePrice(uint256 _currentPrice) internal {
        lastGoodPrice = _currentPrice;
        lastSeen = block.number;
        emit LastGoodPriceUpdated(_currentPrice);
    }

    /// @notice Internal price changer with digits calc.
    function _storeTellorPrice(
        TellorResponse memory _tellorResponse
    ) internal returns (uint256) {
        uint256 scaledTellorPrice = _scaleTellorPriceByDigits(
            _tellorResponse.value
        );
        _storePrice(scaledTellorPrice);

        return scaledTellorPrice;
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

    /// @notice Tellor oracle response wrapper
    function _getCurrentTellorResponse()
        internal
        view
        returns (TellorResponse memory tellorResponse)
    {
        try
            ITellorCaller(tellorCaller()).getTellorCurrentValue(
                ETHUSD_TELLOR_REQ_ID
            )
        returns (bool ifRetrieve, uint256 value, uint256 _timestampRetrieved) {
            // If call to Tellor succeeds, return the response and success = true
            tellorResponse.ifRetrieve = ifRetrieve;
            tellorResponse.value = value;
            tellorResponse.timestamp = _timestampRetrieved;
            tellorResponse.success = true;

            return (tellorResponse);
        } catch {
            // If call to Tellor reverts, return a zero response with success = false
            return (tellorResponse);
        }
    }

    /// @notice ChainLink oracle response wrapper
    function _getCurrentChainlinkResponse()
        internal
        view
        returns (ChainlinkResponse memory chainlinkResponse)
    {
        ChainlinkResponse memory ethChainlinkResponseInUSD;
        ChainlinkResponse memory jpyChainlinkResponseInUSD;
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
        try
            AggregatorV3Interface(jpyPriceAggregatorInUSD()).decimals()
        returns (uint8 decimals) {
            // If call to Chainlink succeeds, record the current decimal precision
            jpyChainlinkResponseInUSD.decimals = decimals;
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
        try
            AggregatorV3Interface(jpyPriceAggregatorInUSD()).latestRoundData()
        returns (
            uint80 roundId,
            int256 answer,
            uint256 /* startedAt */,
            uint256 timestamp,
            uint80 /* answeredInRound */
        ) {
            // If call to Chainlink succeeds, return the response and success = true
            jpyChainlinkResponseInUSD.roundId = roundId;
            jpyChainlinkResponseInUSD.answer = answer;
            jpyChainlinkResponseInUSD.timestamp = timestamp;
            jpyChainlinkResponseInUSD.success = true;
        } catch {
            // If call to Chainlink aggregator reverts, return a zero response with success = false
            return chainlinkResponse;
        }

        chainlinkResponse.roundId = ethChainlinkResponseInUSD.roundId;
        chainlinkResponse.decimals = uint8(TARGET_DIGITS); // Note: 0xMotoko at Mar 3, 2022. dec=18 was wrong here
        // chainlinkResponse.decimals = uint8(ETHUSD_DIGITS);
        chainlinkResponse.answer = int256(
            (uint256(ethChainlinkResponseInUSD.answer) *
                (10 **
                    (TARGET_DIGITS -
                        ethChainlinkResponseInUSD.decimals +
                        jpyChainlinkResponseInUSD.decimals))) /
                uint256(jpyChainlinkResponseInUSD.answer)
        );
        chainlinkResponse.timestamp = ethChainlinkResponseInUSD.timestamp;
        chainlinkResponse.success = true;
        chainlinkResponse.subAnswer = jpyChainlinkResponseInUSD.answer; // TODO: What if JPYUSD changes a lot since the last ETHUSD feed round? (No way...)
        chainlinkResponse.subDecimal = jpyChainlinkResponseInUSD.decimals;
        return chainlinkResponse;
    }

    /// @notice ChainLink's older oracle response wrapper
    function _getPrevChainlinkResponse(
        uint80 _currentRoundId,
        uint8 _currentDecimals,
        int256 _jpyInUSD,
        uint8 _jpyOracleDecimals
    ) internal view returns (ChainlinkResponse memory prevChainlinkResponse) {
        /*
         * NOTE: Chainlink only offers a current decimals() value - there is no way to obtain the decimal precision used in a
         * previous round.  We assume the decimals used in the previous round are the same as the current round.
         */

        // Try to get the price data from the previous round:
        try
            AggregatorV3Interface(ethPriceAggregatorInUSD()).getRoundData(
                _currentRoundId - 1
            )
        returns (
            uint80 roundId,
            int256 answer,
            uint256 /* startedAt */,
            uint256 timestamp,
            uint80 /* answeredInRound */
        ) {
            // If call to Chainlink succeeds, return the response and success = true
            prevChainlinkResponse.roundId = roundId;
            prevChainlinkResponse.answer = int256(
                (uint256(answer) *
                    (10 **
                        (TARGET_DIGITS -
                            _currentDecimals +
                            _jpyOracleDecimals))) / uint256(_jpyInUSD)
            );
            prevChainlinkResponse.timestamp = timestamp;
            // prevChainlinkResponse.decimals = _currentDecimals; // Note: 0xMotoko at Mar 3, 2022. dec=18?
            prevChainlinkResponse.decimals = uint8(TARGET_DIGITS);
            prevChainlinkResponse.success = true;
            return prevChainlinkResponse;
        } catch {
            // If call to Chainlink aggregator reverts, return a zero response with success = false
            return prevChainlinkResponse;
        }
    }
}
