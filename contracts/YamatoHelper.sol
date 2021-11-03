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
    // To avoid stack too deep error in runRedeem()
    struct RunRedeemeArgs {
        address sender;
        uint256 maxRedemptionCjpyAmount;
        bool isCoreRedemption;
    }
    struct RunRedeemeVars {
        uint256 jpyPerEth;
        uint256 redeemStart;
        uint256 cjpyAmountStart;
        uint256 _reminder;
        address[] _pledgesOwner;
        uint256 _loopCount;
        uint8 _GRR;
    }
    struct RedeemedArgs {
        uint256 totalRedeemedCjpyAmount;
        uint256 totalRedeemedEthAmount;
        address[] _pledgesOwner;
        uint256 jpyPerEth;
        uint256 gasCompensationInETH;
    }

    function yamato() external view returns (address);

    function pool() external view returns (address);

    function priorityRegistry() external view returns (address);

    function neutralizePledge(IYamato.Pledge memory)
        external
        returns (IYamato.Pledge memory);

    function sweepDebt(IYamato.Pledge memory sPledge, uint256 maxSweeplable)
        external
        returns (
            IYamato.Pledge memory,
            uint256,
            uint256
        );

    function redeemPledge(
        IYamato.Pledge memory sPledge,
        uint256 cjpyAmount,
        uint256 jpyPerEth
    ) external returns (IYamato.Pledge memory, uint256);

    function runRedeem(RunRedeemeArgs memory)
        external
        returns (RedeemedArgs memory);

    function runSweep(address sender)
        external
        returns (
            uint256 _sweptAmount,
            uint256 gasCompensationInCJPY,
            address[] memory
        );

    function permitDeps(address _sender) external view returns (bool);

    function getTCR() external view returns (uint256 _TCR);
}

