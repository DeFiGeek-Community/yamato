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
import "./YamatoHelper.sol";

/// @title Yamato Pledge Manager Contract
/// @author 0xMotoko
contract Yamato is
    IYamato,
    YamatoBase,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    using PledgeLib for IYamato.Pledge;
    using PledgeLib for uint256;

    IYamatoHelper helper;
    IPool pool;
    IPriorityRegistry priorityRegistry;

    mapping(address => Pledge) pledges;
    uint256 totalColl;
    uint256 totalDebt;
    uint256 public TCR;

    mapping(address => uint256) withdrawLocks;
    mapping(address => uint256) depositAndBorrowLocks;

    uint8 public override MCR; // MinimumCollateralizationRatio in pertenk
    uint8 public RRR; // RedemptionReserveRate in pertenk
    uint8 public SRR; // SweepReserveRate in pertenk
    uint8 public GRR; // GasReserveRate in pertenk

    /*
        ==============================
            Set-up functions
        ==============================
        - setPool
        - setPriorityRegistry
        - revokeGovernance
        - revokeTester
    */
    function initialize(address _cjpyOS) public initializer {
        MCR = 110;
        RRR = 80;
        SRR = 20;
        GRR = 1;
        __ReentrancyGuard_init();
        __Pausable_init();
        __YamatoBase_init(_cjpyOS);
    }
    function setYamatoHelper(address _yamatoHelper) public onlyGovernance {
        helper = IYamatoHelper(_yamatoHelper);
        pool = IPool(helper.pool());
        priorityRegistry = IPriorityRegistry(helper.priorityRegistry());
    }

    /*
    ==============================
        Single Pledge Actions
    ==============================
        - deposit
        - borrow
        - repay
        - withdraw
    */

    /// @notice Make a Pledge with ETH. "Top-up" supported.
    /// @dev We haven't supported ERC-20 pledges and pool
    function deposit() public payable nonReentrant whenNotPaused {
        IPriceFeed(__feed).fetchPrice();
        uint256 ethAmount = msg.value;

        /*
            1. Write to pledge
        */
        Pledge storage pledge = pledges[msg.sender];

        pledge.coll += ethAmount;
        totalColl += ethAmount;
        if (!pledge.isCreated) {
            // new pledge
            pledge.isCreated = true;
            pledge.owner = msg.sender;
        }

        /*
            2. Update PriorityRegistry
        */
        pledge.priority = priorityRegistry.upsert(pledge);

        /*
            3. Send ETH to pool
        */
        (bool success, ) = payable(address(pool)).call{value: ethAmount}("");
        require(success, "transfer failed");
        pool.lockETH(ethAmount);
        depositAndBorrowLocks[msg.sender] = block.number;

        /*
            4. Event
        */
        emit Deposited(msg.sender, ethAmount);
    }

    /// @notice Borrow in CJPY. In JPY term, 15.84%=RR, 0.16%=RRGas, 3.96%=SR, 0.4%=SRGas
    /// @dev This function can't be executed just the same block with your deposit
    /// @param borrowAmountInCjpy maximal redeemable amount
    function borrow(uint256 borrowAmountInCjpy) public whenNotPaused {
        /*
            1. Ready
        */
        IPriceFeed(__feed).fetchPrice();
        Pledge storage pledge = pledges[msg.sender];
        uint256 _ICRAfter = pledge.toMem().addDebt(borrowAmountInCjpy).getICR(
            __feed
        );
        uint256 fee = (borrowAmountInCjpy * _ICRAfter.FR()) / 10000;
        uint256 returnableCJPY = borrowAmountInCjpy - fee;

        /*
            2. Validate
        */
        require(
            depositAndBorrowLocks[msg.sender] < block.number,
            "Borrowing should not be executed within the same block with your deposit."
        );
        require(pledge.isCreated, "This pledge is not created yet.");
        require(
            _ICRAfter >= uint256(MCR) * 100,
            "This minting is invalid because of too large borrowing."
        );
        require(fee > 0, "fee must be more than zero.");
        require(returnableCJPY > 0, "(borrow - fee) must be more than zero.");

        /*
            3. Top-up scenario
        */
        pledge.debt += borrowAmountInCjpy;
        totalDebt += borrowAmountInCjpy;
        TCR = helper.getTCR();

        /*
            4. Update PriorityRegistry
        */
        pledge.priority = priorityRegistry.upsert(pledge);

        /*
            5. Cheat guard
        */
        withdrawLocks[msg.sender] = block.timestamp + 3 days;

        /*
            6. Borrowed fund & fee transfer
        */
        ICjpyOS(__cjpyOS).mintCJPY(msg.sender, returnableCJPY); // onlyYamato
        ICjpyOS(__cjpyOS).mintCJPY(address(pool), fee); // onlyYamato

        if (pool.redemptionReserve() / 5 <= pool.sweepReserve()) {
            pool.depositRedemptionReserve(fee);
        } else {
            pool.depositSweepReserve(fee);
        }

        /*
            7. Event
        */
        emit Borrowed(msg.sender, borrowAmountInCjpy, fee);
    }

    /// @notice Recover the collateral of one's pledge.
    /// @dev Need allowance. TCR will go up.
    /// @param cjpyAmount maximal redeemable amount
    function repay(uint256 cjpyAmount) public {
        /*
            1. Get feed and Pledge
        */
        IPriceFeed(__feed).fetchPrice();
        Pledge storage pledge = pledges[msg.sender];

        /*
            2. Check repayability
        */
        require(cjpyAmount > 0, "You are repaying no CJPY");
        require(
            pledge.debt >= cjpyAmount,
            "You are repaying more than you are owing."
        );

        /*
            2-1. Update pledge and the global variable
        */
        pledge.debt -= cjpyAmount;
        totalDebt -= cjpyAmount;
        TCR = helper.getTCR();

        /*
            3. Update PriorityRegistry
        */
        pledge.priority = priorityRegistry.upsert(pledge);

        /*
            4-1. Charge CJPY
            4-2. Return coll to the redeemer
        */
        ICjpyOS(__cjpyOS).burnCJPY(msg.sender, cjpyAmount);

        /*
            5. Event
        */
        emit Repaid(msg.sender, cjpyAmount);
    }

    /// @notice Withdraw collaterals from one's pledge.
    /// @dev Nood reentrancy guard. TCR will go down.
    /// @param ethAmount withdrawal amount
    function withdraw(uint256 ethAmount) public nonReentrant {
        /*
            1. Get feed and pledge
        */
        IPriceFeed(__feed).fetchPrice();
        Pledge storage pledge = pledges[msg.sender];

        /*
            2. Validate
        */
        require(
            ethAmount <= pledge.coll,
            "Withdrawal amount must be less than equal to the target coll amount."
        );
        require(
            ethAmount <= totalColl,
            "Withdrawal amount must be less than equal to the total coll amount."
        );
        require(
            withdrawLocks[msg.sender] <= block.timestamp,
            "Withdrawal is being locked for this sender."
        );
        require(
            pledge.toMem().getICR(__feed) >= uint256(MCR) * 100,
            "Withdrawal failure: ICR is not more than MCR."
        );

        /*
            3. Update pledge
        */

        // Note: SafeMath unintentionally checks full withdrawal
        pledge.coll = pledge.coll - ethAmount;
        totalColl = totalColl - ethAmount;
        TCR = helper.getTCR();

        /*
            4. Validate and update PriorityRegistry
        */
        if (pledge.coll == 0 && pledge.debt == 0) {
            /*
                4-a. Clean full withdrawal
            */
            priorityRegistry.remove(pledge);
            pledge.sync(helper.neutralizePledge(pledge.toMem()));
        } else {
            /*
                4-b. Reasonable partial withdrawal
            */
            require(
                pledge.toMem().getICR(__feed) >= uint256(MCR) * 100,
                "Withdrawal failure: ICR can't be less than MCR after withdrawal."
            );
            pledge.priority = priorityRegistry.upsert(pledge);
        }

        /*
            5-1. Charge CJPY
            5-2. Return coll to the withdrawer
        */
        pool.sendETH(msg.sender, ethAmount);

        /*
            6. Event
        */
        emit Withdrawn(msg.sender, ethAmount);
    }

    /*
    ==============================
        Multi Pledge Actions
    ==============================
        - redeem
        - sweep
    */

    /// @notice Retrieve ETH collaterals from Pledges by burning CJPY
    /// @dev Need allowance. Lowest ICR Pledges get redeemed first. TCR will go up. coll=0 pledges are to be remained.
    /// @param maxRedemptionCjpyAmount maximal redeemable amount
    /// @param isCoreRedemption A flag for who to pay
    function redeem(uint256 maxRedemptionCjpyAmount, bool isCoreRedemption)
        public
        nonReentrant
        whenNotPaused
    {
        uint256 jpyPerEth = IPriceFeed(__feed).fetchPrice();
        uint256 redeemStart = pool.redemptionReserve();
        uint256 cjpyAmountStart = maxRedemptionCjpyAmount;
        address[] memory _pledgesOwner = new address[](
            priorityRegistry.pledgeLength()
        );
        uint256 _loopCount = 0;

        while (maxRedemptionCjpyAmount > 0) {
            try priorityRegistry.popRedeemable() returns (
                Pledge memory _redeemablePledge
            ) {
                if (
                    !_redeemablePledge.isCreated ||
                    _redeemablePledge.owner == address(0x00)
                ) {
                    break;
                }
                Pledge storage sPledge = pledges[_redeemablePledge.owner];
                if (!sPledge.isCreated) {
                    break;
                }
                if (sPledge.coll == 0) {
                    break;
                }

                /*
                    1. Expense collateral
                */
                (Pledge memory _redeemedPledge, uint256 maxRedemptionCjpyAmount) = helper.redeemPledge(
                    sPledge,
                    maxRedemptionCjpyAmount,
                    jpyPerEth
                );
                sPledge.sync(_redeemedPledge);

                /*
                    2. Put the sludge pledge to the queue
                */
                try priorityRegistry.upsert(sPledge.toMem()) returns (
                    uint256 _newICRpercent
                ) {
                    sPledge.priority = _newICRpercent;
                } catch {
                    break;
                }
                _pledgesOwner[_loopCount] = _redeemablePledge.owner;
                _loopCount++;
            } catch {
                break;
            } /* Over-redemption Flow */
        }

        require(
            cjpyAmountStart > maxRedemptionCjpyAmount,
            "No pledges are redeemed."
        );

        /*
            3. Update global state and ditribute colls.
        */
        uint256 totalRedeemedCjpyAmount = cjpyAmountStart -
            maxRedemptionCjpyAmount;
        uint256 totalRedeemedEthAmount = totalRedeemedCjpyAmount * 1e18 / jpyPerEth;
        uint256 returningEthAmount = (totalRedeemedEthAmount * (100 - GRR)) /
            100;
        address _redemptionBearer;
        address _returningDestination;

        totalDebt -= totalRedeemedCjpyAmount;
        totalColl -= totalRedeemedEthAmount;
        TCR = helper.getTCR();

        if (isCoreRedemption) {
            /* 
            [ Core Redemption - Pool Subtotal ]
                (-) Redemption Reserve (CJPY)
                            v
                            v
                (+)  Fee Pool (ETH)
            */
            _redemptionBearer = address(pool);
            _returningDestination = __feePool;
            pool.useRedemptionReserve(totalRedeemedCjpyAmount);
        } else {
            /* 
            [ Normal Redemption - Account Subtotal ]
                (-) Bearer Balance (CJPY)
                            v
                            v
                (+) Bearer Balance (ETH)
            */
            _redemptionBearer = msg.sender;
            _returningDestination = msg.sender;
        }
        pool.sendETH(_returningDestination, returningEthAmount);
        ICjpyOS(__cjpyOS).burnCJPY(_redemptionBearer, totalRedeemedCjpyAmount);

        /*
            4. Gas compensation
        */
        uint256 gasCompensationInETH = totalRedeemedEthAmount * (GRR / 100);
        pool.sendETH(msg.sender, gasCompensationInETH);

        /*
            5. Event
        */
        emit Redeemed(
            msg.sender,
            totalRedeemedCjpyAmount,
            totalRedeemedEthAmount,
            _pledgesOwner
        );
        emit RedeemedMeta(
            msg.sender,
            jpyPerEth,
            isCoreRedemption,
            gasCompensationInETH
        );
    }

    /// @notice Initialize all pledges such that ICR is 0 (= (0*price)/debt )
    /// @dev Will be run by incentivised DAO member. Scan all pledges and filter debt>0, coll=0. Pay gas compensation from the 1% of SweepReserve at most, and as same as 1% of the actual sweeping amount.
    function sweep() public nonReentrant whenNotPaused {
        IPriceFeed(__feed).fetchPrice();
        uint256 sweepStart = pool.sweepReserve();
        require(sweepStart > 0, "Sweep failure: sweep reserve is empty.");
        uint256 maxGasCompensation = sweepStart * (GRR / 100);
        uint256 _reminder = sweepStart - maxGasCompensation; //Note: Secure gas compensation
        uint256 _maxSweeplableStart = _reminder;
        address[] memory _pledgesOwner = new address[](
            priorityRegistry.pledgeLength()
        );
        uint256 _loopCount = 0;

        /*
            1. Sweeping
        */
        while (_reminder > 0) {
            try priorityRegistry.popSweepable() returns (
                Pledge memory _sweepablePledge
            ) {
                if (!_sweepablePledge.isCreated) break; // Note: No any more redeemable pledges
                if (_sweepablePledge.owner == address(0x00)) break; // Note: No any more redeemable pledges

                Pledge storage sPledge = pledges[_sweepablePledge.owner];

                if (!sPledge.isCreated) break; // Note: registry-yamato mismatch
                if (sPledge.debt == 0) break; // Note: A once-swept pledge is called twice
                _pledgesOwner[_loopCount] = _sweepablePledge.owner; // Note: For event

                (Pledge memory _sweptPledge, uint256 _reminder, uint256 sweepingAmount) = helper.sweepDebt(sPledge, _reminder);
                sPledge.sync(_sweptPledge);
                totalDebt -= sweepingAmount;
                TCR = helper.getTCR();

                if (_reminder > 0) {
                    priorityRegistry.remove(sPledge.toMem());
                    sPledge.sync(helper.neutralizePledge(sPledge.toMem()));
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
        uint256 gasCompensationInCJPY = _sweptAmount * (GRR / 100);
        pool.sendCJPY(msg.sender, gasCompensationInCJPY); // Not sendETH. But redemption returns in ETH and so it's a bit weird.
        pool.useSweepReserve(gasCompensationInCJPY);

        /*
            3. Event
        */
        emit Swept(
            msg.sender,
            _sweptAmount,
            gasCompensationInCJPY,
            _pledgesOwner
        );
    }




    /*
    ==============================
        Internal Helpers
    ==============================
        - updateTCR
        - toggle
    */
    function updateTCR() external {
        TCR = helper.getTCR();
    }
    function toggle() public onlyGovernance {
        if( paused() ){
            _pause();
        } else {
            _unpause();
        }
    }




    /*
    ==============================
        State Getter Function
    ==============================
        - getPledge
        - getStates
        - getIndivisualStates
    */

    /// @notice To give pledge access to YmtOS
    /// @dev Interface can't return "struct memory" from public state variable
    function getPledge(address _owner)
        public
        view
        override
        returns (Pledge memory)
    {
        return pledges[_owner];
    }

    /// @notice Provide the data of public storage.
    function getStates()
        public
        view
        override 
        returns (
            uint256,
            uint256,
            uint8,
            uint8,
            uint8,
            uint8
        )
    {
        return (totalColl, totalDebt, MCR, RRR, SRR, GRR);
    }

    /// @notice Provide the data of indivisual pledge.
    function getIndivisualStates(address owner)
        public
        view
        returns (
            uint256 coll,
            uint256 debt,
            bool isCreated,
            uint256 withdrawLock,
            uint256 depositAndBorrowLock
        )
    {
        Pledge memory pledge = pledges[owner];
        withdrawLock = withdrawLocks[owner];
        depositAndBorrowLock = depositAndBorrowLocks[owner];
        return (
            pledge.coll,
            pledge.debt,
            pledge.isCreated,
            withdrawLock,
            depositAndBorrowLock
        );
    }

    function feed() public view override returns (address) {
        return __feed;
    }
    function feePool() public view override returns (address) {
        return __feePool;        
    }
    function cjpyOS() public view override returns (address) {
        return __cjpyOS;        
    }

}
