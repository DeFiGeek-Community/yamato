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
contract UUPSBase is
    IUUPSEtherscanVerifiable,
    Initializable,
    UUPSUpgradeable
{
    address governance;
    address tester;

    function __UUPSBase_init() public initializer {
        __UUPSBase_init_unchained();
    }
    function __UUPSBase_init_unchained() public initializer {
        governance = msg.sender;
        tester = msg.sender;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function _authorizeUpgrade(address) internal override onlyGovernance {}

    function getImplementation() external view override returns (address) {
        return _getImplementation();
    }

    modifier onlyGovernance() {
        require(msg.sender == governance, "You are not the governer.");
        _;
    }
    modifier onlyNewGovernance() {
        require(msg.sender == pendingGovernance, "You are not the pending governer.");
        _;
    }
    modifier onlyTester() {
        require(msg.sender == tester, "You are not the tester.");
        _;
    }


    /*
        2-phase commit to avoid assigning non-owned address.
    */
    function setGovernance(address _newGoverner) public onlyGovernance {
        pendingGovernance = _newGoverner;
        emit GovernerPended(msg.sender, _newGoverner);
    }
    function acceptGovernance() public onlyNewGovernance {
        governance = pendingGovernance;
        emit GovernerAccepted(msg.sender, governance);
    }
    /*
        To make the contract immutable.
    */
    function revokeGovernance() public onlyGovernance {
        governance = address(0);
    }
    

    function revokeTester() public onlyGovernance {
        tester = address(0);
    }
}
