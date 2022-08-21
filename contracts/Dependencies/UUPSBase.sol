pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "hardhat/console.sol";
import "../Interfaces/IUUPSEtherscanVerifiable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title Universal Upgradeability Proxy Standard Base Contract
/// @author 0xMotoko
contract UUPSBase is IUUPSEtherscanVerifiable, Initializable, UUPSUpgradeable {
    address public governance;
    address public pendingGovernance;
    address public tester;

    event NewPendingGovernance(address _sender);
    event UpdateGovernance(address _sender);
    event RevokeGovernance(address _sender);

    function __UUPSBase_init() internal initializer {
        __UUPSBase_init_unchained();
    }

    function __UUPSBase_init_unchained() internal initializer {
        governance = msg.sender;
        tester = msg.sender;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {}

    function _authorizeUpgrade(address) internal override onlyGovernance {}

    function getImplementation() external view override returns (address) {
        return _getImplementation();
    }

    modifier onlyGovernance() {
        require(msg.sender == governance, "You are not the governer.");
        _;
    }
    modifier onlyNewGovernance() {
        require(
            msg.sender == pendingGovernance,
            "You are not the pending governer."
        );
        _;
    }

    /*
        2-phase commit to avoid assigning non-owned address.
    */
    function setGovernance(address _newGoverner) external onlyGovernance {
        pendingGovernance = _newGoverner;
        emit NewPendingGovernance(_newGoverner);
    }

    function acceptGovernance() external onlyNewGovernance {
        governance = pendingGovernance;
        emit UpdateGovernance(governance);
    }

    /*
        To make the contract immutable.
    */
    function revokeGovernance() external onlyGovernance {
        governance = address(0);
        emit RevokeGovernance(msg.sender);
    }

    function revokeTester() public onlyGovernance {
        tester = address(0);
    }
}
