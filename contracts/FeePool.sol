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
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

contract FeePool is
    IUUPSEtherscanVerifiable,
    Initializable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    address veYMT;
    mapping(address => bool) protocolWhitelist;
    address governance;

    event Withdrawn(address, uint256);
    event WithdrawnByProtocol(address, uint256);
    event Received(address, uint256);
    event VeYMTSet(address, address);

    /*
        ====================
        Proxy Functions Start
        ====================
    */
    function initialize() public initializer {
        __ReentrancyGuard_init();
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

    function withdraw(uint256 amount) public onlyVeYMT nonReentrant {
        emit Withdrawn(msg.sender, amount);
    }

    function withdrawFromProtocol(uint256 amount)
        public
        onlyProtocols
        nonReentrant
    {
        emit WithdrawnByProtocol(msg.sender, amount);
    }

    function addProtocol(address protocol) public onlyGovernance {}

    function setVeYMT(address _veYMT) public onlyGovernance {
        veYMT = _veYMT;
        emit VeYMTSet(msg.sender, _veYMT);
    }

    modifier onlyVeYMT() {
        require(
            IveYMT(veYMT).balanceOfAt(msg.sender, block.number) > 0,
            "You are not a veYMT holder."
        );
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

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }
}
