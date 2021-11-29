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
import "./YamatoDepositor.sol";
import "./YamatoBorrower.sol";
import "./YamatoRepayer.sol";
import "./YamatoWithdrawer.sol";
import "./YamatoRedeemer.sol";
import "./YamatoSweeper.sol";
import "./Dependencies/YamatoStore.sol";
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

/// @title Yamato Pledge Manager Contract
/// @author 0xMotoko
contract Yamato is
    IYamato,
    YamatoStore,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    using PledgeLib for IYamato.Pledge;
    using PledgeLib for uint256;

    string constant CURRENCY_OS_SLOT_ID = "deps.CurrencyOS";
    string constant YAMATO_DEPOSITER_SLOT_ID = "deps.YamatoDepositer";
    string constant YAMATO_BORROWER_SLOT_ID = "deps.YamatoBorrower";
    string constant YAMATO_REPAYER_SLOT_ID = "deps.YamatoRepayer";
    string constant YAMATO_WITHDRAWER_SLOT_ID = "deps.YamatoWithdrawer";
    string constant YAMATO_REDEEMER_SLOT_ID = "deps.YamatoRedeemer";
    string constant YAMATO_SWEEPER_SLOT_ID = "deps.YamatoSweeper";
    string constant POOL_SLOT_ID = "deps.Pool";
    string constant PRIORITY_REGISTRY_SLOT_ID = "deps.PriorityRegistry";

    mapping(address => Pledge) pledges;
    uint256 totalColl;
    uint256 totalDebt;

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

        bytes32 CURRENCY_OS_KEY = bytes32(keccak256(abi.encode(CURRENCY_OS_SLOT_ID)));
        assembly {
            sstore(CURRENCY_OS_KEY, _cjpyOS)
        }

        __ReentrancyGuard_init();
        __Pausable_init();
        __YamatoStore_init(address(this));
    }

    function setDeps(
        address _yamatoDepositor,
        address _yamatoBorrower,
        address _yamatoRepayer,
        address _yamatoWithdrawer,
        address _yamatoRedeemer,
        address _yamatoSweeper,
        address _pool,
        address _priorityRegistry,
    ) public onlyGovernance {
        /*
            [ Deployment Order ]
            CJPY.deploy()
            FeePool.deploy()
            PriceFeed.deploy()
            CjpyOS.deploy(CJPY,FeePool,PriceFeed)
            Yamato.deploy(CjpyOS)
            YamatoDepositor.deploy(Yamato)
            YamatoBorrower.deploy(Yamato)
            YamatoRepayer.deploy(Yamato)
            YamatoWithdrawer.deploy(Yamato)
            YamatoRedeemer.deploy(Yamato)
            YamatoSweeper.deploy(Yamato)
            Pool.deploy(Yamato)
            PriorityRegistry.deploy(Yamato)
            Yamato.setDeps(YamatoDepositor,YamatoBorrower,YamatoRepayer,YamatoWithdrawer,YamatoRedeemer,YamatoSweeper,Pool,PriorityRegistry)
        */
        bytes32 YAMATO_DEPOSITER_KEY = bytes32(keccak256(abi.encode(YAMATO_DEPOSITER_SLOT_ID)));
        bytes32 YAMATO_BORROWER_KEY = bytes32(keccak256(abi.encode(YAMATO_BORROWER_SLOT_ID)));
        bytes32 YAMATO_REPAYER_KEY = bytes32(keccak256(abi.encode(YAMATO_REPAYER_SLOT_ID)));
        bytes32 YAMATO_WITHDRAWER_KEY = bytes32(keccak256(abi.encode(YAMATO_WITHDRAWER_SLOT_ID)));
        bytes32 YAMATO_REDEEMER_KEY = bytes32(keccak256(abi.encode(YAMATO_REDEEMER_SLOT_ID)));
        bytes32 YAMATO_SWEEPER_KEY = bytes32(keccak256(abi.encode(YAMATO_SWEEPER_SLOT_ID)));
        bytes32 POOL_KEY = bytes32(keccak256(abi.encode(POOL_SLOT_ID)));
        bytes32 PRIORITY_REGISTRY_KEY = bytes32(keccak256(abi.encode(PRIORITY_REGISTRY_SLOT_ID)));
        assembly {
            sstore(YAMATO_DEPOSITER_KEY, _yamatoDepositor)
            sstore(YAMATO_BORROWER_KEY, _yamatoBorrower)
            sstore(YAMATO_REPAYER_KEY, _yamatoRepayer)
            sstore(YAMATO_WITHDRAWER_KEY, _yamatoWithdrawer)
            sstore(YAMATO_REDEEMER_KEY, _yamatoRedeemer)
            sstore(YAMATO_SWEEPER_KEY, _yamatoSweeper)
            sstore(POOL_KEY, _pool)
            sstore(PRIORITY_REGISTRY_KEY, _priorityRegistry)
        }
    }


    function setPledge(address _owner, Pledge memory _p)
        public
        override
        onlyYamato
    {
        Pledge storage p = pledges[_owner];
        p.coll = _p.coll;
        p.debt = _p.debt;
        p.owner = _p.owner;
        p.isCreated = _p.isCreated;
        p.priority = _p.coll;
    }

    function setTotalColl(uint256 _totalColl) public override onlyYamato {
        totalColl = _totalColl;
    }
    function setTotalDebt(uint256 _totalDebt) public override onlyYamato {
        totalDebt = _totalDebt;
    }
    function setDepositAndBorrowLocks(address _owner) public override onlyYamato {
        depositAndBorrowLocks[_owner] = block.number;
    }
    function setWithdrawLocks(address _owner) public override onlyYamato {
        withdrawLocks[_owner] = block.timestamp + 3 days;
    }

    modifier onlyYamato() {
        require(permitDeps(msg.sender), "Not deps");
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
        (bool success, ) = payable(depositor()).call{value: msg.value}(
            abi.encodeWithSignature("runDeposit(address)", msg.sender)
        );
        require(success, "runDeposit failed");
        emit Deposited(msg.sender, msg.value);
    }

    /// @notice Borrow in CJPY. In JPY term, 15.84%=RR, 0.16%=RRGas, 3.96%=SR, 0.4%=SRGas
    /// @dev This function can't be executed just the same block with your deposit
    /// @param borrowAmountInCjpy maximal redeemable amount
    function borrow(uint256 borrowAmountInCjpy) public whenNotPaused {
        uint fee = IYamatoBorrower(borrower()).runBorrow(msg.sender, borrowAmountInCjpy);
        emit Borrowed(msg.sender, borrowAmountInCjpy, fee);
    }

    /// @notice Recover the collateral of one's pledge.
    /// @dev Need allowance. TCR will go up.
    /// @param cjpyAmount maximal redeemable amount
    function repay(uint256 cjpyAmount) public {
        IYamatoRepayer(repayer()).runRepay(msg.sender, cjpyAmount);
        emit Repaid(msg.sender, cjpyAmount);
    }

    /// @notice Withdraw collaterals from one's pledge.
    /// @dev Nood reentrancy guard. TCR will go down.
    /// @param ethAmount withdrawal amount
    function withdraw(uint256 ethAmount) public nonReentrant {
        IYamatoWithdrawer(withdrawer()).runWithdraw(msg.sender, ethAmount);
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
        IYamatoRedeemer.RedeemedArgs memory _args = IYamatoRedeemer(redeemer()).runRedeem(
            IYamatoRedeemer.RunRedeemArgs(
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
        ) = IYamatoSweeper(sweeper()).runSweep(msg.sender);

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
        - toggle
    */

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

    // @dev Yamato.sol must override it with correct logic.
    function yamato() public view override returns (address) {
        return address(this);
    }
    function pool() public view returns (address _pool) {
        bytes32 POOL_KEY = bytes32(keccak256(abi.encode(POOL_SLOT_ID)));
        assembly {
           _pool := sload(POOL_KEY)
        }
    }
    function priorityRegistry() public view returns (address _priorityRegistry) {
        bytes32 PRIORITY_REGISTRY_KEY = bytes32(keccak256(abi.encode(PRIORITY_REGISTRY_SLOT_ID)));
        assembly {
           _priorityRegistry := sload(PRIORITY_REGISTRY_KEY)
        }
    }
    function depositor() public view returns (address _depositor) {
        bytes32 YAMATO_DEPOSITOR_KEY = bytes32(keccak256(abi.encode(YAMATO_DEPOSITOR_SLOT_ID)));
        assembly {
           _depositor := sload(YAMATO_DEPOSITOR_KEY)
        }
    }
    function borrower() public view returns (address _borrower) {
        bytes32 YAMATO_BORROWER_KEY = bytes32(keccak256(abi.encode(YAMATO_BORROWER_SLOT_ID)));
        assembly {
           _borrower := sload(YAMATO_BORROWER_KEY)
        }
    }
    function repayer() public view returns (address _depositor) {
        bytes32 YAMATO_REPAYER_KEY = bytes32(keccak256(abi.encode(YAMATO_REPAYER_SLOT_ID)));
        assembly {
           _depositor := sload(YAMATO_REPAYER_KEY)
        }
    }
    function withdrawer() public view returns (address _withdrawer) {
        bytes32 YAMATO_WITHDRAWER_KEY = bytes32(keccak256(abi.encode(YAMATO_WITHDRAWER_SLOT_ID)));
        assembly {
           _withdrawer := sload(YAMATO_WITHDRAWER_KEY)
        }
    }
    function redeemer() public view returns (address _redeemer) {
        bytes32 YAMATO_REDEEMER_KEY = bytes32(keccak256(abi.encode(YAMATO_REDEEMER_SLOT_ID)));
        assembly {
           _redeemer := sload(YAMATO_REDEEMER_KEY)
        }
    }
    function sweeper() public view returns (address _sweeper) {
        bytes32 YAMATO_SWEEPER_KEY = bytes32(keccak256(abi.encode(YAMATO_SWEEPER_SLOT_ID)));
        assembly {
           _sweeper := sload(YAMATO_SWEEPER_KEY)
        }
    }


    // @dev Yamato.sol must override it with correct logic.
    function cjpyOS() public view override returns (address _cjpyOS) {
        bytes32 CURRENCY_OS_KEY= bytes32(keccak256(abi.encode(CURRENCY_OS_SLOT_ID)));
        assembly {
           _cjpyOS := sload(CURRENCY_OS_KEY)
        }
    }
    // @dev Yamato.sol must override it with correct logic.
    function feePool() public view override returns (address) {
        return ICjpyOS(cjpyOS()).feePool();
    }
    // @dev Yamato.sol must override it with correct logic.
    function feed() public view override returns (address) {
        return ICjpyOS(cjpyOS()).feed();
    }
    // @dev All YamatoStores and YamatoActions except Yamato.sol are NOT needed to modify these funcs. Just write the same signature and don't fill inside. Yamato.sol must override it with correct logic.
    function permitDeps(address _sender) public view override returns (bool) {
        bool permit;
        address[9] memory deps = getDeps();
        for (uint256 i = 0; i < deps.length; i++) {
            if (_sender == deps[i]) permit = true;
        }
        return permit;
    }
    function getDeps() public view returns (address[9] memory) {
        return [
            address(this),
            depositor(),
            borrower(),
            repayer(),
            withdrawer(),
            redeemer(),
            sweeper(),
            pool(),
            priorityRegistry()
        ];
    }
}
