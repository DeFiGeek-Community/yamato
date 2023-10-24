// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title Curve DAO Token
/// @notice ERC20 with piecewise-linear mining supply.
contract CRV is ERC20 {
    event UpdateMiningParameters(uint256 time, uint256 rate, uint256 supply);
    event SetMinter(address minter);
    event SetAdmin(address admin);

    address public minter;
    address public admin;

    // General constants
    uint256 constant YEAR = 365 days;

    // Allocation:
    // =========
    // * shareholders - 30%
    // * emplyees - 3%
    // * DAO-controlled reserve - 5%
    // * Early users - 5%
    // == 43% ==
    // left for inflation: 57%

    // Supply parameters
    uint256 constant INITIAL_SUPPLY = 1_303_030_303;
    uint256 constant INITIAL_RATE = (274_815_283 * 10 ** 18) / YEAR; // leading to 43% premine
    uint256 constant RATE_REDUCTION_TIME = YEAR;
    uint256 constant RATE_REDUCTION_COEFFICIENT = 1189207115002721024; // 2 ** (1/4) * 1e18
    uint256 constant RATE_DENOMINATOR = 10 ** 18;
    uint256 constant INFLATION_DELAY = 1 days;

    // Supply variables
    int128 public mining_epoch;
    uint256 public start_epoch_time;
    uint256 public rate;

    uint256 start_epoch_supply;

    constructor() ERC20("Curve", "CRV") {
        uint256 init_supply = INITIAL_SUPPLY * 10 ** decimals();
        _mint(msg.sender, init_supply);

        admin = msg.sender;

        start_epoch_time =
            block.timestamp +
            INFLATION_DELAY -
            RATE_REDUCTION_TIME;
        mining_epoch = -1;
        rate = 0;
        start_epoch_supply = init_supply;
    }

    // @dev Update mining rate and supply at the start of the epoch
    //      Any modifying mining call must also call this
    function _update_mining_parameters() internal {
        uint256 _rate = rate;
        uint256 _start_epoch_supply = start_epoch_supply;

        start_epoch_time += RATE_REDUCTION_TIME;
        mining_epoch += 1;

        if (_rate == 0) {
            _rate = INITIAL_RATE;
        } else {
            _start_epoch_supply += _rate * RATE_REDUCTION_TIME;
            start_epoch_supply = _start_epoch_supply;
            _rate = (_rate * RATE_DENOMINATOR) / RATE_REDUCTION_COEFFICIENT;
        }

        rate = _rate;

        emit UpdateMiningParameters(
            block.timestamp,
            _rate,
            _start_epoch_supply
        );
    }

    // @notice Update mining rate and supply at the start of the epoch
    // @dev Callable by any address, but only once per epoch
    //      Total supply becomes slightly larger if(this function is called late
    function update_mining_parameters() external {
        require(block.timestamp >= start_epoch_time + RATE_REDUCTION_TIME); // dev: too soon!
        _update_mining_parameters();
    }

    // @notice Get timestamp of the current mining epoch start
    //         while simultaneously updating mining parameters
    // @return Timestamp of the epoch
    function start_epoch_time_write() external returns (uint256) {
        uint256 _start_epoch_time = start_epoch_time;
        if (block.timestamp >= _start_epoch_time + RATE_REDUCTION_TIME) {
            _update_mining_parameters();
            return start_epoch_time;
        } else {
            return _start_epoch_time;
        }
    }

    // @notice Get timestamp of the next mining epoch start
    //         while simultaneously updating mining parameters
    // @return Timestamp of the next epoch
    function future_epoch_time_write() external returns (uint256) {
        uint256 _start_epoch_time = start_epoch_time;
        if (block.timestamp >= _start_epoch_time + RATE_REDUCTION_TIME) {
            _update_mining_parameters();
            return start_epoch_time + RATE_REDUCTION_TIME;
        } else {
            return _start_epoch_time + RATE_REDUCTION_TIME;
        }
    }

    function _available_supply() internal view returns (uint256) {
        return start_epoch_supply + (block.timestamp - start_epoch_time) * rate;
    }

    // @notice Current number of tokens in existence (claimed or unclaimed)
    function available_supply() external view returns (uint256) {
        return _available_supply();
    }

    // @notice How much supply is mintable from start timestamp till end timestamp
    // @param start Start of the time interval (timestamp)
    // @param end End of the time interval (timestamp)
    // @return Tokens mintable from `start` till `end`
    function mintable_in_timeframe(
        uint256 start,
        uint256 end
    ) external view returns (uint256) {
        require(start <= end); // dev: start > end
        uint256 to_mint = 0;
        uint256 current_epoch_time = start_epoch_time;
        uint256 current_rate = rate;

        // Special case if(end is in future (not yet minted) epoch
        if (end > current_epoch_time + RATE_REDUCTION_TIME) {
            current_epoch_time += RATE_REDUCTION_TIME;
            current_rate =
                (current_rate * RATE_DENOMINATOR) /
                RATE_REDUCTION_COEFFICIENT;
        }

        require(end <= current_epoch_time + RATE_REDUCTION_TIME); // dev: too far in future

        // Curve will not work in 1000 years. Darn!
        for (uint i; i < 999; ) {
            if (end >= current_epoch_time) {
                uint256 current_end = end;
                if (current_end > current_epoch_time + RATE_REDUCTION_TIME) {
                    current_end = current_epoch_time + RATE_REDUCTION_TIME;
                }

                uint256 current_start = start;
                if (current_start >= current_epoch_time + RATE_REDUCTION_TIME) {
                    break; // We should never get here but what if...
                } else if (current_start < current_epoch_time) {
                    current_start = current_epoch_time;
                }
                to_mint += current_rate * (current_end - current_start);
                if (start >= current_epoch_time) {
                    break;
                }
            }

            current_epoch_time -= RATE_REDUCTION_TIME;
            current_rate =
                (current_rate * RATE_REDUCTION_COEFFICIENT) /
                RATE_DENOMINATOR; // double-division with rounding made rate a bit less => good
            require(current_rate <= INITIAL_RATE); // This should never happen

            unchecked {
                i++;
            }
        }

        return to_mint;
    }

    // @notice Set the minter address
    // @dev Only callable once, when minter has not yet been set
    // @param _minter Address of the minter
    function set_minter(address _minter) external {
        require(msg.sender == admin); // dev: admin only
        require(minter == address(0)); // dev: can set the minter only once, at creation
        minter = _minter;
        emit SetMinter(_minter);
    }

    // @notice Set the new admin.
    // @dev After all is set up, admin only can change the token name
    // @param _admin New admin address
    function set_admin(address _admin) external {
        require(msg.sender == admin); // dev: admin only
        admin = _admin;
        emit SetAdmin(_admin);
    }

    // @notice Mint `_value` tokens and assign them to `_to`
    // @dev Emits a Transfer event originating from 0x00
    // @param _to The account that will receive the created tokens
    // @param _value The amount that will be created
    // @return bool success
    function mint(address _to, uint256 _value) external returns (bool) {
        require(msg.sender == minter); // dev: minter only
        require(_to != address(0)); // dev: zero address

        if (block.timestamp >= start_epoch_time + RATE_REDUCTION_TIME) {
            _update_mining_parameters();
        }

        _mint(_to, _value);

        return true;
    }
}