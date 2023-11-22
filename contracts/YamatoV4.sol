pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2023 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "./Pool.sol";
import "./YMT.sol";
import "./Interfaces/IYamatoDepositor.sol";
import "./Interfaces/IYamatoBorrower.sol";
import "./Interfaces/IYamatoRepayer.sol";
import "./Interfaces/IYamatoWithdrawer.sol";
import "./Interfaces/IYamatoRedeemer.sol";
import "./Interfaces/IYamatoSweeper.sol";
import "./Dependencies/YamatoStore.sol";
import "./Dependencies/YamatoBase.sol";
import "./Dependencies/PledgeLib.sol";
import "./Dependencies/SafeMath.sol";
import "./Interfaces/IYamato.sol";
import "./Interfaces/IYamatoV4.sol";
import "./Interfaces/IFeePool.sol";
import "./Interfaces/ICurrencyOS.sol";
import "hardhat/console.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

/// @title Yamato Pledge Manager Contract
contract YamatoV4 is
    IYamato,
    IYamatoV4,
    YamatoStore,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    /*
        ===========================
        Lib for struct Pledge
        ===========================
    */
    using PledgeLib for IYamato.Pledge;
    using PledgeLib for uint256;

    /*
        ===========================
        ~~~ SAFE HAVEN ~~~
        ===========================
        - Constants don't take slots
        - You can add or remove them in upgrade timing
        - Read more => https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable#avoid-initial-values-in-field-declarations
    */

    uint8 public constant override MCR = 130; // MinimumCollateralizationRatio in pertenk
    uint8 public constant RRR = 80; // RedemptionReserveRate in pertenk
    uint8 public constant SRR = 20; // SweepReserveRate in pertenk
    uint8 public constant override GRR = 1; // GasReserveRate in pertenk
    // TODO: Comment-in here later
    uint256 public constant override(IYamatoV4) collFloor = 1e17; // 0.1 ETH is the floor
    uint256 public constant override(IYamatoV4) maxRedeemableCount = 50; // 5ETH is the max redeemable amount per a tx.
    uint256 public constant override(IYamatoV4) CHECKPOINT_BUFFER = 55;

    // Use hash-slot pointer. You will be less anxious to modularise contracts later.
    string constant CURRENCY_OS_SLOT_ID = "deps.CurrencyOS";
    string constant YAMATO_DEPOSITOR_SLOT_ID = "deps.YamatoDepositor";
    string constant YAMATO_BORROWER_SLOT_ID = "deps.YamatoBorrower";
    string constant YAMATO_REPAYER_SLOT_ID = "deps.YamatoRepayer";
    string constant YAMATO_WITHDRAWER_SLOT_ID = "deps.YamatoWithdrawer";
    string constant YAMATO_REDEEMER_SLOT_ID = "deps.YamatoRedeemer";
    string constant YAMATO_SWEEPER_SLOT_ID = "deps.YamatoSweeper";
    string constant POOL_SLOT_ID = "deps.Pool";
    string constant PRIORITY_REGISTRY_SLOT_ID = "deps.PriorityRegistry";
    string constant SCORE_REGISTRY_SLOT_ID = "deps.ScoreRegistry";

    /*
        ===========================
        ~~~ SAFE HAVEN ENDED ~~~
        ===========================
    */

    /*
        ===========================
        !!! DANGER ZONE BEGINS !!!
        ===========================
        - Proxy patterns (UUPS) stores state onto ERC1967Proxy via `delegatecall` opcode.
        - So modifying storage slot order in the next version of implementation would cause storage layout confliction.
        - You can check whether your change will conflict or not by using `@openzeppelin/upgrades`
        - Read more => https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable#modifying-your-contracts
    */
    uint256 totalColl;
    uint256 totalDebt;

    mapping(address => Pledge) pledges;
    mapping(address => FlashLockData) flashlocks; // sender => <uint6 000000> + <uint250 blockHeight> ... dep,bor,rep,wit,red,swe

    /*
        ===========================
        !!! DANGER ZONE ENDED !!!
        ===========================
    */

    /*
        ==============================
            Modifier
        ==============================
        - onlyYamato
    */
    modifier onlyYamato() override {
        require(permitDeps(msg.sender), "You are not Yamato contract.");
        _;
    }

    /*
        ==============================
            Set-up functions
        ==============================
        - initialize
        - setDeps
        - setScreRegistory
    */
    function initialize(address _currencyOS) public initializer {
        bytes32 CURRENCY_OS_KEY = bytes32(
            keccak256(abi.encode(CURRENCY_OS_SLOT_ID))
        );
        assembly {
            sstore(CURRENCY_OS_KEY, _currencyOS)
        }

        __ReentrancyGuard_init();
        __Pausable_init();
        __YamatoStore_init(address(this));
    }

    /// @dev UUPS enforces you to modularise your contract into many because UUPS takes ~15KB/24.576KB of contract size limitation.
    function setDeps(
        address _yamatoDepositor,
        address _yamatoBorrower,
        address _yamatoRepayer,
        address _yamatoWithdrawer,
        address _yamatoRedeemer,
        address _yamatoSweeper,
        address _pool,
        address _priorityRegistry
    ) external onlyGovernance {
        /*
            [ Deployment Order ]
            Currency.deploy()
            FeePool.deploy()
            PriceFeed.deploy()
            CurrencyOS.deploy(Currency,FeePool,PriceFeed)
            Yamato.deploy(CurrencyOS)
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
        bytes32 YAMATO_DEPOSITOR_KEY = bytes32(
            keccak256(abi.encode(YAMATO_DEPOSITOR_SLOT_ID))
        );
        bytes32 YAMATO_BORROWER_KEY = bytes32(
            keccak256(abi.encode(YAMATO_BORROWER_SLOT_ID))
        );
        bytes32 YAMATO_REPAYER_KEY = bytes32(
            keccak256(abi.encode(YAMATO_REPAYER_SLOT_ID))
        );
        bytes32 YAMATO_WITHDRAWER_KEY = bytes32(
            keccak256(abi.encode(YAMATO_WITHDRAWER_SLOT_ID))
        );
        bytes32 YAMATO_REDEEMER_KEY = bytes32(
            keccak256(abi.encode(YAMATO_REDEEMER_SLOT_ID))
        );
        bytes32 YAMATO_SWEEPER_KEY = bytes32(
            keccak256(abi.encode(YAMATO_SWEEPER_SLOT_ID))
        );
        bytes32 POOL_KEY = bytes32(keccak256(abi.encode(POOL_SLOT_ID)));
        bytes32 PRIORITY_REGISTRY_KEY = bytes32(
            keccak256(abi.encode(PRIORITY_REGISTRY_SLOT_ID))
        );
        assembly {
            sstore(YAMATO_DEPOSITOR_KEY, _yamatoDepositor)
            sstore(YAMATO_BORROWER_KEY, _yamatoBorrower)
            sstore(YAMATO_REPAYER_KEY, _yamatoRepayer)
            sstore(YAMATO_WITHDRAWER_KEY, _yamatoWithdrawer)
            sstore(YAMATO_REDEEMER_KEY, _yamatoRedeemer)
            sstore(YAMATO_SWEEPER_KEY, _yamatoSweeper)
            sstore(POOL_KEY, _pool)
            sstore(PRIORITY_REGISTRY_KEY, _priorityRegistry)
        }
    }

    function setScoreRegistry(address _scoreRegistry) external onlyGovernance {
        bytes32 SCORE_REGISTRY_KEY = bytes32(
            keccak256(abi.encode(SCORE_REGISTRY_SLOT_ID))
        );
        assembly {
            sstore(SCORE_REGISTRY_KEY, _scoreRegistry)
        }
    }

    /*
        ==============================
            Storing functions
        ==============================
        - setPledge
        - setTotalColl
        - setTotalDebt
        - setDepositAndBorrowLocks
        - setWithdrawLocks
    */
    /// @dev Only-yamato-package state mutation func
    function setPledge(
        address _owner,
        Pledge memory _p
    ) public override onlyYamato {
        Pledge storage p = pledges[_owner];
        if (_p.debt == 0 && _p.coll == 0) {
            _p.owner = address(0);
            _p.isCreated = false;
            _p.priority = 0;
        }
        if (p.coll != _p.coll) {
            p.coll = _p.coll;
        }
        if (p.debt != _p.debt) {
            p.debt = _p.debt;
        }
        if (p.owner != _p.owner) {
            p.owner = _p.owner;
        }
        if (p.isCreated != _p.isCreated) {
            p.isCreated = _p.isCreated;
        }
        if (p.priority != _p.priority) {
            p.priority = _p.priority;
        }
    }

    /// @dev Only-yamato-package state mutation func
    function setPledges(
        Pledge[] memory _pledges
    ) public override(IYamatoV4) onlyYamato {
        for (uint256 i; i < _pledges.length; i++) {
            Pledge memory _p = _pledges[i];
            if (_p.isCreated == false) {
                continue;
            }
            setPledge(_p.owner, _p);
        }
    }

    /// @dev Only-yamato-package state mutation func
    /// @dev totalColl is theoretically as same as all pledges.coll - but it can be differ from Pool.balance due to selfdestruct(address)
    function setTotalColl(uint256 _totalColl) public override onlyYamato {
        totalColl = _totalColl;
    }

    /// @dev Only-yamato-package state mutation func
    /// @dev totalDebt is theoretically as same as Currency.totalSupply()
    function setTotalDebt(uint256 _totalDebt) public override onlyYamato {
        totalDebt = _totalDebt;
    }

    /// @dev Only-yamato-package state mutation func
    /// @dev deposit-borrow-withdraw should not be in the same block to avoid flashloan attack.
    function checkFlashLock(
        address _owner
    ) public view override onlyYamato returns (bool _isLocked) {
        FlashLockData storage lock = flashlocks[_owner];
        if (lock.lockedBlockHeight == block.number) {
            return _isLocked = true;
        }
    }

    /// @dev Only-yamato-package state mutation func
    function setFlashLock(address _owner) public override onlyYamato {
        FlashLockData storage lock = flashlocks[_owner];
        require(
            lock.lockedBlockHeight <= block.number,
            "FlashLock.lockedBlockHeight can't be more than currenct blockheight."
        );

        lock.lockedBlockHeight = block.number;
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
        IYamatoDepositor(depositor()).runDeposit{value: msg.value}(msg.sender);
        emit Deposited(msg.sender, msg.value);
    }

    /// @notice Borrow in Currency. In that currency-unit (e.g., CJPY), 15.84%=RR, 0.16%=RRGas, 3.96%=SR, 0.4%=SRGas
    /// @dev This function can't be executed just the same block with your deposit
    /// @param borrowAmountInCurrency maximal redeemable amount
    function borrow(uint256 borrowAmountInCurrency) public whenNotPaused {
        uint256 fee = IYamatoBorrower(borrower()).runBorrow(
            msg.sender,
            borrowAmountInCurrency
        );
        emit Borrowed(msg.sender, borrowAmountInCurrency, fee);
    }

    /// @notice Recover the collateral of one's pledge.
    /// @dev Need allowance. TCR will go up.
    /// @param currencyAmount maximal redeemable amount
    function repay(uint256 currencyAmount) public {
        IYamatoRepayer(repayer()).runRepay(msg.sender, currencyAmount);
        emit Repaid(msg.sender, currencyAmount);
    }

    /// @notice Withdraw collaterals from one's pledge.
    /// @dev Need reentrancy guard. TCR will go down.
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

    /// @notice Retrieve ETH collaterals from Pledges by burning Currency
    /// @dev Need allowance. Lowest ICR Pledges get redeemed first. TCR will go up. coll=0 pledges are to be remained.
    /// @param maxRedemptionCurrencyAmount maximal redeemable amount
    /// @param isCoreRedemption A flag for who to pay
    function redeem(
        uint256 maxRedemptionCurrencyAmount,
        bool isCoreRedemption
    ) public nonReentrant whenNotPaused {
        IYamatoRedeemer.RedeemedArgs memory _args = IYamatoRedeemer(redeemer())
            .runRedeem(
                IYamatoRedeemer.RunRedeemArgs(
                    msg.sender,
                    maxRedemptionCurrencyAmount,
                    isCoreRedemption
                )
            );

        emit Redeemed(
            msg.sender,
            _args.totalRedeemedCurrencyAmount,
            _args.totalRedeemedEthAmount,
            _args._pledgesOwner
        );
        emit RedeemedMeta(
            msg.sender,
            _args.ethPriceInCurrency,
            isCoreRedemption,
            _args.gasCompensationInETH
        );
    }

    /// @notice Initialize all pledges such that ICR is 0 (= (0*price)/debt )
    /// @dev Will be run by incentivised DAO member. Scan all pledges and filter debt>0, coll=0. Pay gas compensation from the 1% of SweepReserve at most, and as same as 1% of the actual sweeping amount.
    function sweep() public nonReentrant whenNotPaused {
        (
            uint256 _sweptAmount,
            uint256 gasCompensationInCurrency,
            address[] memory _pledgesOwner
        ) = IYamatoSweeper(sweeper()).runSweep(msg.sender);

        emit Swept(
            msg.sender,
            _sweptAmount,
            gasCompensationInCurrency,
            _pledgesOwner
        );
    }

    /*
    ==============================
        Internal Helpers
    ==============================
        - toggle
    */

    /// @dev Pausable
    function toggle() external onlyGovernance {
        if (paused()) {
            _unpause();
        } else {
            _pause();
        }
    }

    /*
    ==============================
        State Getter Function
    ==============================
        - getPledge
        - getStates
        - getIndividualStates
    */

    /// @notice To give pledge access to YmtOS
    /// @dev Interface can't return "struct memory" from public state variable
    function getPledge(
        address _owner
    ) public view override returns (Pledge memory) {
        return pledges[_owner];
    }

    /// @notice Provide the data of public storage.
    function getStates()
        public
        view
        override
        returns (uint256, uint256, uint8, uint8, uint8, uint8)
    {
        return (totalColl, totalDebt, MCR, RRR, SRR, GRR);
    }

    /// @notice Provide the data of individual pledge.
    function getIndividualStates(
        address owner
    )
        public
        view
        returns (
            uint256 coll,
            uint256 debt,
            bool isCreated,
            FlashLockData memory lock
        )
    {
        Pledge memory pledge = pledges[owner];
        return (pledge.coll, pledge.debt, pledge.isCreated, flashlocks[owner]);
    }

    function getTotalDebt() public view override returns (uint256) {
        return totalDebt;
    }

    // @dev Yamato.sol must override it with correct logic.
    function yamato() public view override returns (address) {
        return address(this);
    }

    /// @dev Get pool UUPS proxy address from slot
    function pool() public view override returns (address _pool) {
        bytes32 POOL_KEY = bytes32(keccak256(abi.encode(POOL_SLOT_ID)));
        assembly {
            _pool := sload(POOL_KEY)
        }
    }

    /// @dev Get priorityRegistry UUPS proxy address from slot
    function priorityRegistry()
        public
        view
        override
        returns (address _priorityRegistry)
    {
        bytes32 PRIORITY_REGISTRY_KEY = bytes32(
            keccak256(abi.encode(PRIORITY_REGISTRY_SLOT_ID))
        );
        assembly {
            _priorityRegistry := sload(PRIORITY_REGISTRY_KEY)
        }
    }

    /// @dev Get scoreRegistry UUPS proxy address from slot
    function scoreRegistry()
        public
        view
        override
        returns (address _scoreRegistry)
    {
        bytes32 SCORE_REGISTRY_KEY = bytes32(
            keccak256(abi.encode(SCORE_REGISTRY_SLOT_ID))
        );
        assembly {
            _scoreRegistry := sload(SCORE_REGISTRY_KEY)
        }
    }

    /// @dev Get depositor UUPS proxy address from slot
    function depositor() public view override returns (address _depositor) {
        bytes32 YAMATO_DEPOSITOR_KEY = bytes32(
            keccak256(abi.encode(YAMATO_DEPOSITOR_SLOT_ID))
        );
        assembly {
            _depositor := sload(YAMATO_DEPOSITOR_KEY)
        }
    }

    /// @dev Get borrower UUPS proxy address from slot
    function borrower() public view override returns (address _borrower) {
        bytes32 YAMATO_BORROWER_KEY = bytes32(
            keccak256(abi.encode(YAMATO_BORROWER_SLOT_ID))
        );
        assembly {
            _borrower := sload(YAMATO_BORROWER_KEY)
        }
    }

    /// @dev Get repayer UUPS proxy address from slot
    function repayer() public view override returns (address _repayer) {
        bytes32 YAMATO_REPAYER_KEY = bytes32(
            keccak256(abi.encode(YAMATO_REPAYER_SLOT_ID))
        );
        assembly {
            _repayer := sload(YAMATO_REPAYER_KEY)
        }
    }

    /// @dev Get withdrawer UUPS proxy address from slot
    function withdrawer() public view override returns (address _withdrawer) {
        bytes32 YAMATO_WITHDRAWER_KEY = bytes32(
            keccak256(abi.encode(YAMATO_WITHDRAWER_SLOT_ID))
        );
        assembly {
            _withdrawer := sload(YAMATO_WITHDRAWER_KEY)
        }
    }

    /// @dev Get redeemer UUPS proxy address from slot
    function redeemer() public view override returns (address _redeemer) {
        bytes32 YAMATO_REDEEMER_KEY = bytes32(
            keccak256(abi.encode(YAMATO_REDEEMER_SLOT_ID))
        );
        assembly {
            _redeemer := sload(YAMATO_REDEEMER_KEY)
        }
    }

    /// @dev Get sweeper UUPS proxy address from slot
    function sweeper() public view override returns (address _sweeper) {
        bytes32 YAMATO_SWEEPER_KEY = bytes32(
            keccak256(abi.encode(YAMATO_SWEEPER_SLOT_ID))
        );
        assembly {
            _sweeper := sload(YAMATO_SWEEPER_KEY)
        }
    }

    /// @dev Yamato.sol must override it with correct logic.
    function currencyOS()
        public
        view
        override(IYamato, YamatoBase)
        returns (address _currencyOS)
    {
        bytes32 CURRENCY_OS_KEY = bytes32(
            keccak256(abi.encode(CURRENCY_OS_SLOT_ID))
        );
        assembly {
            _currencyOS := sload(CURRENCY_OS_KEY)
        }
    }

    /// @dev Yamato.sol must override it with correct logic.
    function feePool() public view override returns (address) {
        return ICurrencyOS(currencyOS()).feePool();
    }

    /// @dev Yamato.sol must override it with correct logic.
    function priceFeed()
        public
        view
        override(IYamato, YamatoBase)
        returns (address)
    {
        return ICurrencyOS(currencyOS()).priceFeed();
    }

    /// @dev All YamatoStores and YamatoActions except Yamato.sol are NOT needed to modify these funcs. Just write the same signature and don't fill inside. Yamato.sol must override it with correct logic.
    function permitDeps(
        address _sender
    ) public view override(IYamato, YamatoBase) returns (bool) {
        bool permit;
        address[10] memory deps = getDeps();
        for (uint256 i = 0; i < deps.length; i++) {
            if (_sender == deps[i]) permit = true;
        }
        return permit;
    }

    /// @dev Get package-deps to check onlyYamato-permitDeps logic
    function getDeps() public view returns (address[10] memory) {
        return [
            address(this),
            depositor(),
            borrower(),
            repayer(),
            withdrawer(),
            redeemer(),
            sweeper(),
            pool(),
            priorityRegistry(),
            scoreRegistry()
        ];
    }

    /*
     * Only for test
     */

    /// @dev For test
    function setPriorityRegistry(
        address _priorityRegistry
    ) external onlyGovernance {
        bytes32 PRIORITY_REGISTRY_KEY = bytes32(
            keccak256(abi.encode(PRIORITY_REGISTRY_SLOT_ID))
        );
        assembly {
            sstore(PRIORITY_REGISTRY_KEY, _priorityRegistry)
        }
    }
}
