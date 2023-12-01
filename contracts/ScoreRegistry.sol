pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2023 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "./Dependencies/YamatoAction.sol";
import "./Dependencies/PledgeLib.sol";
import "./Interfaces/IScoreWeightController.sol";
import "./Interfaces/IYMT.sol";
import "./Interfaces/IYmtMinter.sol";
import "./Interfaces/IveYMT.sol";
import "./Interfaces/IYamatoV4.sol";

contract ScoreRegistry is YamatoAction {
    using PledgeLib for IYamato.Pledge;

    event UpdateScoreLimit(
        address user,
        uint256 originalBalance,
        uint256 originalSupply,
        uint256 collateralRatio,
        uint256 workingBalance,
        uint256 workingSupply
    );

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

    string constant YMT_SLOT_ID = "deps.YMT";
    string constant VEYMT_SLOT_ID = "deps.veYMT";
    string constant YMT_MINTER_SLOT_ID = "deps.ymtMinter";
    string constant WEIGHT_CONTROLLER_SLOT_ID = "deps.ScoreWeightController";

    // Constants
    uint256 public constant TOKENLESS_PRODUCTION = 4;
    uint256 public constant WEEK = 604800;

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

    mapping(int128 => uint256) public periodTimestamp;
    mapping(int128 => uint256) public integrateInvSupply;

    function initialize(address ymtMinterAddr, address yamatoAddr) public initializer {
        __YamatoAction_init(yamatoAddr);

        bytes32 YMT_KEY = bytes32(keccak256(abi.encode(YMT_SLOT_ID)));
        bytes32 VEYMT_KEY = bytes32(keccak256(abi.encode(VEYMT_SLOT_ID)));
        bytes32 YMT_MINTER_KEY = bytes32(keccak256(abi.encode(YMT_MINTER_SLOT_ID)));
        bytes32 WEIGHT_CONTROLLER_KEY = bytes32(
            keccak256(abi.encode(WEIGHT_CONTROLLER_SLOT_ID))
        );
        address ymtAddr = IYmtMinter(ymtMinterAddr).YMT();
        address scoreWeightControllerAddr = IYmtMinter(ymtMinterAddr).scoreWeightController();
        address veYmtAddr = IScoreWeightController(scoreWeightControllerAddr).veYMT();

        assembly {
            sstore(YMT_KEY, ymtAddr)
            sstore(VEYMT_KEY, veYmtAddr)
            sstore(YMT_MINTER_KEY, ymtMinterAddr)
            sstore(WEIGHT_CONTROLLER_KEY, scoreWeightControllerAddr)
        }

        periodTimestamp[int128(0)] = block.timestamp;

        // Assuming you have the YMT interface defined somewhere for the following line
        inflationRate = IYMT(ymtAddr).rate();
        futureEpochTime = IYMT(ymtAddr).futureEpochTimeWrite();
    }

    function checkpoint(address addr) public onlyYamato {
        CheckPointParameters memory _st;

        _st.period = period;
        _st.periodTime = periodTimestamp[_st.period];
        _st.integrateInvSupply = integrateInvSupply[_st.period];

        _st.rate = inflationRate;
        _st.prevFutureEpoch = futureEpochTime;
        _st.newRate = _st.rate;

        if (_st.prevFutureEpoch >= _st.periodTime) {
            futureEpochTime = IYMT(YMT()).futureEpochTimeWrite();
            _st.newRate = IYMT(YMT()).rate();
            inflationRate = _st.newRate;
        }

        if (isKilled) {
            _st.rate = 0;
            _st.newRate = 0;
        }

        if (block.timestamp > _st.periodTime) {
            uint256 _workingSupply = workingSupply;
            IScoreWeightController(scoreWeightController()).checkpointScore(address(this));
            uint256 _prevWeekTime = _st.periodTime;
            uint256 _weekTime = min(
                ((_st.periodTime + WEEK) / WEEK) * WEEK,
                block.timestamp
            );

            for (uint256 i = 0; i < 500; ) {
                uint256 dt = _weekTime - _prevWeekTime;
                uint256 w = IScoreWeightController(scoreWeightController())
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
        periodTimestamp[_st.period] = block.timestamp;
        integrateInvSupply[_st.period] = _st.integrateInvSupply;

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
        uint256 totalDebt_,
        uint256 collateralRatio_
    ) public onlyYamato {
        uint256 _votingBalance = IveYMT(veYMT()).balanceOf(addr_);
        uint256 _votingTotal = IveYMT(veYMT()).totalSupply();

        uint256 _limit = (debt_ * TOKENLESS_PRODUCTION) / 10;
        if (_votingTotal > 0) {
            _limit +=
                (((totalDebt_ * _votingBalance) / _votingTotal) *
                    (10 - TOKENLESS_PRODUCTION)) /
                10;
        }

        _limit = min(debt_, _limit);
        uint256 _oldBal = workingBalances[addr_];

        if(debt_ > 0){
            // Apply the coefficient based on the collateral ratio provided
            uint256 coefficient = calculateCoefficient(collateralRatio_);
            // Adjust the limit based on the coefficient
            _limit = (_limit * coefficient) / 10;
        }

        workingBalances[addr_] = _limit;
        uint256 _workingSupply = workingSupply + _limit - _oldBal;
        workingSupply = _workingSupply;

        emit UpdateScoreLimit(
            addr_,
            debt_,
            totalDebt_,
            collateralRatio_,
            _limit,
            _workingSupply
        );
    }

    function calculateCoefficient(
        uint256 collateralRatio_
    ) internal pure returns (uint256) {
        if (collateralRatio_ >= 25000) return 25;
        if (collateralRatio_ >= 20000) return 20;
        if (collateralRatio_ >= 15000) return 15;
        if (collateralRatio_ >= 13000) return 10;
        return 0;
    }

    function userCheckpoint(address addr_) external onlyYamato returns (bool) {
        require(
            msg.sender == addr_ || msg.sender == ymtMinter(),
            "dev: unauthorized"
        );
        checkpoint(addr_);
        IYamato.Pledge memory _pledge = IYamato(yamato()).getPledge(addr_);
        uint256 _collateralRatio = _pledge.getICR(priceFeed());
        uint256 _balance = _pledge.debt;
        uint256 _totalSupply = IYamatoV4(yamato()).getTotalDebt();
        updateScoreLimit(addr_, _balance, _totalSupply, _collateralRatio);
        return true;
    }

    function kick(address addr_) external {
        uint256 _tLast = integrateCheckpointOf[addr_];
        uint256 _tVe = IveYMT(veYMT()).userPointHistoryTs(
            addr_,
            IveYMT(veYMT()).userPointEpoch(addr_)
        );
        IYamato.Pledge memory _pledge = IYamato(yamato()).getPledge(addr_);
        uint256 _balance = _pledge.debt;
        uint256 _collateralRatio = _pledge.getICR(priceFeed());
        uint256 coefficient = calculateCoefficient(_collateralRatio);

        require(
            IveYMT(veYMT()).balanceOf(addr_) == 0 || _tVe > _tLast,
            "Not allowed"
        );
        require(
            workingBalances[addr_] >
                (((_balance * TOKENLESS_PRODUCTION) / 10) * coefficient) / 10,
            "Not needed"
        );

        checkpoint(addr_);
        uint256 _totalSupply = IYamatoV4(yamato()).getTotalDebt();
        updateScoreLimit(addr_, _balance, _totalSupply, _collateralRatio);
    }

    function setKilled(bool isKilled_) external onlyGovernance {
        isKilled = isKilled_;
    }

    function integrateCheckpoint() external view returns (uint256) {
        return periodTimestamp[period];
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    /*
        =====================
        Getter Functions
        =====================
    */
    function YMT() public view returns (address _YMT) {
        bytes32 YMT_KEY = bytes32(keccak256(abi.encode(YMT_SLOT_ID)));
        assembly {
            _YMT := sload(YMT_KEY)
        }
    }

    function veYMT() public view returns (address _veYMT) {
        bytes32 VEYMT_KEY = bytes32(keccak256(abi.encode(VEYMT_SLOT_ID)));
        assembly {
            _veYMT := sload(VEYMT_KEY)
        }
    }

    function ymtMinter() public view returns (address _ymtMinter) {
        bytes32 YMT_MINTER_KEY = bytes32(keccak256(abi.encode(YMT_MINTER_SLOT_ID)));
        assembly {
            _ymtMinter := sload(YMT_MINTER_KEY)
        }
    }

    function scoreWeightController()
        public
        view
        returns (address _scoreWeightController)
    {
        bytes32 WEIGHT_CONTROLLER_KEY = bytes32(
            keccak256(abi.encode(WEIGHT_CONTROLLER_SLOT_ID))
        );
        assembly {
            _scoreWeightController := sload(WEIGHT_CONTROLLER_KEY)
        }
    }
}
