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

    mapping(address => uint256) public override withdrawLocks;
    mapping(address => uint256) public override depositAndBorrowLocks;

    uint8 public override MCR; // MinimumCollateralizationRatio in pertenk
    uint8 public RRR; // RedemptionReserveRate in pertenk
    uint8 public SRR; // SweepReserveRate in pertenk
    uint8 public override GRR; // GasReserveRate in pertenk

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
        /*
            [ Deployment Order ]
            CjpyOS.deploy()
            Yamato.deploy(CjpyOS)
            YamatoHelper.deploy(Yamato)
            Pool.deploy(YamatoHelper)
            PriorityRegistry.deploy(YamatoHelper)
            YamatoHelper.setPool(Pool)
            YamatoHelper.setPriorityRegistry(PriorityRegistry)
            Yamato.setYamatoHelper(YamatoHelper)
        */
        helper = IYamatoHelper(_yamatoHelper);
        pool = IPool(helper.pool());
        priorityRegistry = IPriorityRegistry(helper.priorityRegistry());
    }

    function setPledge(Pledge memory _p) public override onlyYamato {
        Pledge storage p = pledges[_p.owner];
        p.coll = _p.coll;
        p.debt = _p.debt;
        p.owner = _p.owner;
        p.isCreated = _p.isCreated;
        p.priority = _p.coll;
    }

    function setTotalColl(uint256 _totalColl) public override onlyYamato {
        totalColl = _totalColl;
        TCR = helper.getTCR();
    }

    function setTotalDebt(uint256 _totalDebt) public override onlyYamato {
        totalDebt = _totalDebt;
        TCR = helper.getTCR();
    }

    modifier onlyYamato() {
        require(helper.permitDeps(msg.sender), "Not deps");
        _;
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
        helper.runWithdraw(msg.sender, ethAmount);
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
        IYamatoHelper.RedeemedArgs memory _args = helper.runRedeem(
            IYamatoHelper.RunRedeemeArgs(
                msg.sender,
                maxRedemptionCjpyAmount,
                isCoreRedemption
            )
        );

        emit Redeemed(
            msg.sender,
            _args.totalRedeemedCjpyAmount,
            _args.totalRedeemedEthAmount,
            _args._pledgesOwner
        );
        emit RedeemedMeta(
            msg.sender,
            _args.jpyPerEth,
            isCoreRedemption,
            _args.gasCompensationInETH
        );
    }

    /// @notice Initialize all pledges such that ICR is 0 (= (0*price)/debt )
    /// @dev Will be run by incentivised DAO member. Scan all pledges and filter debt>0, coll=0. Pay gas compensation from the 1% of SweepReserve at most, and as same as 1% of the actual sweeping amount.
    function sweep() public nonReentrant whenNotPaused {
        (
            uint256 _sweptAmount,
            uint256 gasCompensationInCJPY,
            address[] memory _pledgesOwner
        ) = helper.runSweep(msg.sender);

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
        if (paused()) {
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

    function cjpyOS() public view override returns (address) {
        return __cjpyOS;
    }
}