contract YamatoHelper is IYamatoHelper, YamatoBase {
    using PledgeLib for IYamato.Pledge;
    using PledgeLib for uint256;

    address public override yamato;
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
    modifier onlyYamato() {
        require(permitDeps(msg.sender), "Not deps");
        _;
    }

    function permitDeps(address _sender) public view override returns (bool) {
        bool permit;
        address[4] memory deps = getDeps();
        for (uint256 i = 0; i < deps.length; i++) {
            if (_sender == deps[i]) permit = true;
        }
        return permit;
    }

    /*
    ==============================
        Helpers
    ==============================
        - runRedeem
        - neutralizePledge
        - getTCR
    */
    function runRedeem(RunRedeemeArgs memory _args)
        public
        override
        onlyYamato
        returns (RedeemedArgs memory)
    {
        RunRedeemeVars memory vars;
        vars.jpyPerEth = IPriceFeed(__feed).fetchPrice();
        vars.cjpyAmountStart = _args.maxRedemptionCjpyAmount;
        vars._reminder = _args.maxRedemptionCjpyAmount;
        vars._pledgesOwner = new address[](
            IPriorityRegistry(priorityRegistry).pledgeLength()
        );
        vars._GRR = IYamato(yamato).GRR();

        while (vars._reminder > 0) {
            try IPriorityRegistry(priorityRegistry).popRedeemable() returns (
                IYamato.Pledge memory _redeemablePledge
            ) {
                if (
                    !_redeemablePledge.isCreated ||
                    _redeemablePledge.owner == address(0x00)
                ) {
                    break;
                }
                IYamato.Pledge memory sPledge = IYamato(yamato).getPledge(
                    _redeemablePledge.owner
                );
                if (!sPledge.isCreated) {
                    break;
                }
                if (sPledge.coll == 0) {
                    break;
                }

                /*
                    1. Expense collateral
                */
                (
                    IYamato.Pledge memory _redeemedPledge,
                    uint256 _reminderInThisTime
                ) = this.redeemPledge(sPledge, vars._reminder, vars.jpyPerEth);
                vars._reminder = _reminderInThisTime;
                sPledge = _redeemedPledge;
                IYamato(yamato).setPledge(sPledge);

                /*
                    2. Put the sludge pledge to the queue
                */
                try
                    IPriorityRegistry(priorityRegistry).upsert(sPledge)
                returns (uint256 _newICRpercent) {
                    sPledge.priority = _newICRpercent;
                    IYamato(yamato).setPledge(sPledge);
                } catch {
                    break;
                }
                vars._pledgesOwner[vars._loopCount] = _redeemablePledge.owner;
                vars._loopCount++;
            } catch {
                break;
            } /* Over-redemption Flow */
        }

        require(
            vars.cjpyAmountStart > vars._reminder,
            "No pledges are redeemed."
        );

        /*
            3. Update global state and ditribute colls.
        */
        uint256 totalRedeemedCjpyAmount = vars.cjpyAmountStart - vars._reminder;
        uint256 totalRedeemedEthAmount = (totalRedeemedCjpyAmount * 1e18) /
            vars.jpyPerEth;
        uint256 returningEthAmount = (totalRedeemedEthAmount *
            (100 - vars._GRR)) / 100;

        (uint256 totalColl, uint256 totalDebt, , , , ) = IYamato(yamato)
            .getStates();
        IYamato(yamato).setTotalDebt(totalColl - totalRedeemedCjpyAmount);
        IYamato(yamato).setTotalColl(totalDebt - totalRedeemedEthAmount);

        address _redemptionBearer;
        address _returningDestination;
        if (_args.isCoreRedemption) {
            /* 
            [ Core Redemption - Pool Subtotal ]
                (-) Redemption Reserve (CJPY)
                            v
                            v
                (+)  Fee Pool (ETH)
            */
            _redemptionBearer = pool;
            _returningDestination = ICjpyOS(IYamato(yamato).cjpyOS()).feePool();
            IPool(pool).useRedemptionReserve(totalRedeemedCjpyAmount);
        } else {
            /* 
            [ Normal Redemption - Account Subtotal ]
                (-) Bearer Balance (CJPY)
                            v
                            v
                (+) Bearer Balance (ETH)
            */
            _redemptionBearer = _args.sender;
            _returningDestination = _args.sender;
        }
        IPool(pool).sendETH(_returningDestination, returningEthAmount);
        ICjpyOS(__cjpyOS).burnCJPY(_redemptionBearer, totalRedeemedCjpyAmount);

        /*
            4. Gas compensation
        */
        uint256 gasCompensationInETH = totalRedeemedEthAmount *
            (vars._GRR / 100);
        IPool(pool).sendETH(_args.sender, gasCompensationInETH);

        return
            RedeemedArgs(
                totalRedeemedCjpyAmount,
                totalRedeemedEthAmount,
                vars._pledgesOwner,
                vars.jpyPerEth,
                gasCompensationInETH
            );
    }

    function runSweep(address sender)
        public
        override
        onlyYamato
        returns (
            uint256 _sweptAmount,
            uint256 gasCompensationInCJPY,
            address[] memory _pledgesOwner
        )
    {
        IPriceFeed(__feed).fetchPrice();
        uint256 sweepStart = IPool(pool).sweepReserve();
        require(sweepStart > 0, "Sweep failure: sweep reserve is empty.");
        uint8 _GRR = IYamato(yamato).GRR();
        uint256 maxGasCompensation = sweepStart * (_GRR / 100);
        uint256 _reminder = sweepStart - maxGasCompensation; //Note: Secure gas compensation
        uint256 _maxSweeplableStart = _reminder;
        address[] memory _pledgesOwner = new address[](
            IPriorityRegistry(priorityRegistry).pledgeLength()
        );
        uint256 _loopCount = 0;

        /*
            1. Sweeping
        */
        while (_reminder > 0) {
            try IPriorityRegistry(priorityRegistry).popSweepable() returns (
                IYamato.Pledge memory _sweepablePledge
            ) {
                if (!_sweepablePledge.isCreated) break; // Note: No any more redeemable pledges
                if (_sweepablePledge.owner == address(0x00)) break; // Note: No any more redeemable pledges

                IYamato.Pledge memory sPledge = IYamato(yamato).getPledge(
                    _sweepablePledge.owner
                );

                if (!sPledge.isCreated) break; // Note: registry-yamato mismatch
                if (sPledge.debt == 0) break; // Note: A once-swept pledge is called twice
                _pledgesOwner[_loopCount] = _sweepablePledge.owner; // Note: For event

                (
                    IYamato.Pledge memory _sweptPledge,
                    uint256 _sweptReminder,
                    uint256 sweepingAmount
                ) = this.sweepDebt(sPledge, _reminder);
                _reminder = _sweptReminder;
                sPledge = _sweptPledge;

                (, uint256 totalDebt, , , , ) = IYamato(yamato).getStates();
                IYamato(yamato).setTotalDebt(totalDebt - sweepingAmount);

                if (_reminder > 0) {
                    IPriorityRegistry(priorityRegistry).remove(sPledge);
                    sPledge = this.neutralizePledge(sPledge);
                }
                _loopCount++;
            } catch {
                break;
            } /* Oversweeping Flow */
        }
        require(
            _maxSweeplableStart > _reminder,
            "At least a pledge should be swept."
        );

        /*
            2. Gas compensation
        */
        uint256 _sweptAmount = sweepStart - _reminder;
        uint256 gasCompensationInCJPY = _sweptAmount * (_GRR / 100);
        IPool(pool).sendCJPY(sender, gasCompensationInCJPY); // Not sendETH. But redemption returns in ETH and so it's a bit weird.
        IPool(pool).useSweepReserve(gasCompensationInCJPY);

        return (_sweptAmount, gasCompensationInCJPY, _pledgesOwner);
    }

    /// @notice Use when removing a pledge
    function neutralizePledge(IYamato.Pledge memory _pledge)
        public
        override
        onlyYamato
        returns (IYamato.Pledge memory)
    {
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
    ) public override onlyYamato returns (IYamato.Pledge memory, uint256) {
        require(sPledge.coll > 0, "Can't expense zero pledge.");
        uint256 collValuation = (sPledge.coll * jpyPerEth) / 1e18;

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
            ethToBeExpensed = (redemptionAmount * 1e18) / jpyPerEth;
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
        public
        override
        onlyYamato
        returns (
            IYamato.Pledge memory,
            uint256,
            uint256
        )
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
        (uint256 totalColl, uint256 totalDebt, , , , ) = IYamato(yamato)
            .getStates();
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

    function getDeps() public view returns (address[4] memory) {
        return [yamato, address(this), pool, priorityRegistry];
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