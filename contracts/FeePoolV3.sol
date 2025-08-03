pragma solidity ^0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2024 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "./Interfaces/IveYMT.sol";
import "./Interfaces/IFeePoolV2.sol";
import "./Dependencies/UUPSBase.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract FeePoolV3 is IFeePoolV2, UUPSBase, ReentrancyGuardUpgradeable {
    uint256 public constant WEEK = 7 * 86400;
    uint256 public constant TOKEN_CHECKPOINT_DEADLINE = 86400;

    string constant VEYMT_SLOT_ID = "deps.veYMT";

    // This variable is currently not in use
    mapping(address => bool) protocolWhitelist;

    // This variable is in use
    uint256 public startTime;
    uint256 public timeCursor;
    mapping(address => uint256) public timeCursorOf;
    mapping(address => uint256) public userEpochOf;

    uint256 public lastTokenTime;
    mapping(uint256 => uint256) public tokensPerWeek;

    uint256 public tokenLastBalance;

    mapping(uint256 => uint256) public veSupply; // VE total supply at week bounds

    bool public canCheckpointToken;
    bool public isKilled;

    // 週ごとの確定状態を管理
    mapping(uint256 => bool) public weekFinalized;
    mapping(uint256 => uint256) public finalizedVeSupply;
    mapping(address => mapping(uint256 => uint256)) public finalizedUserBalance;

    event ToggleAllowCheckpointToken(bool toggleFlag);
    event CheckpointToken(uint256 time, uint256 tokens);
    event Claimed(
        address indexed recipient,
        uint256 amount,
        uint256 claimEpoch,
        uint256 maxEpoch
    );
    event Received(address sender, uint256 value);
    event VeYMTSet(address sender, address veYMT);
    event WeekFinalized(uint256 week, uint256 veSupply);

    function initialize() public initializer {
        __UUPSBase_init();
        __ReentrancyGuard_init();
    }

    /**
     * @param startTime_ Epoch time for fee distribution to start
     */
    function initializeV2(uint256 startTime_) public reinitializer(2) {
        uint256 t = (startTime_ / WEEK) * WEEK;
        startTime = t;
        lastTokenTime = t;
        timeCursor = t;
    }

    /**
     * @dev Calculates and distributes tokens for the current week based on the balance changes.
     *      It updates the `lastTokenTime` to the current block timestamp and adjusts the
     *      `tokensPerWeek` mapping to reflect the tokens distributed for this checkpoint.
     */
    function _checkpointToken() internal {
        uint256 _tokenBalance = address(this).balance;
        uint256 _toDistribute = _tokenBalance - tokenLastBalance;
        tokenLastBalance = _tokenBalance;

        uint256 _t = lastTokenTime;
        uint256 _sinceLast = block.timestamp - _t;
        lastTokenTime = block.timestamp;
        uint256 _thisWeek = (_t / WEEK) * WEEK;
        uint256 _nextWeek;

        for (uint256 i; i < 20; ) {
            _nextWeek = _thisWeek + WEEK;
            if (block.timestamp < _nextWeek) {
                if (_sinceLast == 0 && block.timestamp == _t) {
                    tokensPerWeek[_thisWeek] += _toDistribute;
                } else {
                    tokensPerWeek[_thisWeek] +=
                        (_toDistribute * (block.timestamp - _t)) /
                        _sinceLast;
                }
                break;
            } else {
                if (_sinceLast == 0 && _nextWeek == _t) {
                    tokensPerWeek[_thisWeek] += _toDistribute;
                } else {
                    tokensPerWeek[_thisWeek] +=
                        (_toDistribute * (_nextWeek - _t)) /
                        _sinceLast;
                }
            }
            _t = _nextWeek;
            _thisWeek = _nextWeek;
            unchecked {
                ++i;
            }
        }

        emit CheckpointToken(block.timestamp, _toDistribute);
    }

    /**
     * @notice Update the token checkpoint
     * @dev Calculates the total number of tokens to be distributed in a given week.
         During setup for the initial distribution this function is only callable
         by the contract owner. Beyond initial distro, it can be enabled for anyone
         to call.
     */
    function checkpointToken() external {
        require(
            msg.sender == governance ||
                (canCheckpointToken &&
                    block.timestamp >
                    lastTokenTime + TOKEN_CHECKPOINT_DEADLINE),
            "Unauthorized"
        );
        _checkpointToken();
    }

    /**
     * @dev Performs a binary search to find the applicable epoch for the given timestamp.
     * @param ve_ Address of the voting escrow contract.
     * @param timestamp_ The timestamp to find the epoch for.
     * @return The epoch index that corresponds to the given timestamp.
     */
    function _findTimestampEpoch(
        address ve_,
        uint256 timestamp_
    ) internal view returns (uint256) {
        uint256 _min;
        uint256 _max = IveYMT(ve_).epoch();

        unchecked {
            for (uint256 i; i < 128; ++i) {
                if (_min >= _max) {
                    break;
                }
                uint256 _mid = (_min + _max + 2) / 2;
                IveYMT.Point memory _pt = IveYMT(ve_).pointHistory(_mid);
                if (_pt.ts <= timestamp_) {
                    _min = _mid;
                } else {
                    _max = _mid - 1;
                }
            }
        }
        return _min;
    }

    function _findTimestampUserEpoch(
        address ve_,
        address user_,
        uint256 timestamp_,
        uint256 maxUserEpoch_
    ) internal view returns (uint256) {
        uint256 _min;
        uint256 _max = maxUserEpoch_;

        unchecked {
            for (uint256 i; i < 128; ++i) {
                if (_min >= _max) {
                    break;
                }
                uint256 _mid = (_min + _max + 2) / 2;
                IveYMT.Point memory _pt = IveYMT(ve_).userPointHistory(
                    user_,
                    _mid
                );
                if (_pt.ts <= timestamp_) {
                    _min = _mid;
                } else {
                    _max = _mid - 1;
                }
            }
        }
        return _min;
    }

    /**
     * @notice Get the veYMT balance for `user_` at `timestamp_`
     * @param user_ Address to query balance for
     * @param timestamp_ Epoch time
     * @return uint256 veYMT balance
     */
    function veForAt(
        address user_,
        uint256 timestamp_
    ) public view returns (uint256) {
        address _ve = veYMT();
        uint256 _maxUserEpoch = IveYMT(_ve).userPointEpoch(user_);
        uint256 _epoch = _findTimestampUserEpoch(
            _ve,
            user_,
            timestamp_,
            _maxUserEpoch
        );
        IveYMT.Point memory _pt = IveYMT(_ve).userPointHistory(user_, _epoch);
        int128 _balance = _pt.bias -
            _pt.slope *
            int128(int256(timestamp_ - _pt.ts));
        if (_balance < 0) {
            return 0;
        } else {
            return uint256(uint128(_balance));
        }
    }

    function _getTotalSupplyAt(uint256 timestamp_) internal view returns (uint256) {
        address _ve = veYMT();
        uint256 _epoch = _findTimestampEpoch(_ve, timestamp_);
        IveYMT.Point memory _pt = IveYMT(_ve).pointHistory(_epoch);
        
        uint256 _dt;
        if (timestamp_ > _pt.ts) {
            _dt = timestamp_ - _pt.ts;
        }
        
        int128 _balance = _pt.bias - _pt.slope * int128(int256(_dt));
        if (_balance < 0) {
            return 0;
        } else {
            return uint256(uint128(_balance));
        }
    }


    function _checkpointTotalSupply() internal {
        address _ve = veYMT();
        uint256 _t = timeCursor;
        uint256 _currentWeek = (block.timestamp / WEEK) * WEEK;
        IveYMT(_ve).checkpoint();

        for (uint256 i; i < 20; ) {
            if (_t >= _currentWeek) break; // 現在の週は確定しない
            
            if (!weekFinalized[_t]) {
                // 週の終了時点でのtotalSupplyを記録
                uint256 weekEndTimestamp = _t + WEEK - 1;
                
                // finalizedVeSupplyを使用して一度だけ計算
                if (finalizedVeSupply[_t] == 0) {
                    finalizedVeSupply[_t] = _getTotalSupplyAt(_t + WEEK - 1);
                }
                veSupply[_t] = finalizedVeSupply[_t];
                
                weekFinalized[_t] = true;
                emit WeekFinalized(_t, veSupply[_t]);
            }
            
            _t += WEEK;
            unchecked { ++i; }
        }
        
        timeCursor = _t;
    }

    /**
     * @notice Update the veYMT total supply checkpoint
     * @dev The checkpoint is also updated by the first claimant each new epoch week. This function may be called independently of a claim, to reduce claiming gas costs.
     */
    function checkpointTotalSupply() external {
        _checkpointTotalSupply();  // 内部関数を呼び出すだけにする
    }

    function _claim(
        address addr_,
        address ve_,
        uint256 lastTokenTime_
    ) internal returns (uint256) {
        uint256 _toDistribute;
        uint256 _startTime = startTime;
        uint256 _currentWeek = (block.timestamp / WEEK) * WEEK;

        uint256 _weekCursor = timeCursorOf[addr_];
        if (_weekCursor == 0) {
            _weekCursor = _startTime;
        }

        for (uint256 i; i < 50; ) {
            // 現在の週より前の週のみ処理
            if (_weekCursor >= _currentWeek || _weekCursor >= lastTokenTime_) {
                break;
            }
            
            // 週が確定していることを確認
            require(weekFinalized[_weekCursor], "Week not finalized");
            
            // 週の終了時点での残高を使用
            uint256 userBalance = finalizedUserBalance[addr_][_weekCursor];
            if (userBalance == 0) {
                // veForAtを使用して正しい過去の残高を取得
                userBalance = veForAt(addr_, _weekCursor + WEEK - 1);

                finalizedUserBalance[addr_][_weekCursor] = userBalance;
            }
            
            if (userBalance > 0 && veSupply[_weekCursor] > 0) {
                _toDistribute += 
                    (userBalance * tokensPerWeek[_weekCursor]) / 
                    veSupply[_weekCursor];
            }
            
            _weekCursor += WEEK;
            unchecked { ++i; }
        }

        timeCursorOf[addr_] = _weekCursor;
        emit Claimed(addr_, _toDistribute, 0, 0);
        return _toDistribute;
    }

    /**
     * @notice Claim fees for `msg.sender`
     * @dev Each call to claim look at a maximum of 50 user veYMT points.
         For accounts with many veYMT related actions, this function
         may need to be called more than once to claim all available
         fees. In the `Claimed` event that fires, if `claim_epoch` is
         less than `max_epoch`, the account may claim again.
     * @return uint256 Amount of fees claimed in the call
     */
    function claim() external nonReentrant returns (uint256) {
        require(!isKilled, "Contract is killed");
        address _addr = msg.sender;
        if (block.timestamp >= timeCursor) {
            _checkpointTotalSupply();
        }

        uint256 _lastTokenTime = lastTokenTime;

        if (
            canCheckpointToken &&
            (block.timestamp > _lastTokenTime + TOKEN_CHECKPOINT_DEADLINE)
        ) {
            _checkpointToken();
            _lastTokenTime = block.timestamp;
        }

        unchecked {
            _lastTokenTime = (_lastTokenTime / WEEK) * WEEK;
        }

        uint256 _amount = _claim(_addr, veYMT(), _lastTokenTime);
        if (_amount != 0) {
            (bool success, ) = payable(_addr).call{value: _amount}("");
            require(success, "Transfer failed");
            tokenLastBalance -= _amount;
        }

        return _amount;
    }

    /**
     * @notice Claim fees for `addr_`
     * @dev Each call to claim look at a maximum of 50 user veYMT points.
         For accounts with many veYMT related actions, this function
         may need to be called more than once to claim all available
         fees. In the `Claimed` event that fires, if `claim_epoch` is
         less than `max_epoch`, the account may claim again.
     * @param addr_ Address to claim fees for
     * @return uint256 Amount of fees claimed in the call
     */
    function claim(address addr_) external nonReentrant returns (uint256) {
        require(!isKilled, "Contract is killed");

        if (block.timestamp >= timeCursor) {
            _checkpointTotalSupply();
        }

        uint256 _lastTokenTime = lastTokenTime;

        if (
            canCheckpointToken &&
            (block.timestamp > _lastTokenTime + TOKEN_CHECKPOINT_DEADLINE)
        ) {
            _checkpointToken();
            _lastTokenTime = block.timestamp;
        }

        unchecked {
            _lastTokenTime = (_lastTokenTime / WEEK) * WEEK;
        }

        uint256 amount = _claim(addr_, veYMT(), _lastTokenTime);
        if (amount != 0) {
            (bool success, ) = payable(addr_).call{value: amount}("");
            require(success, "Transfer failed");
            tokenLastBalance -= amount;
        }

        return amount;
    }

    /**
     * @notice Makes multiple fee claims in a single transaction.
     * @dev Can be used to claim fees for multiple accounts in one call. Processing stops
     *      when an address zero is encountered in the `receivers_` array.
     * @param receivers_ List of addresses to claim fees for.
     * @return True if the operation was successful.
     */
    function claimMany(
        address[] memory receivers_
    ) external nonReentrant returns (bool) {
        require(!isKilled, "Contract is killed");

        if (block.timestamp >= timeCursor) {
            _checkpointTotalSupply();
        }

        uint256 _lastTokenTime = lastTokenTime;

        if (
            canCheckpointToken &&
            (block.timestamp > _lastTokenTime + TOKEN_CHECKPOINT_DEADLINE)
        ) {
            _checkpointToken();
            _lastTokenTime = block.timestamp;
        }

        _lastTokenTime = (_lastTokenTime / WEEK) * WEEK;
        uint256 _total;
        uint256 _l = receivers_.length;
        for (uint256 i; i < _l; ) {
            address _addr = receivers_[i];
            if (_addr == address(0)) {
                break;
            }

            uint256 _amount = _claim(_addr, veYMT(), _lastTokenTime);
            if (_amount != 0) {
                (bool success, ) = payable(_addr).call{value: _amount}("");
                require(success, "Transfer failed");
                _total += _amount;
            }
            unchecked {
                ++i;
            }
        }

        if (_total != 0) {
            tokenLastBalance -= _total;
        }

        return true;
    }

    /**
     * @notice Toggle permission for checkpointing by any account
     */
    function toggleAllowCheckpointToken() external onlyGovernance {
        canCheckpointToken = !canCheckpointToken;
        emit ToggleAllowCheckpointToken(canCheckpointToken);
    }

    /**
     * @notice Kills the contract and sends the remaining balance to the governance address.
     * @dev Once killed, the contract's claim and distribution functions are disabled permanently.
     */
    function killMe() external onlyGovernance {
        isKilled = true;
        (bool success, ) = payable(governance).call{
            value: address(this).balance
        }("");
        require(success, "Transfer failed");
    }

    /**
     * @notice Recover native token from this contract
     * @dev Tokens are sent to the emergency return address.
     * @return bool success
     */
    function recoverBalance() external onlyGovernance returns (bool) {
        (bool success, ) = payable(governance).call{
            value: address(this).balance
        }("");
        require(success, "Transfer failed");
        return true;
    }

    function setVeYMT(address _veymt) public onlyGovernance {
        bytes32 VEYMT_KEY = bytes32(keccak256(abi.encode(VEYMT_SLOT_ID)));
        assembly {
            sstore(VEYMT_KEY, _veymt)
        }
        emit VeYMTSet(msg.sender, _veymt);
    }

    function veYMT() public view override returns (address _veYMT) {
        bytes32 VEYMT_KEY = bytes32(keccak256(abi.encode(VEYMT_SLOT_ID)));
        assembly {
            _veYMT := sload(VEYMT_KEY)
        }
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
        
        // 一定額以上の着金時のみチェックポイント（ガス節約）
        if (msg.value > 0) {
            // canCheckpointTokenがtrueの場合、または一定時間経過している場合
                _checkpointToken();
                _checkpointTotalSupply();
        }
    }
}
