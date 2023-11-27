pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2023 Yamato Protocol (DeFiGeek Community Japan)
 */

/***
 *@title Score Controller
 *@notice Controls liquidity scores and the issuance of token through the scores
 */

//dao-contracts
import "./Interfaces/IveYMT.sol";
import "./Dependencies/UUPSBase.sol";

contract ScoreWeightController is UUPSBase {
    // 7 * 86400 seconds - all future times are rounded by week
    // uint256 constant WEEK = 604800;
    uint256 constant WEEK = 7 days;

    // Cannot change weight votes more often than once in 10 days.
    uint256 constant WEIGHT_VOTE_DELAY = 10 days;

    struct Point {
        uint256 bias;
        uint256 slope;
    }

    struct VotedSlope {
        uint256 slope;
        uint256 power;
        uint256 end;
    }

    event AddType(string name, int128 typeId);
    event NewTypeWeight(
        int128 typeId,
        uint256 time,
        uint256 weight,
        uint256 totalWeight
    );

    event NewScoreWeight(
        address scoreAddress,
        uint256 time,
        uint256 weight,
        uint256 totalWeight
    );
    event VoteForScore(
        uint256 time,
        address user,
        address scoreAddr,
        uint256 weight
    );
    event NewScore(address addr, int128 scoreType, uint256 weight);

    uint256 constant MULTIPLIER = 10 ** 18;

    // YMT token
    address public token;
    // Voting escrow
    address public votingEscrow;

    int128 public nScoreTypes;
    int128 public nScores; //number of scores
    mapping(int128 => string) public scoreTypeNames;

    // Needed for enumeration
    mapping(int128 => address) public scores;

    // we increment values by 1 prior to storing them here so we can rely on a value
    // of zero as meaning the score has not been set    mapping(address => int128) scoreTypes;
    mapping(address => int128) public scoreTypes_;

    mapping(address => mapping(address => VotedSlope)) public voteUserSlopes; // user -> score_addr -> VotedSlope

    mapping(address => uint256) public voteUserPower; // Total vote power used by user
    mapping(address => mapping(address => uint256)) public lastUserVote; // Last user vote's timestamp for each score address

    // Past and scheduled points for score weight, sum of weights per type, total weight
    // Point is for bias+slope
    // changes_* are for changes in slope
    // time_* are for the last change timestamp
    // timestamps are rounded to whole weeks

    mapping(address => mapping(uint256 => Point)) public pointsWeight; // score_addr -> time -> Point
    mapping(address => mapping(uint256 => uint256)) public changesWeight; // score_addr -> time -> slope
    mapping(address => uint256) public timeWeight; // score_addr -> last scheduled time (next week)

    mapping(int128 => mapping(uint256 => Point)) public pointsSum; // type_id -> time -> Point
    mapping(int128 => mapping(uint256 => uint256)) public changesSum; // type_id -> time -> slope
    mapping(int128 => uint256) public timeSum; // type_id -> last scheduled time (next week)

    mapping(uint256 => uint256) public pointsTotal; // time -> total weight
    uint256 public timeTotal; // last scheduled time

    mapping(int128 => mapping(uint256 => uint256)) public pointsTypeWeight; // type_id -> time -> type weight
    mapping(int128 => uint256) public timeTypeWeight; // type_id -> last scheduled time (next week)

    /***
     *@notice Contract constructor
     *@param _token `Token` contract address
     *@param _votingEscrow `VotingEscrow` contract address
     */
    function initialize(
        address token_,
        address votingEscrow_
    ) public initializer {
        require(token_ != address(0));
        require(votingEscrow_ != address(0));

        __UUPSBase_init();
        token = token_;
        votingEscrow = votingEscrow_;
        timeTotal = (block.timestamp / WEEK) * WEEK;
    }

    /***
     *@notice Get score type for address
     *@param addr_ Score address
     *@return Score type id
     */
    function scoreTypes(address addr_) external view returns (int128) {
        int128 _scoreType = scoreTypes_[addr_];
        require(_scoreType != 0, "dev: score is not added");

        return _scoreType - 1;
    }

    /***
     *@notice Fill historic type weights week-over-week for missed checkins
     *        and return the type weight for the future week
     *@param _score_type Score type id
     *@return Type weight
     */
    function _getTypeWeight(int128 scoreType_) internal returns (uint256) {
        uint256 _t = timeTypeWeight[scoreType_];
        if (_t > 0) {
            uint256 _w = pointsTypeWeight[scoreType_][_t];
            for (uint256 i; i < 500; ) {
                if (_t > block.timestamp) {
                    break;
                }
                _t += WEEK;
                pointsTypeWeight[scoreType_][_t] = _w;
                if (_t > block.timestamp) {
                    timeTypeWeight[scoreType_] = _t;
                }
                unchecked {
                    ++i;
                }
            }
            return _w;
        } else {
            return 0;
        }
    }

    /***
     *@notice Fill sum of score weights for the same type week-over-week for
     *        missed checkins and return the sum for the future week
     *@param scoreType_ Score type id
     *@return Sum of weights
     */
    function _getSum(int128 scoreType_) internal returns (uint256) {
        uint256 _t = timeSum[scoreType_];
        if (_t > 0) {
            Point memory _pt = pointsSum[scoreType_][_t];
            for (uint256 i; i < 500; ) {
                if (_t > block.timestamp) {
                    break;
                }
                _t += WEEK;
                uint256 _dBias = _pt.slope * WEEK;
                if (_pt.bias > _dBias) {
                    _pt.bias -= _dBias;
                    uint256 _dSlope = changesSum[scoreType_][_t];
                    _pt.slope -= _dSlope;
                } else {
                    _pt.bias = 0;
                    _pt.slope = 0;
                }
                pointsSum[scoreType_][_t] = _pt;
                if (_t > block.timestamp) {
                    timeSum[scoreType_] = _t;
                }
                unchecked {
                    ++i;
                }
            }
            return _pt.bias;
        } else {
            return 0;
        }
    }

    /***
     *@notice Fill historic total weights week-over-week for missed checkins
     *        and return the total for the future week
     *@return Total weight
     */
    function _getTotal() internal returns (uint256) {
        uint256 _t = timeTotal;
        int128 _nScoreTypes = nScoreTypes;
        if (_t > block.timestamp) {
            // If we have already checkpointed - still need to change the value
            _t -= WEEK;
        }
        uint256 _pt = pointsTotal[_t];

        for (int128 _scoreType; _scoreType < 100; ) {
            if (_scoreType == _nScoreTypes) {
                break;
            }
            _getSum(_scoreType);
            _getTypeWeight(_scoreType);
            unchecked {
                ++_scoreType;
            }
        }
        for (uint256 i; i < 500; ) {
            if (_t > block.timestamp) {
                break;
            }
            _t += WEEK;
            _pt = 0;
            // Scales as n_types * n_unchecked_weeks (hopefully 1 at most)
            for (int128 _scoreType; _scoreType < 100; ) {
                if (_scoreType == _nScoreTypes) {
                    break;
                }
                uint256 _typeSum = pointsSum[_scoreType][_t].bias;
                uint256 _typeWeight = pointsTypeWeight[_scoreType][_t];
                _pt += _typeSum * _typeWeight;
                unchecked {
                    ++_scoreType;
                }
            }
            pointsTotal[_t] = _pt;

            if (_t > block.timestamp) {
                timeTotal = _t;
            }
            unchecked {
                ++i;
            }
        }
        return _pt;
    }

    /***
     *@notice Fill historic score weights week-over-week for missed checkins
     *        and return the total for the future week
     *@param scoreAddr_ Address of the score
     *@return Score weight
     */
    function _getWeight(address scoreAddr_) internal returns (uint256) {
        uint256 _t = timeWeight[scoreAddr_];
        if (_t > 0) {
            Point memory _pt = pointsWeight[scoreAddr_][_t];
            for (uint256 i; i < 500; ) {
                if (_t > block.timestamp) {
                    break;
                }
                _t += WEEK;
                uint256 _dBias = _pt.slope * WEEK;
                if (_pt.bias > _dBias) {
                    _pt.bias -= _dBias;
                    uint256 _dSlope = changesWeight[scoreAddr_][_t];
                    _pt.slope -= _dSlope;
                } else {
                    _pt.bias = 0;
                    _pt.slope = 0;
                }
                pointsWeight[scoreAddr_][_t] = _pt;
                if (_t > block.timestamp) {
                    timeWeight[scoreAddr_] = _t;
                }
                unchecked {
                    ++i;
                }
            }
            return _pt.bias;
        } else {
            return 0;
        }
    }

    /***
     *@notice Add Currency `addr` of type `score_type` with weight `weight`
     *@param addr_ Score address
     *@param scoreType_ Score type
     */
    function addCurrency(
        address addr_,
        int128 scoreType_,
        uint256 weight_
    ) external onlyGovernance {
        require(
            (scoreType_ >= 0) && (scoreType_ < nScoreTypes),
            "score_type 0 means unset"
        ); //score_type 0 means unset
        require(scoreTypes_[addr_] == 0, "cannot add the same score twice");
        int128 _n = nScores;
        unchecked {
            nScores = _n + 1;
        }
        scores[_n] = addr_;
        scoreTypes_[addr_] = scoreType_ + 1;
        uint256 _nextTime;
        unchecked {
            _nextTime = ((block.timestamp + WEEK) / WEEK) * WEEK;
        }

        if (weight_ > 0) {
            uint256 _typeWeight = _getTypeWeight(scoreType_);
            uint256 _oldSum = _getSum(scoreType_);
            uint256 _oldTotal = _getTotal();

            pointsSum[scoreType_][_nextTime].bias = weight_ + _oldSum;
            timeSum[scoreType_] = _nextTime;
            pointsTotal[_nextTime] = _oldTotal + (_typeWeight * weight_);
            timeTotal = _nextTime;

            pointsWeight[addr_][_nextTime].bias = weight_;
        }
        if (timeSum[scoreType_] == 0) {
            timeSum[scoreType_] = _nextTime;
        }
        timeWeight[addr_] = _nextTime;

        emit NewScore(addr_, scoreType_, weight_);
    }

    /***
     * @notice Checkpoint to fill data common for all scores
     */
    function checkpoint() external {
        _getTotal();
    }

    /***
     *@notice Checkpoint to fill data for both a specific score and common for all scores
     *@param addr_ Score address
     */
    function checkpointScore(address addr_) external {
        _getWeight(addr_);
        _getTotal();
    }

    /***
     *@notice Get Score relative weight (not more than 1.0) normalized to 1e18
     *        (e.g. 1.0 == 1e18). Inflation which will be received by it is
     *       inflation_rate * relative_weight / 1e18
     *@param addr_ Score address
     *@param time_ Relative weight at the specified timestamp in the past or present
     *@return Value of relative weight normalized to 1e18
     */
    function _scoreRelativeWeight(
        address addr_,
        uint256 time_
    ) internal view returns (uint256) {
        uint256 _t = (time_ / WEEK) * WEEK;
        uint256 _totalWeight = pointsTotal[_t];

        if (_totalWeight > 0) {
            int128 _scoreType = scoreTypes_[addr_] - 1;
            uint256 _typeWeight = pointsTypeWeight[_scoreType][_t];
            uint256 _scoreWeight = pointsWeight[addr_][_t].bias;

            return (MULTIPLIER * _typeWeight * _scoreWeight) / _totalWeight;
        } else {
            return 0;
        }
    }

    /***
     *@notice Get Score relative weight (not more than 1.0) normalized to 1e18
     *        (e.g. 1.0 == 1e18). Inflation which will be received by it is
     *        inflation_rate * relative_weight / 1e18
     *@param addr_ Score address
     *@param time_ Relative weight at the specified timestamp in the past or present
     *@return Value of relative weight normalized to 1e18
     */
    function scoreRelativeWeight(
        address addr_,
        uint256 time_
    ) external view returns (uint256) {
        //default value
        if (time_ == 0) {
            time_ = block.timestamp;
        }

        return _scoreRelativeWeight(addr_, time_);
    }

    function scoreRelativeWeightWrite(
        address addr_,
        uint256 time_
    ) external returns (uint256) {
        //default value
        if (time_ == 0) {
            time_ = block.timestamp;
        }

        _getWeight(addr_);
        _getTotal(); // Also calculates get_sum
        return _scoreRelativeWeight(addr_, time_);
    }

    /***
     *@notice Change type weight
     *@param typeId_ Type id
     *@param weight_ New type weight
     */
    function _changeTypeWeight(int128 typeId_, uint256 weight_) internal {
        uint256 _oldWeight = _getTypeWeight(typeId_);
        uint256 _oldSum = _getSum(typeId_);
        uint256 _totalWeight = _getTotal();
        uint256 _nextTime;
        unchecked {
            _nextTime = ((block.timestamp + WEEK) / WEEK) * WEEK;
        }

        _totalWeight =
            _totalWeight +
            (_oldSum * weight_) -
            (_oldSum * _oldWeight);
        pointsTotal[_nextTime] = _totalWeight;
        pointsTypeWeight[typeId_][_nextTime] = weight_;
        timeTotal = _nextTime;
        timeTypeWeight[typeId_] = _nextTime;

        emit NewTypeWeight(typeId_, _nextTime, weight_, _totalWeight);
    }

    /***
     *@notice Add score type with name `name_` and weight `weight`　//ex. type=1, Liquidity, 1*1e18
     *@param name_ Name of score type
     *@param weight_ Weight of score type
     */
    function addType(
        string memory name_,
        uint256 weight_
    ) external onlyGovernance {
        int128 _typeId = nScoreTypes;
        scoreTypeNames[_typeId] = name_;
        unchecked {
            nScoreTypes = _typeId + 1;
        }
        if (weight_ != 0) {
            _changeTypeWeight(_typeId, weight_);
            emit AddType(name_, _typeId);
        }
    }

    /***
     *@notice Change score type `type_id` weight to `weight`
     *@param typeId_ Score type id
     *@param weight_ New Score weight
     */
    function changeTypeWeight(
        int128 typeId_,
        uint256 weight_
    ) external onlyGovernance {
        _changeTypeWeight(typeId_, weight_);
    }

    function _changeScoreWeight(address addr_, uint256 weight_) internal {
        // Change score weight
        // Only needed when testing in reality
        int128 _scoreType = scoreTypes_[addr_] - 1;
        uint256 _oldScoreWeight = _getWeight(addr_);
        uint256 _typeWeight = _getTypeWeight(_scoreType);
        uint256 _oldSum = _getSum(_scoreType);
        uint256 _totalWeight = _getTotal();
        uint256 _nextTime;
        unchecked {
            _nextTime = ((block.timestamp + WEEK) / WEEK) * WEEK;
        }

        pointsWeight[addr_][_nextTime].bias = weight_;
        timeWeight[addr_] = _nextTime;

        uint256 newSum = _oldSum + weight_ - _oldScoreWeight;
        pointsSum[_scoreType][_nextTime].bias = newSum;
        timeSum[_scoreType] = _nextTime;

        _totalWeight =
            _totalWeight +
            (newSum * _typeWeight) -
            (_oldSum * _typeWeight);
        pointsTotal[_nextTime] = _totalWeight;
        timeTotal = _nextTime;

        emit NewScoreWeight(addr_, block.timestamp, weight_, _totalWeight);
    }

    /***
     *@notice Change weight of score `addr` to `weight`
     *@param addr_ `ScoreController` contract address
     *@param weight_ New Score weight
     */
    function changeScoreWeight(
        address addr_,
        uint256 weight_
    ) external onlyGovernance {
        _changeScoreWeight(addr_, weight_);
    }

    struct VotingParameter {
        //to avoid "Stack too deep" issue
        uint256 slope;
        uint256 lockEnd;
        uint256 _nScores;
        uint256 nextTime;
        int128 scoreType;
        uint256 oldDt;
        uint256 oldBias;
    }

    /****
     *@notice Allocate voting power for changing pool weights
     *@param scoreAddr_ Score which `msg.sender` votes for
     *@param userWeight_ Weight for a score in bps (units of 0.01%). Minimal is 0.01%. Ignored if 0. bps = basis points
     */
    function voteForScoreWeights(
        address scoreAddr_,
        uint256 userWeight_
    ) external {
        VotingParameter memory _vp;
        _vp.slope = uint256(
            uint128(IveYMT(votingEscrow).getLastUserSlope(msg.sender))
        );
        _vp.lockEnd = IveYMT(votingEscrow).lockedEnd(msg.sender);
        _vp._nScores = uint256(uint128(nScores));
        unchecked {
            _vp.nextTime = ((block.timestamp + WEEK) / WEEK) * WEEK;
        }
        require(_vp.lockEnd > _vp.nextTime, "Your token lock expires too soon");
        require(
            (userWeight_ >= 0) && (userWeight_ <= 10000),
            "You used all your voting power"
        );
        unchecked {
            require(
                block.timestamp >=
                    lastUserVote[msg.sender][scoreAddr_] + WEIGHT_VOTE_DELAY,
                "Cannot vote so often"
            );
        }

        _vp.scoreType = scoreTypes_[scoreAddr_] - 1;
        require(_vp.scoreType >= 0, "Score not added");
        // Prepare slopes and biases in memory
        VotedSlope memory _oldSlope = voteUserSlopes[msg.sender][scoreAddr_];
        _vp.oldDt = 0;
        if (_oldSlope.end > _vp.nextTime) {
            _vp.oldDt = _oldSlope.end - _vp.nextTime;
        }
        _vp.oldBias = _oldSlope.slope * _vp.oldDt;
        VotedSlope memory _newSlope = VotedSlope({
            slope: (_vp.slope * userWeight_) / 10000,
            end: _vp.lockEnd,
            power: userWeight_
        });
        uint256 _newDt = _vp.lockEnd - _vp.nextTime; // dev: raises when expired
        uint256 _newBias = _newSlope.slope * _newDt;

        // Check and update powers (weights) used
        uint256 _powerUsed = voteUserPower[msg.sender];
        _powerUsed = _powerUsed + _newSlope.power - _oldSlope.power;
        voteUserPower[msg.sender] = _powerUsed;
        require(
            (_powerUsed >= 0) && (_powerUsed <= 10000),
            "Used too much power"
        );

        //// Remove old and schedule new slope changes
        // Remove slope changes for old slopes
        // Schedule recording of initial slope for nextTime
        uint256 _oldWeightBias = _getWeight(scoreAddr_);
        uint256 _oldWeightSlope = pointsWeight[scoreAddr_][_vp.nextTime].slope;
        uint256 _oldSumBias = _getSum(_vp.scoreType);
        uint256 _oldSumSlope = pointsSum[_vp.scoreType][_vp.nextTime].slope;

        pointsWeight[scoreAddr_][_vp.nextTime].bias =
            max(_oldWeightBias + _newBias, _vp.oldBias) -
            _vp.oldBias;
        pointsSum[_vp.scoreType][_vp.nextTime].bias =
            max(_oldSumBias + _newBias, _vp.oldBias) -
            _vp.oldBias;
        if (_oldSlope.end > _vp.nextTime) {
            pointsWeight[scoreAddr_][_vp.nextTime].slope =
                max(_oldWeightSlope + _newSlope.slope, _oldSlope.slope) -
                _oldSlope.slope;
            pointsSum[_vp.scoreType][_vp.nextTime].slope =
                max(_oldSumSlope + _newSlope.slope, _oldSlope.slope) -
                _oldSlope.slope;
        } else {
            pointsWeight[scoreAddr_][_vp.nextTime].slope += _newSlope.slope;
            pointsSum[_vp.scoreType][_vp.nextTime].slope += _newSlope.slope;
        }
        if (_oldSlope.end > block.timestamp) {
            // Cancel old slope changes if they still didn't happen
            changesWeight[scoreAddr_][_oldSlope.end] -= _oldSlope.slope;
            changesSum[_vp.scoreType][_oldSlope.end] -= _oldSlope.slope;
        }
        // Add slope changes for new slopes
        changesWeight[scoreAddr_][_newSlope.end] += _newSlope.slope;
        changesSum[_vp.scoreType][_newSlope.end] += _newSlope.slope;

        _getTotal();

        voteUserSlopes[msg.sender][scoreAddr_] = _newSlope;

        // Record last action time
        lastUserVote[msg.sender][scoreAddr_] = block.timestamp;

        emit VoteForScore(block.timestamp, msg.sender, scoreAddr_, userWeight_);
    }

    /***
     *@notice Get current score weight
     *@param addr_ Score address
     *@return Score weight
     */
    function getScoreWeight(address addr_) external view returns (uint256) {
        return pointsWeight[addr_][timeWeight[addr_]].bias;
    }

    /***
     *@notice Get current type weight
     *@param typeId_ Type id
     *@return Type weight
     */
    function getTypeWeight(int128 typeId_) external view returns (uint256) {
        return pointsTypeWeight[typeId_][timeTypeWeight[typeId_]];
    }

    /***
     *@notice Get current total (type-weighted) weight
     *@return Total weight
     */
    function getTotalWeight() external view returns (uint256) {
        return pointsTotal[timeTotal];
    }

    /***
     *@notice Get sum of score weights per type
     *@param typeId_ Type id
     *@return Sum of score weights
     */
    function getWeightsSumPerType(
        int128 typeId_
    ) external view returns (uint256) {
        return pointsSum[typeId_][timeSum[typeId_]].bias;
    }

    function max(uint256 _a, uint256 _b) internal pure returns (uint256) {
        return _a >= _b ? _a : _b;
    }
}
