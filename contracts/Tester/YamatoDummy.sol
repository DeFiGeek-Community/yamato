pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "../Dependencies/PledgeLib.sol";
import "../Interfaces/IYamato.sol";
import "../Interfaces/IFeePool.sol";
import "../Interfaces/ICurrencyOS.sol";
import "../Interfaces/IPriorityRegistryV6.sol";
import "../Pool.sol";
import "../PriceFeed.sol";
import "hardhat/console.sol";

contract YamatoDummy {
    using PledgeLib for IYamato.Pledge;
    using PledgeLib for uint256;
    IPriorityRegistryV6 priorityRegistry;
    IPool pool;
    address public currencyOS;
    address public feePool;
    address public feed;
    address governance;
    address tester;
    uint8 public MCR = 130; // MinimumCollateralizationRatio in pertenk
    uint256 public collFloor = 1e17;
    uint256 public constant maxRedeemableCount = 50;
    uint256 public constant CHECKPOINT_BUFFER = 55;
    mapping(address => IYamato.Pledge) pledges;

    constructor(address _currencyOS) {
        currencyOS = _currencyOS;
        governance = msg.sender;
        tester = msg.sender;
        feePool = ICurrencyOS(currencyOS).feePool();
        feed = ICurrencyOS(currencyOS).priceFeed();
    }

    function setPriorityRegistry(
        address _priorityRegistry
    ) public onlyGovernance {
        priorityRegistry = IPriorityRegistryV6(_priorityRegistry);
    }

    function setPool(address _pool) public onlyGovernance {
        pool = IPool(_pool);
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
    function FR(
        uint256 _icrpertenk
    ) external view onlyTester returns (uint256) {
        return _icrpertenk.FR();
    }

    function bypassUpsert(IYamato.Pledge calldata _pledge) external onlyTester {
        pledges[_pledge.owner] = _pledge;
        priorityRegistry.upsert(_pledge);
    }

    function bypassRemove(IYamato.Pledge calldata _pledge) external onlyTester {
        priorityRegistry.remove(_pledge);
    }

    function bypassRankedQueuePush(
        uint256 _icr,
        IYamato.Pledge calldata _pledge
    ) external onlyTester {
        priorityRegistry.rankedQueuePush(_icr, _pledge.owner);
    }

    function bypassRankedQueuePop(
        uint256 _icr
    ) external onlyTester returns (address) {
        return priorityRegistry.rankedQueuePop(_icr);
    }

    function bypassRankedQueueSearchAndDestroy(
        uint256 _icr,
        uint256 _i
    ) external onlyTester {
        priorityRegistry.rankedQueueSearchAndDestroy(_icr, _i);
    }

    function bypassDepositRedemptionReserve(
        uint256 _amount
    ) external onlyTester {
        pool.depositRedemptionReserve(_amount);
    }

    function bypassUseRedemptionReserve(uint256 _amount) external onlyTester {
        pool.useRedemptionReserve(_amount);
    }

    function bypassDepositSweepReserve(uint256 _amount) external onlyTester {
        pool.depositSweepReserve(_amount);
    }

    function bypassUseSweepReserve(uint256 _amount) external onlyTester {
        pool.useSweepReserve(_amount);
    }

    function bypassReceive() external payable onlyTester {
        (bool success, ) = payable(address(pool)).call{value: msg.value}("");
        require(success, "Transfer failed.");
    }

    function bypassSendETH(
        address _recipient,
        uint256 _amount
    ) external onlyTester {
        pool.sendETH(_recipient, _amount);
    }

    function bypassSendCurrency(
        address _recipient,
        uint256 _amount
    ) external onlyTester {
        pool.sendCurrency(_recipient, _amount);
    }

    function getICR(uint256 _coll, uint256 _debt) external returns (uint256) {
        return IYamato.Pledge(_coll, _debt, true, msg.sender, 0).getICR(feed);
    }

    function getDeps() public view returns (address[4] memory) {
        return [
            address(this),
            address(this),
            address(pool),
            address(priorityRegistry)
        ];
    }

    function permitDeps(address _sender) public view returns (bool) {
        bool permit;
        address[4] memory deps = getDeps();
        for (uint256 i = 0; i < deps.length; i++) {
            if (_sender == deps[i]) permit = true;
        }
        return permit;
    }

    function getPledge(
        address _owner
    ) public view returns (IYamato.Pledge memory _p) {
        _p = pledges[_owner];
    }
}
