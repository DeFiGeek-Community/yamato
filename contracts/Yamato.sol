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
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./CjpyOS.sol";
import "./PriceFeed.sol";
import "./Dependencies/PledgeLib.sol";
import "./Dependencies/SafeMath.sol";
import "./Interfaces/IYamato.sol";
import "./Interfaces/IFeePool.sol";
import "hardhat/console.sol";

/// @title Yamato Pledge Manager Contract
/// @author 0xMotoko
contract Yamato is IYamato, ReentrancyGuard {
    using SafeMath for uint256;
    using PledgeLib for IYamato.Pledge;

    IPool pool;
    bool poolInitialized = false;
    IPriorityRegistry priorityRegistry;
    bool priorityRegistryInitialized = false;
    ICjpyOS cjpyOS;
    IFeePool feePool;
    address public override feed;
    address governance;
    address tester;

    mapping(address => Pledge) pledges;
    uint256 totalColl;
    uint256 totalDebt;
    uint256 public TCR;

    mapping(address => uint256) withdrawLocks;
    mapping(address => uint256) depositAndBorrowLocks;

    uint8 public override MCR = 110; // MinimumCollateralizationRatio in pertenk
    uint8 public RRR = 80; // RedemptionReserveRate in pertenk
    uint8 public SRR = 20; // SweepReserveRate in pertenk
    uint8 public GRR = 1; // GasReserveRate in pertenk

    event Borrowed(uint256 ICRAfter);

    /*
        ==============================
            Set-up functions
        ==============================
        - setPool
        - setPriorityRegistry
        - revokeGovernance
        - revokeTester
    */
    constructor(address _cjpyOS) {
        cjpyOS = ICjpyOS(_cjpyOS);
        governance = msg.sender;
        tester = msg.sender;
        feePool = IFeePool(cjpyOS.feePoolProxy());
        feed = cjpyOS.feed();
    }

    function setPool(address _pool) public onlyGovernance onlyOnceForSetPool {
        pool = IPool(_pool);
    }

    function setPriorityRegistry(address _priorityRegistry)
        public
        onlyGovernance
        onlyOnceForSetPriorityRegistry
    {
        priorityRegistry = IPriorityRegistry(_priorityRegistry);
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

    function revokeTester() public onlyGovernance {
        tester = address(0);
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
    function deposit() public payable nonReentrant {
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
    }

    /// @notice Borrow in CJPY. In JPY term, 15.84%=RR, 0.16%=RRGas, 3.96%=SR, 0.4%=SRGas
    /// @dev This function can't be executed just the same block with your deposit
    /// @param borrowAmountInCjpy maximal redeemable amount
    function borrow(uint256 borrowAmountInCjpy) public {
        /*
            1. Ready
        */
        Pledge storage pledge = pledges[msg.sender];
        uint256 _ICRAfter = pledge.toMem().addDebt(borrowAmountInCjpy).getICR(
            feed
        );
        uint256 fee = (borrowAmountInCjpy * FR(_ICRAfter)) / 10000;
        uint256 returnableCJPY = borrowAmountInCjpy.sub(fee);

        /*
            2. Validate
        */
        require(
            depositAndBorrowLocks[msg.sender] < block.number,
            "Borrowing should not be executed within the same block with your deposit."
        );
        require(pledge.isCreated, "This pledge is not created yet.");
        require(
            _ICRAfter >= uint256(MCR).mul(100),
            "This minting is invalid because of too large borrowing."
        );
        require(fee > 0, "fee must be more than zero.");
        require(returnableCJPY > 0, "(borrow - fee) must be more than zero.");

        /*
            3. Top-up scenario
        */
        pledge.debt += borrowAmountInCjpy;
        totalDebt += borrowAmountInCjpy;
        TCR = getTCR();

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
        cjpyOS.mintCJPY(msg.sender, returnableCJPY); // onlyYamato
        cjpyOS.mintCJPY(address(pool), fee); // onlyYamato

        if (pool.redemptionReserve() / 5 <= pool.sweepReserve()) {
            pool.depositRedemptionReserve(fee);
        } else {
            pool.depositSweepReserve(fee);
        }

        /*
            7. Event
        */
        emit Borrowed(_ICRAfter);
    }

    /// @notice Recover the collateral of one's pledge.
    /// @dev Need allowance. TCR will go up.
    /// @param cjpyAmount maximal redeemable amount
    function repay(uint256 cjpyAmount) public {
        /*
            1. Get feed and Pledge
        */
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
        TCR = getTCR();

        /*
            3. Update PriorityRegistry
        */
        pledge.priority = priorityRegistry.upsert(pledge);

        /*
            4-1. Charge CJPY
            4-2. Return coll to the redeemer
        */
        cjpyOS.burnCJPY(msg.sender, cjpyAmount);
    }

    /// @notice Withdraw collaterals from one's pledge.
    /// @dev Nood reentrancy guard. TCR will go down.
    /// @param ethAmount withdrawal amount
    function withdraw(uint256 ethAmount) public nonReentrant {
        /*
            1. Get feed and pledge
        */
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
            pledge.toMem().getICR(feed) >= uint256(MCR).mul(100),
            "Withdrawal failure: ICR is not more than MCR."
        );

        /*
            3. Update pledge
        */

        // Note: SafeMath unintentionally checks full withdrawal
        pledge.coll = pledge.coll - ethAmount;
        totalColl = totalColl - ethAmount;

        TCR = getTCR();

        /*
            4. Validate and update PriorityRegistry
        */
        if (pledge.coll == 0 && pledge.debt == 0) {
            /*
                4-a. Clean full withdrawal
            */
            priorityRegistry.remove(pledge);
            _neutralizePledge(pledge);
        } else {
            /*
                4-b. Reasonable partial withdrawal
            */
            require(
                pledge.toMem().getICR(feed) >= uint256(MCR).mul(100),
                "Withdrawal failure: ICR can't be less than MCR after withdrawal."
            );
            pledge.priority = priorityRegistry.upsert(pledge);
        }

        /*
            5-1. Charge CJPY
            5-2. Return coll to the withdrawer
        */
        pool.sendETH(msg.sender, ethAmount);
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
    {
        uint256 redeemStart = pool.redemptionReserve();
        uint256 jpyPerEth = IPriceFeed(feed).fetchPrice();
        uint256 cjpyAmountStart = maxRedemptionCjpyAmount;

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
                uint256 _collBefore = sPledge.coll;
                maxRedemptionCjpyAmount = _expenseColl(
                    sPledge,
                    maxRedemptionCjpyAmount,
                    jpyPerEth
                );
                require(
                    sPledge.coll < _collBefore,
                    "Expense error: This redemption failed to reduce coll."
                );

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
            } catch {
                break;
            } /* Over-redemption Flow */
        }

        require(
            cjpyAmountStart > maxRedemptionCjpyAmount,
            "No pledges are redeemed."
        );
        // Note: This line can be the redemption execution checker

        /*
            3. Ditribute colls.
        */
        uint256 totalRedeemedCjpyAmount = cjpyAmountStart -
            maxRedemptionCjpyAmount;
        uint256 totalRedeemedEthAmount = totalRedeemedCjpyAmount.mul(1e18).div(
            jpyPerEth
        );
        uint256 dividendEthAmount = (totalRedeemedEthAmount * (100 - GRR)) /
            100;
        address _redemptionBearer;
        address _dividendDestination;

        if (isCoreRedemption) {
            /* 
            [ Core Redemption - Pool Subtotal ]
                (-) Redemption Reserve (CJPY)
                            v
                            v
                (+)  Dividend Reserve (ETH)
            */
            _redemptionBearer = address(pool);
            _dividendDestination = address(feePool);
            pool.useRedemptionReserve(totalRedeemedCjpyAmount);
            pool.accumulateDividendReserve(dividendEthAmount);
        } else {
            _redemptionBearer = msg.sender;
            _dividendDestination = msg.sender;
        }
        pool.sendETH(_dividendDestination, dividendEthAmount);
        cjpyOS.burnCJPY(_redemptionBearer, totalRedeemedCjpyAmount);

        /*
            4. Gas compensation
        */
        uint256 gasCompensation = totalRedeemedEthAmount * (uint256(GRR) / 100);
        (bool success, ) = payable(msg.sender).call{value: gasCompensation}("");
        require(success, "Gas payback has been failed.");
    }

    /// @notice Initialize all pledges such that ICR is 0 (= (0*price)/debt )
    /// @dev Will be run by incentivised DAO member. Scan all pledges and filter debt>0, coll=0. Pay gas compensation from the 1% of SweepReserve at most, and as same as 1% of the actual sweeping amount.
    function sweep() public nonReentrant {
        uint256 sweepStart = pool.sweepReserve();
        require(sweepStart > 0, "Sweep failure: sweep reserve is empty.");
        uint256 maxGasCompensation = sweepStart * (GRR / 100);
        uint256 maxSweeplable = sweepStart - maxGasCompensation; //Note: Secure gas compensation
        uint256 _maxSweeplableStart = maxSweeplable;

        /*
            1. Sweeping
        */
        while (maxSweeplable > 0) {
            try priorityRegistry.popSweepable() returns (
                Pledge memory _sweepablePledge
            ) {
                if (!_sweepablePledge.isCreated) break; // Note: No any more redeemable pledges
                if (_sweepablePledge.owner == address(0x00)) break; // Note: No any more redeemable pledges

                Pledge storage sPledge = pledges[_sweepablePledge.owner];

                if (!sPledge.isCreated) break; // Note: registry-yamato mismatch
                if (sPledge.debt == 0) break; // Note: A once-swept pledge is called twice

                maxSweeplable = _sweepDebt(sPledge, maxSweeplable);
                if (maxSweeplable > 0) {
                    priorityRegistry.remove(sPledge.toMem());
                    _neutralizePledge(sPledge);
                }
            } catch {
                break;
            } /* Oversweeping Flow */
        }
        require(
            _maxSweeplableStart > maxSweeplable,
            "At least a pledge should be swept."
        );

        /*
            2. Gas compensation
        */
        uint256 sweepEnd = pool.sweepReserve();
        uint256 sweepDiff = sweepStart - sweepEnd;
        uint256 gasCompensation = sweepDiff * (GRR / 100);
        (bool success, ) = payable(msg.sender).call{value: gasCompensation}("");
        require(success, "Gas payback has been failed.");
        pool.useSweepReserve(gasCompensation);
    }

    /*
    ==============================
        Helpers
    ==============================
        - _neutralizePledge
        - getTCR
        - FR
    */

    /// @notice Use when removing a pledge
    function _neutralizePledge(Pledge storage _pledge) internal {
        _pledge.priority = 0;
        _pledge.isCreated = false;
        _pledge.owner = address(0);
    }

    /// @notice Use when redemption
    function _expenseColl(
        Pledge storage sPledge,
        uint256 cjpyAmount,
        uint256 jpyPerEth
    ) internal returns (uint256) {
        require(sPledge.coll > 0, "Can't expense zero pledge.");
        uint256 collValuation = sPledge.coll.mul(jpyPerEth).div(1e18);

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
            ethToBeExpensed = redemptionAmount.mul(1e18).div(jpyPerEth);
            reminder = 0;
        }

        /*
            3. Update macro state
        */
        sPledge.coll -= ethToBeExpensed; // Note: storage variable in the internal func doesn't change state!
        totalDebt -= redemptionAmount;
        totalColl -= ethToBeExpensed;
        TCR = getTCR();

        return reminder;
    }

    /// @notice Use when sweeping
    function _sweepDebt(Pledge storage sPledge, uint256 maxSweeplable)
        internal
        returns (uint256)
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
        totalDebt -= sweepingAmount;
        TCR = getTCR();

        /*
            3. Budget reduction
        */
        pool.useSweepReserve(sweepingAmount);
        cjpyOS.burnCJPY(address(pool), sweepingAmount);

        return reminder;
    }

    /// @notice Calculate TCR
    /// @dev (totalColl*jpyPerEth)/totalDebt
    /// @return _TCR in uint256
    function getTCR() public returns (uint256 _TCR) {
        Pledge memory _pseudoPledge = Pledge(
            totalColl,
            totalDebt,
            true,
            msg.sender,
            0
        );
        if (totalColl == 0 && totalColl == 0) {
            _TCR = 0;
        } else {
            _TCR = _pseudoPledge.getICR(feed);
        }
    }

    /// @param _ICRpertenk IndividualCollateralRatio per 10k
    /// @dev Three linear fumula there are
    /// @return _FRpertenk Corresponding fee rate in uint256 per-ten-kilo unit
    function FR(uint256 _ICRpertenk) public view returns (uint256 _FRpertenk) {
        require(_ICRpertenk >= 11000, "ICR too low to get fee data.");
        if (11000 <= _ICRpertenk && _ICRpertenk < 13000) {
            _FRpertenk = 2000 - ((_ICRpertenk - 11000) * 80) / 100;
        } else if (13000 <= _ICRpertenk && _ICRpertenk < 15000) {
            _FRpertenk = 400 - ((_ICRpertenk - 13000) * 10) / 100;
        } else if (15000 <= _ICRpertenk && _ICRpertenk < 20000) {
            _FRpertenk = 200 - ((_ICRpertenk - 15000) * 2) / 100;
        } else if (20000 <= _ICRpertenk && _ICRpertenk < 50000) {
            _FRpertenk = 100 - ((_ICRpertenk - 20000) * 3) / 10 / 100;
        } else {
            _FRpertenk = 10;
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

    /*
    ==============================
        Testability Helpers
    ==============================
        - bypassUpsert()
        - bypassRemove()
        - updateTCR()
        - setPriorityRegistryInTest()
        - getICR()
    */
    function bypassUpsert(Pledge calldata _pledge) external onlyTester {
        priorityRegistry.upsert(_pledge);
    }

    function bypassRemove(Pledge calldata _pledge) external onlyTester {
        priorityRegistry.remove(_pledge);
    }

    function bypassPopRedeemable() external onlyTester {
        priorityRegistry.popRedeemable();
    }

    function bypassPopSweepable() external onlyTester {
        priorityRegistry.popSweepable();
    }

    function updateTCR() external onlyTester {
        TCR = getTCR();
    }

    function setPriorityRegistryInTest(address _priorityRegistry)
        external
        onlyTester
    {
        priorityRegistry = IPriorityRegistry(_priorityRegistry);
    }

    function getICR(uint256 _coll, uint256 _debt) external returns (uint256) {
        return Pledge(_coll, _debt, true, msg.sender, 0).getICR(feed);
    }
}
