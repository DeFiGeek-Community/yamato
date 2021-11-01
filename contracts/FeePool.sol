pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "./Interfaces/IUUPSEtherscanVerifiable.sol";
import "./veYMT.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract FeePool is
    IUUPSEtherscanVerifiable,
    Initializable,
    UUPSUpgradeable,
    ReentrancyGuard
{
    address veYMT;
    mapping(address=>bool) protocolWhitelist;
    address governance;

    /*
        ====================
        Proxy Functions Start
        ====================
    */
    function initialize() public initializer {
        governance = msg.sender;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function _authorizeUpgrade(address) internal override onlyGovernance {}

    function getImplementation() external view override returns (address) {
        return _getImplementation();
    }
    /*
        ====================
        Proxy Functions End
        ====================
    */




    /*
        ====================
        Original Functions
        ====================
    */
    function withdraw(uint amount) public onlyVeYMT nonReentrant {
    }        
    function withdrawFromProtocol(uint amount) public onlyProtocols nonReentrant {
    }
    function addProtocol(address protocol) public onlyGovernance {
    }
    function setVeYMT(address _veYMT) public onlyGovernance {
        veYMT = _veYMT;
    }

    modifier onlyVeYMT(){
        require(IveYMT(veYMT).balanceOfAt(msg.sender, block.number) > 0, "You are not a veYMT holder.");
        _;
    }
    modifier onlyGovernance() {
        require(msg.sender == governance, "You are not the governer.");
        _;
    }
    modifier onlyProtocols() {
        require(protocolWhitelist[msg.sender], "You are not in the whitelist");
        _;        
    }
}
