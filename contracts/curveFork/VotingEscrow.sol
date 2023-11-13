// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

// Voting escrow to have time-weighted votes
// Votes have a weight depending on time, so that users are committed
// to the future of (whatever they are voting for).
// The weight in this implementation is linear, and lock cannot be more than maxtime:
// w ^
// 1 +        /
//   |      /
//   |    /
//   |  /
//   |/
// 0 +--------+------> time
//       maxtime (4 years?)

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// Interface for checking whether address belongs to a whitelisted
// type of a smart wallet.
// When new types are added - the whole contract is changed
// The check() method is modifying to be able to use caching
// for individual wallet addresses
import "./interfaces/ISmartWalletChecker.sol";

contract VotingEscrow is ReentrancyGuard {
    struct Point {
        int128 bias;
        int128 slope; // - dweight / dt
        uint256 ts; //timestamp
        uint256 blk; // block
    }

    // We cannot really do block numbers per se b/c slope is per time, not per block
    // and per block could be fairly bad b/c Ethereum changes blocktimes.
    // What we can do is to extrapolate ***At functions
    struct LockedBalance {
        int128 amount;
        uint256 end;
    }

    uint128 private constant DEPOSIT_FOR_TYPE = 0;
    uint128 private constant CREATE_LOCK_TYPE = 1;
    uint128 private constant INCREASE_LOCK_AMOUNT = 2;
    uint128 private constant INCREASE_UNLOCK_TIME = 3;

    event CommitOwnership(address admin);
    event ApplyOwnership(address admin);
    event Deposit(
        address indexed provider,
        uint256 value,
        uint256 indexed locktime,
        uint128 _type,
        uint256 ts
    );
    event Withdraw(address indexed provider, uint256 value, uint256 ts);
    event Supply(uint256 prevSupply, uint256 supply);

    uint256 public constant WEEK = 7 * 86400; // all future times are rounded by week
    uint256 public constant MAXTIME = 4 * 365 * 86400; // 4 years
    uint256 public constant MULTIPLIER = 1e18;

    address public token;
    uint256 public supply;

    mapping(address => LockedBalance) public locked;

    //everytime user deposit/withdraw/change_locktime, these values will be updated;
    uint256 public epoch;

    mapping(uint256 => Point) public pointHistory; // epoch -> unsigned point.
    mapping(address => mapping(uint256 => Point)) public userPointHistory; // user -> Point[user_epoch]
    mapping(address => uint256) public userPointEpoch;
    mapping(uint256 => int128) public slopeChanges; // time -> signed slope change

    // Aragon's view methods for compatibility
    address public controller;
    bool public transfersEnabled;

    string public name;
    string public symbol;
    string public version;
    uint256 public decimals;

    // Checker for whitelisted (smart contract) wallets which are allowed to deposit
    // The goal is to prevent tokenizing the escrow
    address public futureSmartWalletChecker;
    address public smartWalletChecker;

    address public admin;
    address public futureAdmin;

    /***
     * @notice Contract constructor
     * @param tokenAddr_ `YMWK` token address
     * @param name_ Token name
     * @param symbol_ Token symbol
     * @param version_ Contract version - required for Aragon compatibility
     */
    constructor(
        address tokenAddr_,
        string memory name_,
        string memory symbol_,
        string memory version_
    ) {
        admin = msg.sender;
        token = tokenAddr_;
        pointHistory[0].blk = block.number;
        pointHistory[0].ts = block.timestamp;
        controller = msg.sender;
        transfersEnabled = true;

        uint256 decimalsFromToken = ERC20(tokenAddr_).decimals();
        require(
            decimalsFromToken <= 255,
            "Decimals should be less than or equal to 255"
        );
        decimals = decimalsFromToken;

        name = name_;
        symbol = symbol_;
        version = version_;
    }

    /***
     * @notice Transfer ownership of VotingEscrow contract to `addr_`
     * @param addr Address to have ownership transferred to
     */
    function commitTransferOwnership(address addr_) external onlyAdmin {
        futureAdmin = addr_;
        emit CommitOwnership(addr_);
    }

    /***
     * @notice Apply ownership transfer
     */
    function applyTransferOwnership() external onlyAdmin {
        address _admin = futureAdmin;
        require(_admin != address(0), "admin not set");
        admin = _admin;
        emit ApplyOwnership(_admin);
    }

    /***
     * @notice Set an external contract to check for approved smart contract wallets
     * @param addr_ Address of Smart contract checker
     */
    function commitSmartWalletChecker(address addr_) external onlyAdmin {
        futureSmartWalletChecker = addr_;
    }

    /***
     * @notice Apply setting external contract to check approved smart contract wallets
     */
    function applySmartWalletChecker() external onlyAdmin {
        smartWalletChecker = futureSmartWalletChecker;
    }

    /***
     *@notice Check if the call is from a whitelisted smart contract, revert if not
     *@param addr_ Address to be checked
     */
    function assertNotContract(address addr_) internal {
        if (addr_ != tx.origin) {
            address _checker = smartWalletChecker;
            if (
                _checker != address(0) &&
                ISmartWalletChecker(_checker).check(addr_)
            ) {
                return;
            }
            revert("Smart contract depositors not allowed");
        }
    }

    /***
     * @notice Get the most recently recorded rate of voting power decrease for `addr`
     * @param addr_ Address of the user wallet
     * @return Value of the slope
     */
    function getLastUserSlope(address addr_) external view returns (int128) {
        uint256 _uEpoch = userPointEpoch[addr_];
        return userPointHistory[addr_][_uEpoch].slope;
    }

    /***
     * @notice Get the timestamp for checkpoint `idx_` for `addr_`
     * @param addr_ User wallet address
     * @param idx_ User epoch number
     * @return Epoch time of the checkpoint
     */
    function userPointHistoryTs(
        address addr_,
        uint256 idx_
    ) external view returns (uint256) {
        return userPointHistory[addr_][idx_].ts;
    }

    /***
     * @notice Get timestamp when `addr_`'s lock finishes
     * @param addr_ User wallet
     * @return Epoch time of the lock end
     */
    function lockedEnd(address addr_) external view returns (uint256) {
        return locked[addr_].end;
    }

    /***
     * @notice Record global and per-user data to checkpoint
     * @param addr_ User's wallet address. No user checkpoint if 0x0
     * @param oldLocked_ Pevious locked amount / end lock time for the user
     * @param newLocked_ New locked amount / end lock time for the user
     */
    function _checkpoint(
        address addr_,
        LockedBalance memory oldLocked_,
        LockedBalance memory newLocked_
    ) internal {
        Point memory _uOld;
        Point memory _uNew;
        int128 _oldDSlope = 0;
        int128 _newDSlope = 0;
        uint256 _epoch = epoch;

        if (addr_ != address(0)) {
            // Calculate slopes and biases
            // Kept at zero when they have to
            if (oldLocked_.end > block.timestamp && oldLocked_.amount > 0) {
                unchecked {
                    _uOld.slope = int128(oldLocked_.amount / int256(MAXTIME));
                }
                _uOld.bias =
                    _uOld.slope *
                    int128(uint128(oldLocked_.end - block.timestamp));
            }

            if (newLocked_.end > block.timestamp && newLocked_.amount > 0) {
                unchecked {
                    _uNew.slope = int128(
                        uint128(newLocked_.amount) / uint128(MAXTIME)
                    );
                }
                _uNew.bias =
                    _uNew.slope *
                    int128(uint128(newLocked_.end - block.timestamp));
            }

            // Read values of scheduled changes in the slope
            // old_locked.end can be in the past and in the future
            // new_locked.end can ONLY by in the FUTURE unless everything expired: than zeros
            _oldDSlope = slopeChanges[oldLocked_.end];
            if (newLocked_.end != 0) {
                if (newLocked_.end == oldLocked_.end) {
                    _newDSlope = _oldDSlope;
                } else {
                    _newDSlope = slopeChanges[newLocked_.end];
                }
            }
        }

        Point memory _lastPoint = Point({
            bias: 0,
            slope: 0,
            ts: block.timestamp,
            blk: block.number
        });
        if (_epoch > 0) {
            _lastPoint = Point({
                bias: pointHistory[_epoch].bias,
                slope: pointHistory[_epoch].slope,
                ts: pointHistory[_epoch].ts,
                blk: pointHistory[_epoch].blk
            });
        }
        uint256 _lastCheckpoint = _lastPoint.ts;

        // initial_last_point is used for extrapolation to calculate block number
        // (approximately, for *At methods) and save them
        // as we cannot figure that out exactly from inside the contract
        Point memory _initialLastPoint = Point({
            bias: _lastPoint.bias,
            slope: _lastPoint.slope,
            ts: _lastPoint.ts,
            blk: _lastPoint.blk
        });
        uint256 _blockSlope = 0;
        if (block.timestamp > _lastPoint.ts) {
            _blockSlope =
                (MULTIPLIER * (block.number - _lastPoint.blk)) /
                (block.timestamp - _lastPoint.ts);
        }
        // If last point is already recorded in this block, slope=0
        // But that's ok b/c we know the block in such case

        // Go over weeks to fill history and calculate what the current point is
        uint256 _ti;
        unchecked {
            _ti = (_lastCheckpoint / WEEK) * WEEK;
        }
        for (uint256 i; i < 255; ) {
            // Hopefully it won't happen that this won't get used in 5 years!
            // If it does, users will be able to withdraw but vote weight will be broken
            _ti += WEEK;
            int128 _dSlope = 0;
            if (_ti > block.timestamp) {
                _ti = block.timestamp;
            } else {
                _dSlope = slopeChanges[_ti];
            }

            _lastPoint.bias -=
                _lastPoint.slope *
                int128(uint128(_ti) - uint128(_lastCheckpoint));
            _lastPoint.slope += _dSlope;

            if (_lastPoint.bias < 0) {
                // This can happen
                _lastPoint.bias = 0;
            }
            if (_lastPoint.slope < 0) {
                // This cannot happen - just in case
                _lastPoint.slope = 0;
            }

            _lastCheckpoint = _ti;
            _lastPoint.ts = _ti;
            _lastPoint.blk =
                _initialLastPoint.blk +
                (_blockSlope * (_ti - _initialLastPoint.ts)) /
                MULTIPLIER;

            _epoch += 1;

            if (_ti == block.timestamp) {
                _lastPoint.blk = block.number;
                break;
            } else {
                pointHistory[_epoch] = Point({
                    bias: _lastPoint.bias,
                    slope: _lastPoint.slope,
                    ts: _lastPoint.ts,
                    blk: _lastPoint.blk
                });
            }
            unchecked {
                ++i;
            }
        }

        epoch = _epoch;
        // Now point_history is filled until t=now

        if (addr_ != address(0)) {
            // If last point was in this block, the slope change has been applied already
            // But in such case we have 0 slope(s)
            _lastPoint.slope += (_uNew.slope - _uOld.slope);
            _lastPoint.bias += (_uNew.bias - _uOld.bias);
            if (_lastPoint.slope < 0) {
                _lastPoint.slope = 0;
            }
            if (_lastPoint.bias < 0) {
                _lastPoint.bias = 0;
            }
        }

        // Record the changed point into history
        pointHistory[_epoch] = _lastPoint;

        address _addr = addr_; // To avoid being "Stack Too Deep"

        if (_addr != address(0)) {
            // Schedule the slope changes (slope is going down)
            // We subtract new_user_slope from [new_locked.end]
            // and add old_user_slope to [old_locked.end]
            if (oldLocked_.end > block.timestamp) {
                // old_dslope was <something> - u_old.slope, so we cancel that
                _oldDSlope += _uOld.slope;
                if (newLocked_.end == oldLocked_.end) {
                    _oldDSlope -= _uNew.slope; // It was a new deposit, not extension
                }
                slopeChanges[oldLocked_.end] = _oldDSlope;
            }

            if (newLocked_.end > block.timestamp) {
                if (newLocked_.end > oldLocked_.end) {
                    _newDSlope -= _uNew.slope; // old slope disappeared at this point
                    slopeChanges[newLocked_.end] = _newDSlope;
                }
                // else: we recorded it already in old_dslope
            }

            // Now handle user history
            uint256 _userEpoch;
            unchecked {
                _userEpoch = userPointEpoch[_addr] + 1;
            }
            userPointEpoch[_addr] = _userEpoch;

            _uNew.ts = block.timestamp;
            _uNew.blk = block.number;
            userPointHistory[_addr][_userEpoch] = _uNew;
        }
    }

    /***
     * @notice Deposit and lock tokens for a user
     * @param addr_ User's wallet address
     * @param value_ Amount to deposit
     * @param unlockTime_ New time when to unlock the tokens, or 0 if unchanged
     * @param lockedBalance_ Previous locked amount / timestamp
     */
    function _depositFor(
        address addr_,
        uint256 value_,
        uint256 unlockTime_,
        LockedBalance memory lockedBalance_,
        uint128 type_
    ) internal {
        LockedBalance memory _locked = LockedBalance(
            lockedBalance_.amount,
            lockedBalance_.end
        );
        LockedBalance memory _oldLocked = LockedBalance(
            lockedBalance_.amount,
            lockedBalance_.end
        );

        uint256 _supplyBefore = supply;
        supply = _supplyBefore + value_;

        // Adding to existing lock, or if a lock is expired - creating a new one
        _locked.amount += int128(uint128(value_));
        if (unlockTime_ != 0) {
            _locked.end = unlockTime_;
        }
        locked[addr_] = _locked;

        // Possibilities:
        // Both old_locked.end could be current or expired (>/< block.timestamp)
        // value == 0 (extend lock) or value > 0 (add to lock or extend lock)
        // _locked.end > block.timestamp (always)
        _checkpoint(addr_, _oldLocked, _locked);

        if (value_ != 0) {
            require(
                ERC20(token).transferFrom(addr_, address(this), value_),
                "Transfer failed"
            );
        }

        emit Deposit(addr_, value_, _locked.end, type_, block.timestamp);
        emit Supply(_supplyBefore, _supplyBefore + value_);
    }

    /***
     * @notice Record global data to checkpoint
     */
    function checkpoint() external {
        LockedBalance memory _old;
        LockedBalance memory _new;
        _checkpoint(address(0), _old, _new);
    }

    /***
     * @notice Deposit `_value` tokens for `_addr` and add to the lock
     * @dev Anyone (even a smart contract) can deposit for someone else, but
         cannot extend their locktime and deposit for a brand new user
     * @param addr_ User's wallet address
     * @param value_ Amount to add to user's lock
     */
    function depositFor(address addr_, uint256 value_) external nonReentrant {
        LockedBalance memory _locked = locked[addr_];

        require(value_ > 0, "Need non-zero value");
        require(_locked.amount > 0, "No existing lock found");
        require(
            _locked.end > block.timestamp,
            "Cannot add to expired lock. Withdraw"
        );

        _depositFor(addr_, value_, 0, locked[addr_], DEPOSIT_FOR_TYPE);
    }

    /***
     * @notice Deposit `_value` tokens for `msg.sender` and lock until `_unlock_time`
     * @param value_ Amount to deposit
     * @param unlockTime_ Epoch time when tokens unlock, rounded down to whole weeks
     */
    function createLock(
        uint256 value_,
        uint256 unlockTime_
    ) external nonReentrant {
        assertNotContract(msg.sender);

        uint256 _unlockTimeRounded = (unlockTime_ / WEEK) * WEEK;
        LockedBalance memory _locked = locked[msg.sender];

        require(value_ > 0, "Need non-zero value");
        require(_locked.amount == 0, "Withdraw old tokens first");
        require(
            _unlockTimeRounded > block.timestamp,
            "Can only lock until time in the future"
        );
        require(
            _unlockTimeRounded <= block.timestamp + MAXTIME,
            "Voting lock can be 4 years max"
        );

        _depositFor(
            msg.sender,
            value_,
            _unlockTimeRounded,
            _locked,
            CREATE_LOCK_TYPE
        );
    }

    /***
     * @notice Deposit `_value` additional tokens for `msg.sender`
            without modifying the unlock time
     * @param value_ Amount of tokens to deposit and add to the lock
     */
    function increaseAmount(uint256 value_) external nonReentrant {
        assertNotContract(msg.sender);

        LockedBalance memory _locked = locked[msg.sender];

        require(value_ > 0, "Need non-zero value");
        require(_locked.amount > 0, "No existing lock found");
        require(
            _locked.end > block.timestamp,
            "Cannot add to expired lock. Withdraw"
        );

        _depositFor(msg.sender, value_, 0, _locked, INCREASE_LOCK_AMOUNT);
    }

    /***
     * @notice Extend the unlock time for `msg.sender` to `_unlock_time`
     * @param unlockTime_ New epoch time for unlocking
     */
    function increaseUnlockTime(uint256 unlockTime_) external nonReentrant {
        assertNotContract(msg.sender);

        LockedBalance memory _locked = locked[msg.sender];
        uint256 _unlockTimeRounded;
        unchecked {
            _unlockTimeRounded = (unlockTime_ / WEEK) * WEEK;
        }

        require(_locked.end > block.timestamp, "Lock expired");
        require(_locked.amount > 0, "Nothing is locked");
        require(
            _unlockTimeRounded > _locked.end,
            "Can only increase lock duration"
        );
        require(
            _unlockTimeRounded <= block.timestamp + MAXTIME,
            "Voting lock can be 4 years max"
        );

        _depositFor(
            msg.sender,
            0,
            _unlockTimeRounded,
            _locked,
            INCREASE_UNLOCK_TIME
        );
    }

    /***
     * @notice Withdraw all tokens for `msg.sender`
     * @dev Only possible if the lock has expired
     */
    function withdraw() external nonReentrant {
        LockedBalance memory _locked = LockedBalance(
            locked[msg.sender].amount,
            locked[msg.sender].end
        );
        require(block.timestamp >= _locked.end, "The lock didn't expire");
        uint256 _value = uint256(int256(_locked.amount));

        LockedBalance memory _oldLocked = LockedBalance(
            locked[msg.sender].amount,
            locked[msg.sender].end
        );

        _locked.end = 0;
        _locked.amount = 0;
        locked[msg.sender] = LockedBalance(_locked.amount, _locked.end);
        uint256 _supplyBefore = supply;
        supply = _supplyBefore - _value;

        // old_locked can have either expired <= timestamp or zero end
        // _locked has only 0 end
        // Both can have >= 0 amount
        _checkpoint(msg.sender, _oldLocked, _locked);

        require(ERC20(token).transfer(msg.sender, _value), "Transfer failed");

        emit Withdraw(msg.sender, _value, block.timestamp);
        emit Supply(_supplyBefore, _supplyBefore - _value);
    }

    // The following ERC20/minime-compatible methods are not real balanceOf and supply!
    // They measure the weights for the purpose of voting, so they don't represent
    // real coins.

    /***
     * @notice Binary search to estimate epoch for block number
     * @param block_ Block to find
     * @param maxEpoch_ Don't go beyond this epoch
     * @return Approximate epoch for block
     */
    function findBlockEpoch(
        uint256 block_,
        uint256 maxEpoch_
    ) internal view returns (uint256) {
        // Binary search
        uint256 _min = 0;
        uint256 _max = maxEpoch_;
        unchecked {
            for (uint256 i; i < 128; i++) {
                // Will be always enough for 128-bit numbers
                if (_min >= _max) {
                    break;
                }
                uint256 _mid = (_min + _max + 1) / 2;
                if (pointHistory[_mid].blk <= block_) {
                    _min = _mid;
                } else {
                    _max = _mid - 1;
                }
            }
        }
        return _min;
    }

    /***
     * @notice Get the current voting power for `msg.sender`
     * @dev Adheres to the ERC20 `balanceOf` interface for Aragon compatibility
     * @param addr_ User wallet address
     * @param t_ Epoch time to return voting power at
     * @return User voting power
     */
    function balanceOf(
        address addr_,
        uint256 t_
    ) external view returns (uint256) {
        uint256 epoch_ = userPointEpoch[addr_];
        if (epoch_ == 0) {
            return 0;
        } else {
            Point memory lastPoint = userPointHistory[addr_][epoch_];
            lastPoint.bias -=
                lastPoint.slope *
                int128(int256(t_) - int256(lastPoint.ts));
            if (lastPoint.bias < 0) {
                lastPoint.bias = 0;
            }
            return uint256(int256(lastPoint.bias));
        }
    }

    /***
     * @notice Get the current voting power for `msg.sender`
     * @dev Adheres to the ERC20 `balanceOf` interface for Aragon compatibility
     * @param addr_ User wallet address
     * @return User voting power
     */
    function balanceOf(address addr_) external view returns (uint256) {
        uint256 epoch_ = userPointEpoch[addr_];
        if (epoch_ == 0) {
            return 0;
        } else {
            Point memory lastPoint = userPointHistory[addr_][epoch_];
            lastPoint.bias -=
                lastPoint.slope *
                int128(int256(block.timestamp) - int256(lastPoint.ts));
            if (lastPoint.bias < 0) {
                lastPoint.bias = 0;
            }
            return uint256(int256(lastPoint.bias));
        }
    }

    /***
     * @notice Measure voting power of `addr` at block height `_block`
     * @dev Adheres to MiniMe `balanceOfAt` interface: https://github.com/Giveth/minime
     * @param addr_ User's wallet address
     * @param block_ Block to calculate the voting power at
     * @return Voting power
     */
    function balanceOfAt(
        address addr_,
        uint256 block_
    ) external view returns (uint256) {
        // Copying and pasting totalSupply code because Vyper cannot pass by
        // reference yet
        require(block_ <= block.number, "Cannot look up future block");

        // Binary search
        uint256 min_ = 0;
        uint256 max_ = userPointEpoch[addr_];

        unchecked {
            for (uint i = 0; i < 128; i++) {
                // Will be always enough for 128-bit numbers
                if (min_ >= max_) {
                    break;
                }
                uint256 mid_ = (min_ + max_ + 1) / 2;
                if (userPointHistory[addr_][mid_].blk <= block_) {
                    min_ = mid_;
                } else {
                    max_ = mid_ - 1;
                }
            }
        }

        Point memory _upoint = userPointHistory[addr_][min_];
        uint256 _maxEpoch = epoch;
        uint256 _epoch = findBlockEpoch(block_, _maxEpoch);
        Point memory _point0 = pointHistory[_epoch];
        uint256 _dBlock = 0;
        uint256 _dt = 0;

        if (_epoch < _maxEpoch) {
            Point memory _point1 = pointHistory[_epoch + 1];
            _dBlock = _point1.blk - _point0.blk;
            _dt = _point1.ts - _point0.ts;
        } else {
            _dBlock = block.number - _point0.blk;
            _dt = block.timestamp - _point0.ts;
        }

        uint256 _blockTime = _point0.ts;
        if (_dBlock != 0) {
            _blockTime += (_dt * (block_ - _point0.blk)) / _dBlock;
        }

        _upoint.bias -=
            _upoint.slope *
            int128(int256(_blockTime) - int256(_upoint.ts));
        if (_upoint.bias >= 0) {
            return uint256(int256(_upoint.bias));
        } else {
            return 0;
        }
    }

    /***
     * @notice Calculate total voting power at some point in the past
     * @param point_ The point (bias/slope) to start search from
     * @param t_ Time to calculate the total voting power at
     * @return Total voting power at that time
     */
    function supplyAt(
        Point memory point_,
        uint256 t_
    ) internal view returns (uint256) {
        Point memory _lastPoint = point_;
        uint256 _ti;
        unchecked {
            _ti = (_lastPoint.ts / WEEK) * WEEK;
        }
        for (uint256 i; i < 255; ) {
            _ti += WEEK;
            int128 _dSlope = 0;
            if (_ti > t_) {
                _ti = t_;
            } else {
                _dSlope = slopeChanges[_ti];
            }
            _lastPoint.bias -=
                _lastPoint.slope *
                int128(int256(_ti) - int256(_lastPoint.ts));
            if (_ti == t_) {
                break;
            }
            _lastPoint.slope += _dSlope;
            _lastPoint.ts = _ti;
            unchecked {
                ++i;
            }
        }

        if (_lastPoint.bias < 0) {
            _lastPoint.bias = 0;
        }
        return uint256(int256(_lastPoint.bias));
    }

    /***
     * @notice Calculate total voting power
     * @dev Adheres to the ERC20 `totalSupply` interface for Aragon compatibility
     * @param t_ Time to calculate the total voting power at
     * @return Total voting power
     */
    function totalSupply(uint256 t_) external view returns (uint256) {
        uint256 _epoch = epoch;
        Point memory _lastPoint = pointHistory[_epoch];
        return supplyAt(_lastPoint, t_);
    }

    /***
     * @notice Calculate total voting power
     * @dev Adheres to the ERC20 `totalSupply` interface for Aragon compatibility
     * @return Total voting power
     */
    function totalSupply() external view returns (uint256) {
        uint256 _epoch = epoch;
        Point memory _lastPoint = pointHistory[_epoch];
        return supplyAt(_lastPoint, block.timestamp);
    }

    /***
     * @notice Calculate total voting power at some point in the past
     * @param block_ Block to calculate the total voting power at
     * @return Total voting power at `_block`
     */
    function totalSupplyAt(uint256 block_) external view returns (uint256) {
        require(block_ <= block.number, "Invalid block number");
        uint256 _epoch = epoch;
        uint256 _targetEpoch = findBlockEpoch(block_, _epoch);

        Point memory _point = pointHistory[_targetEpoch];
        uint256 _dt = 0;
        if (_targetEpoch < _epoch) {
            Point memory _pointNext = pointHistory[_targetEpoch + 1];
            if (_point.blk != _pointNext.blk) {
                _dt =
                    ((block_ - _point.blk) * (_pointNext.ts - _point.ts)) /
                    (_pointNext.blk - _point.blk);
            }
        } else {
            if (_point.blk != block.number) {
                _dt =
                    ((block_ - _point.blk) * (block.timestamp - _point.ts)) /
                    (block.number - _point.blk);
            }
        }
        // Now _dt contains info on how far are we beyond point
        return supplyAt(_point, _point.ts + _dt);
    }

    /***
     * @dev Dummy method required for Aragon compatibility
     */
    function changeController(address newController) external {
        require(
            msg.sender == controller,
            "Only the controller can call this function"
        );
        controller = newController;
    }

    modifier onlyAdmin() {
        require(admin == msg.sender, "admin only");
        _;
    }
}
