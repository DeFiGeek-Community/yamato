pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "./Interfaces/IveYMT.sol";
import "./Interfaces/IFeePool.sol";
import "./Dependencies/UUPSBase.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

contract FeePool is IFeePool, UUPSBase, ReentrancyGuardUpgradeable {
    string constant VEYMT_SLOT_ID = "deps.veYMT";

    mapping(address => bool) protocolWhitelist;

    event Withdrawn(address, uint256);
    event WithdrawnByProtocol(address, uint256);
    event Received(address, uint256);
    event VeYMTSet(address, address);

    function initialize() public initializer {
        __UUPSBase_init();
        __ReentrancyGuard_init();
    }

    /*
        ====================
        Original Functions
        ====================
    */

    function withdraw(uint256 amount) public onlyVeYMT nonReentrant {
        emit Withdrawn(msg.sender, amount);
    }

    function withdrawFromProtocol(
        uint256 amount
    ) public override onlyProtocols nonReentrant {
        emit WithdrawnByProtocol(msg.sender, amount);
    }

    function addProtocol(address protocol) public onlyGovernance {}

    function setVeYMT(address _veymt) public onlyGovernance {
        bytes32 VEYMT_KEY = bytes32(keccak256(abi.encode(VEYMT_SLOT_ID)));
        assembly {
            sstore(VEYMT_KEY, _veymt)
        }
        emit VeYMTSet(msg.sender, _veymt);
    }

    function veYMT() public view override returns (address _veYMT) {
        bytes32 VEYMT_KEY = bytes32(keccak256(abi.encode(VEYMT_SLOT_ID)));
        assembly {
            _veYMT := sload(VEYMT_KEY)
        }
    }

    modifier onlyVeYMT() {
        require(
            IveYMT(veYMT()).balanceOfAt(msg.sender, block.number) > 0,
            "You are not a veYMT holder."
        );
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
