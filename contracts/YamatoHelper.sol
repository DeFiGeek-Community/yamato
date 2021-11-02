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
import "./YMT.sol";
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
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "./YamatoBase.sol";

/// @title Yamato Pledge Manager Contract
/// @author 0xMotoko

interface IYamatoHelper {
    function pool() external view returns (address);
    function priorityRegistry() external view returns (address);
    function neutralizePledge(IYamato.Pledge memory) external returns (IYamato.Pledge memory);
    function sweepDebt(IYamato.Pledge memory sPledge, uint256 maxSweeplable)
        external
        returns (IYamato.Pledge memory, uint256, uint256);
    function redeemPledge(
        IYamato.Pledge memory sPledge,
        uint256 cjpyAmount,
        uint256 jpyPerEth
    ) external returns (IYamato.Pledge memory, uint256);

    function getTCR() external view returns (uint256 _TCR);
}

contract YamatoHelper is IYamatoHelper, YamatoBase {
    using PledgeLib for IYamato.Pledge;
    using PledgeLib for uint256;

    address yamato;
    address public override pool;
    address public override priorityRegistry;
    bool poolInitialized;
    bool priorityRegistryInitialized;

    /*
        ==============================
            Set-up functions
        ==============================
        - setPool
        - setPriorityRegistry
    */
    function initialize(address _yamato) public initializer {
        yamato = _yamato;
        __YamatoBase_init(IYamato(yamato).cjpyOS());
    }

    function setPool(address _pool) public onlyGovernance onlyOnceForSetPool {
        pool = _pool;
    }

    function setPriorityRegistry(address _priorityRegistry)
        public
        onlyGovernance
        onlyOnceForSetPriorityRegistry
    {
        priorityRegistry = _priorityRegistry;
    }

    modifier onlyOnceForSetPool() {
        require(!poolInitialized, "Pool is already initialized.");
        poolInitialized = true;
        _;
    }
    modifier onlyOnceForSetPriorityRegistry() {
        require(
            !priorityRegistryInitialized,
            "PriorityRegistry is already initialized."
        );
        priorityRegistryInitialized = true;
        _;
    }
    modifier onlyYamato(){
        require(msg.sender == yamato, "Not called by Yamato.");
        _;
    }




    /*
    ==============================
        Helpers
    ==============================
        - neutralizePledge
        - getTCR
    */

    /// @notice Use when removing a pledge
    function neutralizePledge(IYamato.Pledge memory _pledge) public onlyYamato override returns (IYamato.Pledge memory) {
        _pledge.priority = 0;
        _pledge.isCreated = false;
        _pledge.owner = address(0);
        return _pledge;
    }


    /// @notice Use when redemption
    function redeemPledge(
        IYamato.Pledge memory sPledge,
        uint256 cjpyAmount,
        uint256 jpyPerEth
    ) public onlyYamato override returns (IYamato.Pledge memory, uint256) {
        require(sPledge.coll > 0, "Can't expense zero pledge.");
        uint256 collValuation = sPledge.coll * jpyPerEth / 1e18;

        /*
            1. Calc reminder
        */
        uint256 redemptionAmount;
        uint256 reminder;
        uint256 ethToBeExpensed;
        if (collValuation < cjpyAmount) {
            redemptionAmount = collValuation;
            ethToBeExpensed = sPledge.coll;
            reminder = cjpyAmount - collValuation;
        } else {
            redemptionAmount = cjpyAmount;
            ethToBeExpensed = redemptionAmount * 1e18 / jpyPerEth;
            reminder = 0;
        }

        /*
            3. Update macro state
        */
        sPledge.coll -= ethToBeExpensed; // Note: storage variable in the internal func doesn't change state!
        sPledge.debt -= redemptionAmount;
        return (sPledge, reminder);
    }

    function sweepDebt(IYamato.Pledge memory sPledge, uint256 maxSweeplable)
        public onlyYamato override
        returns (IYamato.Pledge memory, uint256, uint256)
    {
        uint256 sweepingAmount;
        uint256 reminder;

        /*
            1. sweeping amount and reminder calculation
        */
        if (maxSweeplable > sPledge.debt) {
            sweepingAmount = sPledge.debt;
            reminder = maxSweeplable - sPledge.debt;
        } else {
            sweepingAmount = maxSweeplable;
            reminder = 0;
        }

        /*
            2. Sweeping
        */
        sPledge.debt -= sweepingAmount;

        /*
            3. Budget reduction
        */
        IPool(pool).useSweepReserve(sweepingAmount);
        ICjpyOS(__cjpyOS).burnCJPY(pool, sweepingAmount);

        return (sPledge, reminder, sweepingAmount);
    }

    /// @notice Calculate TCR
    /// @dev (totalColl*jpyPerEth)/totalDebt
    /// @return _TCR in uint256
    function getTCR() public view override returns (uint256 _TCR) {
        (uint256 totalColl,uint256 totalDebt,,,,) = IYamato(yamato).getStates();
        IYamato.Pledge memory _pseudoPledge = IYamato.Pledge(
            totalColl,
            totalDebt,
            true,
            msg.sender,
            0
        );
        if (totalColl == 0 && totalColl == 0) {
            _TCR = 0;
        } else {
            _TCR = _pseudoPledge.getICR(__feed);
        }
    }





    /*
    ==============================
        Testability Helpers
    ==============================
        - updateTCR()
        - setPriorityRegistryInTest()
    */

    function setPriorityRegistryInTest(address _priorityRegistry)
        external
        onlyTester
    {
        priorityRegistry = _priorityRegistry;
    }
}
