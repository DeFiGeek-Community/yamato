pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "../PriorityRegistry.sol";
import "../Dependencies/PledgeLib.sol";
import "../Interfaces/IYamato.sol";
import "../Interfaces/IFeePool.sol";
import "../CjpyOS.sol";
import "../PriceFeed.sol";

contract YamatoDummy {
    using PledgeLib for IYamato.Pledge;
    using PledgeLib for uint256;
    IPriorityRegistry priorityRegistry;
    ICjpyOS cjpyOS;
    IFeePool feePool;
    address public feed;
    address governance;
    address tester;
    uint8 public MCR = 110; // MinimumCollateralizationRatio in pertenk

    constructor(address _cjpyOS) {
        cjpyOS = ICjpyOS(_cjpyOS);
        governance = msg.sender;
        tester = msg.sender;
        feePool = IFeePool(cjpyOS.feePoolProxy());
        feed = cjpyOS.feed();
    }

    function setPriorityRegistry(address _priorityRegistry)
        public
        onlyGovernance
    {
        priorityRegistry = IPriorityRegistry(_priorityRegistry);
    }

    modifier onlyGovernance() {
        require(msg.sender == governance, "You are not the governer.");
        _;
    }
    modifier onlyTester() {
        require(msg.sender == tester, "You are not the tester.");
        _;
    }

    /*
    ==============================
        Testability Helpers
    ==============================
        - FR()
        - bypassUpsert()
        - bypassRemove()
        - getICR()
    */
    function FR(uint256 _icrpertenk)
        external
        view
        onlyTester
        returns (uint256)
    {
        return _icrpertenk.FR();
    }

    function bypassUpsert(IYamato.Pledge calldata _pledge) external onlyTester {
        priorityRegistry.upsert(_pledge);
    }

    function bypassRemove(IYamato.Pledge calldata _pledge) external onlyTester {
        priorityRegistry.remove(_pledge);
    }

    function bypassPopRedeemable() external onlyTester {
        priorityRegistry.popRedeemable();
    }

    function bypassPopSweepable() external onlyTester {
        priorityRegistry.popSweepable();
    }

    function getICR(uint256 _coll, uint256 _debt) external returns (uint256) {
        return IYamato.Pledge(_coll, _debt, true, msg.sender, 0).getICR(feed);
    }
}
