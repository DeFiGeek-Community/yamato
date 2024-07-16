pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2023 Yamato Protocol (DeFiGeek Community Japan)
 */

import "./Interfaces/IYMT.sol";

/**
 * @title YMT Vesting
 * @dev This contract manages the vesting of YMT tokens.
 */
contract YmtVesting {
    // Events
    event YmtAddressSet(address ymt);
    event AdminAddressSet(address admin);
    event ClaimAmountSet(address user, uint256 amount);

    // Constants
    uint256 private constant YEAR = 365 days;
    uint256 private constant VESTING_AMOUNT = 100_000_000 * 10 ** 18; // 100,000,000 YMT
    uint256 private constant LINEAR_DISTRIBUTION_DURATION = 5 * YEAR;
    uint256 private constant LINEAR_DISTRIBUTION_RATE =
        VESTING_AMOUNT / LINEAR_DISTRIBUTION_DURATION;

    // State variables
    address public ymtTokenAddress;
    address public contractAdmin;
    uint256 public totalLinearDistributionClaimed;
    bool public isClaimed;

    // Vesting mapping
    mapping(address => uint256) public vestingAmounts;
    mapping(address => uint256) public claimedAmounts;

    // Constructor
    constructor() {
        contractAdmin = msg.sender;
    }

    /**
     * @notice Sets a new admin for the contract.
     * @param newAdmin The address of the new admin.
     */
    function setAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Invalid admin address");
        contractAdmin = newAdmin;
        emit AdminAddressSet(newAdmin);
    }

    /**
     * @notice Sets the YMT token address.
     * @param ymtToken The address of the YMT token.
     */
    function setYmtToken(address ymtToken) external onlyAdmin {
        require(ymtToken != address(0), "Invalid YMT token address");
        ymtTokenAddress = ymtToken;
        emit YmtAddressSet(ymtToken);
    }

    /**
     * @notice Sets the claim amount for a user.
     * @param user The address of the user.
     * @param amount The amount of tokens to be claimed.
     */
    function setClaimAmount(address user, uint256 amount) external onlyAdmin {
        require(user != address(0), "Invalid user address");
        vestingAmounts[user] = amount;
        emit ClaimAmountSet(user, amount);
    }

    /**
     * @notice Sets claim amounts for multiple users.
     * @param users Array of user addresses.
     * @param amounts Array of claim amounts for each user.
     */
    function setMultipleClaimAmounts(
        address[] calldata users,
        uint256[] calldata amounts
    ) external onlyAdmin {
        require(
            users.length == amounts.length,
            "Users and amounts length mismatch"
        );

        for (uint256 i = 0; i < users.length; ++i) {
            require(users[i] != address(0), "Invalid user address");
            vestingAmounts[users[i]] = amounts[i];
            emit ClaimAmountSet(users[i], amounts[i]);
        }
    }

    /**
     * @notice Allows users to claim their V1 Retroactive Rewards based on a one-year linear vesting schedule.
     * @dev Calculates the claimable amount based on the time elapsed since the distribution start, then transfers the tokens to the user's address. Any unclaimed amount from the previous claims is considered.
     */
    function claimV1RetroactiveRewards() external returns (uint256) {
        require(vestingAmounts[msg.sender] > 0, "No tokens to claim");
        uint256 distributionStart = IYMT(ymtTokenAddress).startTime();
        uint256 timeElapsed = block.timestamp - distributionStart;
        uint256 claimableAmount;
        if (block.timestamp >= distributionStart + YEAR) {
            claimableAmount = vestingAmounts[msg.sender];
        } else {
            claimableAmount = (timeElapsed * vestingAmounts[msg.sender]) / YEAR;
        }
        uint256 availableToClaim = claimableAmount - claimedAmounts[msg.sender];
        require(availableToClaim > 0, "No tokens available to claim");
        claimedAmounts[msg.sender] += availableToClaim;
        IYMT(ymtTokenAddress).transfer(msg.sender, availableToClaim);
        return availableToClaim;
    }

    /**
     * @notice Allows the admin to claim tokens from five-year linear distribution.
     * @dev Transfers claimable tokens to the admin address.
     */
    function claimFiveYearVestingTokens() external onlyAdmin {
        require(
            totalLinearDistributionClaimed < VESTING_AMOUNT,
            "All tokens have already been claimed"
        );

        uint256 distributionStart = IYMT(ymtTokenAddress).startTime();
        uint256 timeElapsed = block.timestamp - distributionStart;
        uint256 claimableAmount;
        if (
            block.timestamp >= distributionStart + LINEAR_DISTRIBUTION_DURATION
        ) {
            claimableAmount = VESTING_AMOUNT;
        } else {
            claimableAmount = timeElapsed * LINEAR_DISTRIBUTION_RATE;
        }
        uint256 availableToClaim = claimableAmount -
            totalLinearDistributionClaimed;
        totalLinearDistributionClaimed += availableToClaim;
        IYMT(ymtTokenAddress).transfer(contractAdmin, availableToClaim);
    }

    /**
     * @notice Allows the admin to claim tokens from two-year vesting period.
     * @dev Transfers claimable tokens to the admin address.
     */
    function claimTwoYearVestingTokens() external onlyAdmin {
        uint256 distributionStart = IYMT(ymtTokenAddress).startTime();
        require(
            distributionStart + 2 * YEAR < block.timestamp,
            "Distribution period has ended"
        );
        require(!isClaimed, "All tokens have already been claimed");
        isClaimed = true;
        IYMT(ymtTokenAddress).transfer(contractAdmin, VESTING_AMOUNT);
    }

    // Modifier
    modifier onlyAdmin() {
        require(msg.sender == contractAdmin, "Caller is not the admin");
        _;
    }
}
