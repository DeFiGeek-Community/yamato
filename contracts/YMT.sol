pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2023 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

/**
 * @title YMT Token
 * @notice Divident. Inflatable but the rate is to be decreasing.
 */
contract YMT is ERC20Permit {
    event UpdateMiningParameters(uint256 time, uint256 rate, uint256 supply);
    event SetMinter(address ymtMinter);
    event SetAdmin(address admin);

    address public ymtMinter;
    address public admin;

    // General constants
    uint256 constant YEAR = 365 days;

    // Supply parameters
    uint256 constant INITIAL_SUPPLY = 200_000_000 * 10 ** 18;
    uint256 constant VESTING_SUPPLY = 250_000_000 * 10 ** 18;
    uint256 constant INITIAL_RATE = (55_000_000 * 10 ** 18) / YEAR;
    uint256 constant RATE_REDUCTION_TIME = YEAR;
    uint256 constant RATE_REDUCTION_COEFFICIENT = 1_111_111_111_111_111_111;
    uint256 constant RATE_DENOMINATOR = 10 ** 18;
    uint256 constant INFLATION_DELAY = 1 days;

    // Supply variables
    int128 public miningEpoch;
    uint256 public startEpochTime;
    uint256 public rate;

    uint256 startEpochSupply;
    uint256 public startTime;

    constructor(
        address ymtVestingAddr
    ) ERC20Permit("Yamato") ERC20("Yamato", "YMT") {
        _mint(msg.sender, INITIAL_SUPPLY);
        _mint(ymtVestingAddr, VESTING_SUPPLY);

        admin = msg.sender;

        startEpochTime =
            block.timestamp +
            INFLATION_DELAY -
            RATE_REDUCTION_TIME;
        startTime = block.timestamp;
        miningEpoch = -1;
        rate = 0;
        startEpochSupply = INITIAL_SUPPLY + VESTING_SUPPLY;
    }

    /**
     * @dev Update mining rate and supply at the start of the epoch
     *      Any modifying mining call must also call this
     */
    function _updateMiningParameters() internal {
        uint256 _rate = rate;
        uint256 _startEpochSupply = startEpochSupply;

        startEpochTime += RATE_REDUCTION_TIME;
        ++miningEpoch;

        if (_rate == 0 && miningEpoch < 1) {
            _rate = INITIAL_RATE;
        } else {
            _startEpochSupply += _rate * RATE_REDUCTION_TIME;
            startEpochSupply = _startEpochSupply;
            _rate = (_rate * RATE_DENOMINATOR) / RATE_REDUCTION_COEFFICIENT;
        }

        rate = _rate;

        emit UpdateMiningParameters(block.timestamp, _rate, _startEpochSupply);
    }

    /**
     * @notice Update mining rate and supply at the start of the epoch
     * @dev Callable by any address, but only once per epoch
     *      Total supply becomes slightly larger if(this function is called late
     */
    function updateMiningParameters() external {
        require(
            block.timestamp >= startEpochTime + RATE_REDUCTION_TIME,
            "dev: too soon!"
        ); // dev: too soon!
        _updateMiningParameters();
    }

    /**
     * @notice Get timestamp of the current mining epoch start
     *         while simultaneously updating mining parameters
     * @return Timestamp of the epoch
     */
    function startEpochTimeWrite() external returns (uint256) {
        uint256 _startEpochTime = startEpochTime;
        if (block.timestamp >= _startEpochTime + RATE_REDUCTION_TIME) {
            _updateMiningParameters();
            return startEpochTime;
        } else {
            return _startEpochTime;
        }
    }

    /**
     * @notice Get timestamp of the next mining epoch start
     *         while simultaneously updating mining parameters
     * @return Timestamp of the next epoch
     */
    function futureEpochTimeWrite() external returns (uint256) {
        uint256 _startEpochTime = startEpochTime;
        if (block.timestamp >= _startEpochTime + RATE_REDUCTION_TIME) {
            _updateMiningParameters();
            return startEpochTime + RATE_REDUCTION_TIME;
        } else {
            return _startEpochTime + RATE_REDUCTION_TIME;
        }
    }

    function _availableSupply() internal view returns (uint256) {
        return startEpochSupply + (block.timestamp - startEpochTime) * rate;
    }

    // @notice Current number of tokens in existence (claimed or unclaimed)
    function availableSupply() external view returns (uint256) {
        return _availableSupply();
    }

    /**
     * @notice How much supply is mintable from start timestamp till end timestamp
     * @param start Start of the time interval (timestamp)
     * @param end End of the time interval (timestamp)
     * @return Tokens mintable from `start` till `end`
     */
    function mintableInTimeframe(
        uint256 start,
        uint256 end
    ) external view returns (uint256) {
        require(start <= end, "dev: start > end"); // dev: start > end
        uint256 to_mint = 0;
        uint256 currentEpochTime = startEpochTime;
        uint256 currentRate = rate;

        // Special case if(end is in future (not yet minted) epoch
        if (end > currentEpochTime + RATE_REDUCTION_TIME) {
            currentEpochTime += RATE_REDUCTION_TIME;
            currentRate =
                (currentRate * RATE_DENOMINATOR) /
                RATE_REDUCTION_COEFFICIENT;
        }

        require(
            end <= currentEpochTime + RATE_REDUCTION_TIME,
            "dev: too far in future"
        ); // dev: too far in future

        // Curve will not work in 1000 years. Darn!
        for (uint i; i < 999; ) {
            if (end >= currentEpochTime) {
                uint256 currentEnd = end;
                if (currentEnd > currentEpochTime + RATE_REDUCTION_TIME) {
                    currentEnd = currentEpochTime + RATE_REDUCTION_TIME;
                }

                uint256 currentStart = start;
                if (currentStart >= currentEpochTime + RATE_REDUCTION_TIME) {
                    break; // We should never get here but what if...
                } else if (currentStart < currentEpochTime) {
                    currentStart = currentEpochTime;
                }
                to_mint += currentRate * (currentEnd - currentStart);
                if (start >= currentEpochTime) {
                    break;
                }
            }

            currentEpochTime -= RATE_REDUCTION_TIME;
            currentRate =
                (currentRate * RATE_REDUCTION_COEFFICIENT) /
                RATE_DENOMINATOR; // double-division with rounding made rate a bit less => good
            require(currentRate <= INITIAL_RATE, "This should never happen"); // This should never happen

            unchecked {
                ++i;
            }
        }

        return to_mint;
    }

    /**
     * @notice Set the ymtMinter address
     * @dev Only callable once, when ymtMinter has not yet been set
     * @param _ymtMinter Address of the ymtMinter
     */
    function setMinter(address _ymtMinter) external onlyAdmin {
        require(
            _ymtMinter != address(0),
            "dev: can set the ymtMinter only once, at creation"
        ); // dev: can set the ymtMinter only once, at creation
        ymtMinter = _ymtMinter;
        emit SetMinter(_ymtMinter);
    }

    /**
     * @notice Set the new admin.
     * @dev After all is set up, admin only can change the token name
     * @param _admin New admin address
     */
    function setAdmin(address _admin) external onlyAdmin {
        admin = _admin;
        emit SetAdmin(_admin);
    }

    /**
     * @notice Mint `_value` tokens and assign them to `_to`
     * @dev Emits a Transfer event originating from 0x00
     * @param _to The account that will receive the created tokens
     * @param _value The amount that will be created
     * @return bool success
     */
    function mint(address _to, uint256 _value) external returns (bool) {
        require(msg.sender == ymtMinter, "dev: ymtMinter only"); // dev: ymtMinter only
        require(_to != address(0), "dev: zero address"); // dev: zero address

        if (block.timestamp >= startEpochTime + RATE_REDUCTION_TIME) {
            _updateMiningParameters();
        }
        require(
            totalSupply() + _value <= _availableSupply(),
            "dev: exceeds allowable mint amount"
        );

        _mint(_to, _value);

        return true;
    }

    /**
     * @notice Burn `_value` tokens belonging to `msg.sender`
     * @dev Emits a Transfer event with a destination of 0x00
     * @param _value The amount that will be burned
     * @return bool success
     */
    function burn(uint256 _value) external returns (bool) {
        _burn(msg.sender, _value);
        return true;
    }

    modifier onlyAdmin() {
        require(admin == msg.sender, "dev: admin only");
        _;
    }
}
