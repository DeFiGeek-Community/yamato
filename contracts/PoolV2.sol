pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly
import "./Interfaces/IYamato.sol";
import "./Interfaces/IFeePool.sol";
import "./Interfaces/ICurrencyOS.sol";
import "./Interfaces/IPriorityRegistryV6.sol";
import "./Dependencies/YamatoStore.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "hardhat/console.sol";

interface IPool {
    event RedemptionReserveDeposited(address, uint256, uint256);
    event RedemptionReserveUsed(address, uint256, uint256);
    event SweepReserveDeposited(address, uint256, uint256);
    event SweepReserveUsed(address, uint256, uint256);
    event ETHLocked(address, uint256, uint256);
    event ETHSent(address, address, uint256, uint256);
    event CurrencySent(address, address, uint256);

    function depositRedemptionReserve(uint256 amount) external;

    function useRedemptionReserve(uint256 amount) external;

    function depositSweepReserve(uint256 amount) external;

    function useSweepReserve(uint256 amount) external;

    function sendETH(address recipient, uint256 amount) external;

    function sendCurrency(address recipient, uint256 amount) external;

    function redemptionReserve() external view returns (uint256);

    function sweepReserve() external view returns (uint256);
}

contract PoolV2 is IPool, YamatoStore, ReentrancyGuardUpgradeable {
    uint256 public override redemptionReserve; // Auto redemption pool a.k.a. (kinda) Stability Pool in Liquity
    uint256 public override sweepReserve; // Protocol Controlling Value (PCV) to remove Pledges(coll=0, debt>0)

    function initialize(address _yamato) public initializer {
        __ReentrancyGuard_init();
        __YamatoStore_init(_yamato);
    }

    /// @notice Store ETH for new deposit.
    /// @dev selfdestruct(address) can increase balance. Be sure that totalColl and balance can be different.
    receive() external payable onlyYamato {
        emit ETHLocked(msg.sender, msg.value, address(this).balance);
    }

    /// @notice Mint new currency and save it to this pool.
    /// @dev This only be used by YamatoBorrower and reserve is always minted, not transfered.
    function depositRedemptionReserve(
        uint256 amount
    ) public override onlyYamato {
        ICurrencyOS(IYamato(yamato()).currencyOS()).mintCurrency(
            address(this),
            amount
        ); // onlyYamato

        redemptionReserve += amount;
        emit RedemptionReserveDeposited(msg.sender, amount, redemptionReserve);
    }

    /// @notice Reduce redemption budget.
    /// @dev Please be careful that this is not atomic with sendCurrency.
    function useRedemptionReserve(uint256 amount) public override onlyYamato {
        require(
            redemptionReserve >= amount,
            "You can't use the redemption reserve more than the pool has."
        );
        unchecked {
            redemptionReserve -= amount;
        }
        emit RedemptionReserveUsed(msg.sender, amount, redemptionReserve);
    }

    /// @notice Mint new currency and save it to this pool.
    /// @dev This only be used by YamatoBorrower and reserve is always minted, not transfered.
    function depositSweepReserve(uint256 amount) public override onlyYamato {
        ICurrencyOS(IYamato(yamato()).currencyOS()).mintCurrency(
            address(this),
            amount
        ); // onlyYamato
        sweepReserve += amount;
        emit SweepReserveDeposited(msg.sender, amount, sweepReserve);
    }

    /// @notice Reduce sweep budget.
    /// @dev Please be careful that this is not atomic with sendCurrency.
    function useSweepReserve(uint256 amount) public override onlyYamato {
        require(
            sweepReserve >= amount,
            "You can't use the sweep reserve more than the pool has."
        );
        unchecked {
            sweepReserve -= amount;
        }
        emit SweepReserveUsed(msg.sender, amount, sweepReserve);
    }

    /// @notice Transfer ETH from Pool to recipient.
    /// @dev Assume balance is greater than equal totalColl due to consistent logic and selfdestruct(address)
    function sendETH(
        address recipient,
        uint256 amount
    ) public override nonReentrant onlyYamato {
        require(
            address(this).balance >= amount,
            "locked collateral must be more than sending amount."
        );
        (bool success, ) = payable(recipient).call{value: amount}("");
        require(success, "transfer failed");
        emit ETHSent(msg.sender, recipient, amount, address(this).balance);
    }

    /// @notice Send currency from Pool to recipient
    function sendCurrency(
        address recipient,
        uint256 amount
    ) public override onlyYamato {
        IERC20 _currency = IERC20(ICurrencyOS(currencyOS()).currency());
        _currency.transfer(recipient, amount);
        emit CurrencySent(msg.sender, recipient, amount);
    }

    /// @notice Provide the data of public storage.
    function getStates()
        public
        view
        returns (uint256, uint256, uint256, uint256)
    {
        return (
            redemptionReserve,
            sweepReserve,
            address(feePool()).balance,
            address(this).balance
        );
    }

    /**************************
        Dev Ops Functions (Use it only when a tiny internal-state inconsistency.)
    **************************/

    /// @dev Make all pool reserves consistent.
    function refreshReserve() public onlyGovernance {
        IERC20 _currency = IERC20(ICurrencyOS(currencyOS()).currency());
        uint256 _poolBalance = _currency.balanceOf(address(this));
        redemptionReserve = 0;
        sweepReserve = _poolBalance;
    }

    /// @dev Make totalColl consistent
    function refreshColl(
        uint256 _acmTotalColl,
        address _fixer
    ) public onlyGovernance {
        IYamato _yamato = IYamato(yamato());

        uint256 _poolBalance = address(this).balance;
        require(_poolBalance < _acmTotalColl, "Pool is enough rich.");
        _yamato.setTotalColl(_poolBalance);

        uint256 _inconsistentETHAmount = _acmTotalColl - _poolBalance;

        IYamato.Pledge memory _pledge = _yamato.getPledge(_fixer);
        require(
            _pledge.coll > _inconsistentETHAmount,
            "Fixer must have enough coll."
        );
        _pledge.coll -= _inconsistentETHAmount;

        _pledge.priority = IPriorityRegistryV6(_yamato.priorityRegistry())
            .upsert(_pledge);

        _yamato.setPledge(_fixer, _pledge);
        _yamato.setPledge(_fixer, _pledge);
    }
}
