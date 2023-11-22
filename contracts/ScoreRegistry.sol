pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2023 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "./Dependencies/YamatoAction.sol";
import "./Interfaces/IScoreController.sol";
import "./Interfaces/IYMT.sol";
import "./Interfaces/IYmtMinter.sol";
import "./Interfaces/IveYMT.sol";
import "./Interfaces/IYamatoV4.sol";

contract ScoreRegistry is YamatoAction {
    event UpdateLiquidityLimit(
        address user,
        uint256 originalBalance,
        uint256 originalSupply,
        uint256 workingBalance,
        uint256 workingSupply
    );
    event CommitOwnership(address indexed admin);
    event ApplyOwnership(address indexed admin);

    // to avoid "stack too deep"
    struct CheckPointParameters {
        int128 period;
        uint256 periodTime;
        uint256 integrateInvSupply;
        uint256 inflationParams;
        uint256 rate;
        uint256 newRate;
        uint256 prevFutureEpoch;
        uint256 workingBalance;
        uint256 workingSupply;
    }

    // Constants
    uint256 public constant TOKENLESS_PRODUCTION = 40;
    uint256 public constant WEEK = 604800;

    // Score
    address public admin;

    address public token;
    address public votingEscrow;
    address public minter;
    address public scoreController;

    bool public isKilled;

    // [future_epoch_time uint40][inflation_rate uint216]
    uint256 public futureEpochTime;
    uint256 public inflationRate;

    mapping(address => uint256) public workingBalances;
    uint256 public workingSupply;

    // 1e18 * ∫(rate(t) / totalSupply(t) dt) from (last_action) till checkpoint
    mapping(address => uint256) public integrateInvSupplyOf;
    mapping(address => uint256) public integrateCheckpointOf;

    // ∫(balance * rate(t) / totalSupply(t) dt) from 0 till checkpoint
    mapping(address => uint256) public integrateFraction;

    // The goal is to be able to calculate ∫(rate * balance / totalSupply dt) from 0 till checkpoint
    int128 public period;

    // Using dynamic array instead of fixed 100000000000000000000000000000 array to avoid warning about collisions
    uint256[100000000000000000000000000000] public periodTimestamp;
    uint256[100000000000000000000000000000] public integrateInvSupply;

    function initialize(address minter_, address yamato_) public initializer {
        __YamatoAction_init(yamato_);
        minter = minter_;
        token = IYmtMinter(minter).token();
        scoreController = IYmtMinter(minter).controller();
        votingEscrow = IScoreController(scoreController).votingEscrow();

        periodTimestamp[0] = block.timestamp;
        admin = msg.sender;

        // Assuming you have the YMT interface defined somewhere for the following line
        inflationRate = IYMT(token).rate();
        futureEpochTime = IYMT(token).futureEpochTimeWrite();
    }

    function checkpoint(address addr) public onlyYamato {
        CheckPointParameters memory _st;

        _st.period = period;
        _st.periodTime = periodTimestamp[uint256(uint128(_st.period))];
        _st.integrateInvSupply = integrateInvSupply[
            uint256(uint128(_st.period))
        ];

        _st.rate = inflationRate;
        _st.prevFutureEpoch = futureEpochTime;
        _st.newRate = _st.rate;

        if (_st.prevFutureEpoch >= _st.periodTime) {
            futureEpochTime = IYMT(token).futureEpochTimeWrite();
            _st.newRate = IYMT(token).rate();
            inflationRate = _st.newRate;
        }

        if (isKilled) {
            _st.rate = 0;
            _st.newRate = 0;
        }

        if (block.timestamp > _st.periodTime) {
            uint256 _workingSupply = workingSupply;
            IScoreController(scoreController).checkpointScore(address(this));
            uint256 _prevWeekTime = _st.periodTime;
            uint256 _weekTime = min(
                ((_st.periodTime + WEEK) / WEEK) * WEEK,
                block.timestamp
            );

            for (uint256 i = 0; i < 500; ) {
                uint256 dt = _weekTime - _prevWeekTime;
                uint256 w = IScoreController(scoreController)
                    .scoreRelativeWeight(
                        address(this),
                        (_prevWeekTime / WEEK) * WEEK
                    );

                if (_workingSupply > 0) {
                    if (
                        _st.prevFutureEpoch >= _prevWeekTime &&
                        _st.prevFutureEpoch < _weekTime
                    ) {
                        _st.integrateInvSupply +=
                            (_st.rate *
                                w *
                                (_st.prevFutureEpoch - _prevWeekTime)) /
                            _workingSupply;
                        _st.rate = _st.newRate;
                        _st.integrateInvSupply +=
                            (_st.rate * w * (_weekTime - _st.prevFutureEpoch)) /
                            _workingSupply;
                    } else {
                        _st.integrateInvSupply +=
                            (_st.rate * w * dt) /
                            _workingSupply;
                    }
                }

                if (_weekTime == block.timestamp) {
                    break;
                }
                _prevWeekTime = _weekTime;
                _weekTime = min(_weekTime + WEEK, block.timestamp);
                unchecked {
                    ++i;
                }
            }
        }

        _st.period += 1;
        period = _st.period;
        periodTimestamp[uint256(uint128(_st.period))] = block.timestamp;
        integrateInvSupply[uint256(uint128(_st.period))] = _st
            .integrateInvSupply;

        uint256 _workingBalance = workingBalances[addr];
        integrateFraction[addr] +=
            (_workingBalance *
                (_st.integrateInvSupply - integrateInvSupplyOf[addr])) /
            10 ** 18;
        integrateInvSupplyOf[addr] = _st.integrateInvSupply;
        integrateCheckpointOf[addr] = block.timestamp;
    }

    function updateScoreLimit(
        address addr_,
        uint256 debt_,
        uint256 totaldebt_
    ) public onlyYamato {
        uint256 _votingBalance = IveYMT(votingEscrow).balanceOf(addr_);
        uint256 _votingTotal = IveYMT(votingEscrow).totalSupply();

        uint256 _lim = (debt_ * TOKENLESS_PRODUCTION) / 100;
        if (_votingTotal > 0) {
            _lim +=
                (((totaldebt_ * _votingBalance) / _votingTotal) *
                    (100 - TOKENLESS_PRODUCTION)) /
                100;
        }

        _lim = min(debt_, _lim);
        uint256 _oldBal = workingBalances[addr_];
        workingBalances[addr_] = _lim;
        uint256 _workingSupply = workingSupply + _lim - _oldBal;
        workingSupply = _workingSupply;

        emit UpdateLiquidityLimit(
            addr_,
            debt_,
            totaldebt_,
            _lim,
            _workingSupply
        );
    }

    function userCheckpoint(address addr_) external onlyYamato returns (bool) {
        require(
            msg.sender == addr_ || msg.sender == minter,
            "dev: unauthorized"
        );
        checkpoint(addr_);
        uint256 _balance = IYamato(yamato()).getPledge(addr_).debt;
        uint256 _totalSupply = IYamatoV4(yamato()).getTotalDebt();
        updateScoreLimit(addr_, _balance, _totalSupply);
        return true;
    }

    function kick(address addr_) external {
        uint256 _tLast = integrateCheckpointOf[addr_];
        uint256 _tVe = IveYMT(votingEscrow).userPointHistoryTs(
            addr_,
            IveYMT(votingEscrow).userPointEpoch(addr_)
        );
        uint256 _balance = IYamato(yamato()).getPledge(addr_).debt;

        require(
            IveYMT(votingEscrow).balanceOf(addr_) == 0 || _tVe > _tLast,
            "Not allowed"
        );
        require(
            workingBalances[addr_] > (_balance * TOKENLESS_PRODUCTION) / 100,
            "Not needed"
        );

        checkpoint(addr_);
        uint256 _totalSupply = IYamatoV4(yamato()).getTotalDebt();
        updateScoreLimit(addr_, _balance, _totalSupply);
    }

    function setKilled(bool isKilled_) external onlyAdmin {
        isKilled = isKilled_;
    }

    function integrateCheckpoint() external view returns (uint256) {
        return periodTimestamp[uint256(uint128(period))];
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "only owner");
        _;
    }
}
