pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "./Pool.sol";
import "./PriorityRegistry.sol";
import "./CjpyOS.sol";
import "./PriceFeed.sol";
import "./Dependencies/PledgeLib.sol";
import "./Dependencies/SafeMath.sol";
import "./Interfaces/IYamato.sol";
import "./Interfaces/IFeePool.sol";
import "hardhat/console.sol";
import "./Interfaces/IUUPSEtherscanVerifiable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title Yamato Pledge Manager Contract
/// @author 0xMotoko
contract YamatoBase is
    IUUPSEtherscanVerifiable,
    Initializable,
    UUPSUpgradeable
{
    address internal __cjpyOS;
    address internal __feePool;
    address internal __feed;
    address governance;
    address tester;

    function __YamatoBase_init(address _cjpyOS) public initializer {
        governance = msg.sender;
        tester = msg.sender;
        __cjpyOS = _cjpyOS;
        __feePool = ICjpyOS(_cjpyOS).feePool();
        __feed = ICjpyOS(_cjpyOS).feed();
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
    modifier onlyTester() {
        require(msg.sender == tester, "You are not the tester.");
        _;
    }

    function revokeGovernance() public onlyGovernance {
        governance = address(0);
    }

    function transferGovernance(address _newGoverner) public onlyGovernance {
        governance = _newGoverner;
    }

    function revokeTester() public onlyGovernance {
        tester = address(0);
    }
}
