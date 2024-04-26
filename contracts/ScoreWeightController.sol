pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2023 Yamato Protocol (DeFiGeek Community Japan)
 */

/**
 * @title Score Weight Controller
 * @notice Controls liquidity scores and the issuance of token through the scores
 */

//dao-contracts
import "./Interfaces/IveYMT.sol";
import "./Dependencies/UUPSBase.sol";

contract ScoreWeightController is UUPSBase {
    string constant YMT_SLOT_ID = "deps.YMT";
    string constant VEYMT_SLOT_ID = "deps.veYMT";

    uint256 constant MULTIPLIER = 10 ** 18;

    event NewScore(address addr, uint256 weight);

    int128 public nScores; //number of scores

    // Needed for enumeration
    mapping(address => int128) public scores;

    /**
     * @notice Contract constructor
     * @param ymtAddr `Token` contract address
     * @param veYmtAddr `VotingEscrow` contract address
     */
    function initialize(address ymtAddr, address veYmtAddr) public initializer {
        require(ymtAddr != address(0));
        require(veYmtAddr != address(0));

        __UUPSBase_init();
        bytes32 YMT_LEY = bytes32(keccak256(abi.encode(YMT_SLOT_ID)));
        bytes32 VEYMT_LEY = bytes32(keccak256(abi.encode(VEYMT_SLOT_ID)));
        assembly {
            sstore(YMT_LEY, ymtAddr)
            sstore(VEYMT_LEY, veYmtAddr)
        }
    }

    /**
     * @notice Add Score `addr` of type `score_type` with weight `weight`
     * @param addr_ Score address
     * @param weight_ Score type
     */
    function addScore(address addr_, uint256 weight_) external onlyGovernance {
        int128 _n = nScores;
        unchecked {
            nScores = _n + 1;
        }
        scores[addr_] = nScores;

        emit NewScore(addr_, weight_);
    }

    /**
     * @notice Checkpoint to fill data common for all scores
     */
    function checkpoint() external {
        // Add to V2.0
    }

    /**
     * @notice Checkpoint to fill data for both a specific score and common for all scores
     * @param addr_ Score address
     */
    function checkpointScore(address addr_) external {
        // Add to V2.0
    }

    /**
     * @notice Get Score relative weight (not more than 1.0) normalized to 1e18
     *        (e.g. 1.0 == 1e18). Inflation which will be received by it is
     *        inflation_rate * relative_weight / 1e18
     * @param addr_ Score address
     * @param time_ Relative weight at the specified timestamp in the past or present
     * @return Value of relative weight normalized to 1e18
     */
    function scoreRelativeWeight(
        address addr_,
        uint256 time_
    ) external view returns (uint256) {
        return MULTIPLIER;
    }

    /**
     * @notice Change weight of score `addr` to `weight`
     * @param addr_ `ScoreController` contract address
     * @param weight_ New Score weight
     */
    function changeScoreWeight(
        address addr_,
        uint256 weight_
    ) external onlyGovernance {
        // Add to V2.0
    }

    /*
        =====================
        Getter Functions
        =====================
    */
    function YMT() public view returns (address ymtAddr) {
        bytes32 YMT_LEY = bytes32(keccak256(abi.encode(YMT_SLOT_ID)));
        assembly {
            ymtAddr := sload(YMT_LEY)
        }
    }

    function veYMT() public view returns (address ymtAddr) {
        bytes32 VEYMT_LEY = bytes32(keccak256(abi.encode(VEYMT_SLOT_ID)));
        assembly {
            ymtAddr := sload(VEYMT_LEY)
        }
    }
}
