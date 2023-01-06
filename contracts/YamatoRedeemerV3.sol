pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "./Pool.sol";
import "./YMT.sol";
import "./PriceFeed.sol";
import "./Dependencies/YamatoAction.sol";
import "./Dependencies/PledgeLib.sol";
import "./Dependencies/SafeMath.sol";
import "./Interfaces/IYamato.sol";
import "./Interfaces/IFeePool.sol";
import "./Interfaces/ICurrencyOS.sol";
import "./Interfaces/IYamatoRedeemer.sol";
import "./Interfaces/IPriorityRegistry.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

/// @title Yamato Redeemer Contract
/// @author 0xMotoko

contract YamatoRedeemerV3 is IYamatoRedeemer, YamatoAction {
    using PledgeLib for IYamato.Pledge;
    using PledgeLib for uint256;

    function initialize(address _yamato) public initializer {
        __YamatoAction_init(_yamato);
    }

    // @dev no reentrancy guard because action funcs are protected by permitDeps()
    function runRedeem(
        RunRedeemArgs memory _args
    ) public override onlyYamato returns (RedeemedArgs memory) {
        /*
            1. Set up
        */
        RunRedeemVars memory vars;
        vars.ethPriceInCurrency = IPriceFeed(priceFeed()).fetchPrice();
        vars.currencyAmountStart = _args.wantToRedeemCurrencyAmount;
        vars._reminder = _args.wantToRedeemCurrencyAmount;
        vars._pledgesOwner = new address[](
            IPriorityRegistry(priorityRegistry()).pledgeLength()
        );
        vars._GRR = IYamato(yamato()).GRR();

        /*
            1. Balance check
            V2 (Dev 8, 2021)
        */
        if (_args.isCoreRedemption) {
            vars.bearerBalance = IPool(pool()).redemptionReserve();
        } else {
            vars.bearerBalance = IERC20(ICurrencyOS(currencyOS()).currency())
                .balanceOf(_args.sender);
        }
        require(
            _args.wantToRedeemCurrencyAmount < vars.bearerBalance,
            "You are redeeming more than the bearer has."
        );

        /*
            3. Scan pledges until fill the redeeming amount
        */
        while (vars._reminder > 0) {
            try IPriorityRegistry(priorityRegistry()).popRedeemable() returns (
                IYamato.Pledge memory _redeemablePledge
            ) {
                IYamato.Pledge memory sPledge = IYamato(yamato()).getPledge(
                    _redeemablePledge.owner
                );
                if (
                    !sPledge.isCreated ||
                    sPledge.coll == 0 ||
                    sPledge.owner == address(0)
                ) {
                    break;
                }

                /*
                    1. Expense collateral
                */

                (
                    IYamato.Pledge memory _redeemedPledge,
                    uint256 _reminderInThisTime
                ) = this.redeemPledge(
                        sPledge,
                        vars._reminder,
                        vars.ethPriceInCurrency
                    );

                vars._reminder = _reminderInThisTime;
                sPledge = _redeemedPledge;
                IYamato(yamato()).setPledge(sPledge.owner, sPledge);

                /*
                    2. Put the sludge pledge to the queue
                */

                try
                    IPriorityRegistry(priorityRegistry()).upsert(sPledge)
                returns (uint256 _newICRpercent) {
                    sPledge.priority = _newICRpercent;
                    IYamato(yamato()).setPledge(sPledge.owner, sPledge);
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
            vars.currencyAmountStart > vars._reminder,
            "No pledges are redeemed."
        );

        /*
            3. Update global state and ditribute colls.
        */
        uint256 totalRedeemedCurrencyAmount = vars.currencyAmountStart -
            vars._reminder;
        uint256 totalRedeemedEthAmount = (totalRedeemedCurrencyAmount * 1e18) /
            vars.ethPriceInCurrency;
        uint256 returningEthAmount = (totalRedeemedEthAmount *
            (100 - vars._GRR)) / 100;

        (uint256 totalColl, uint256 totalDebt, , , , ) = IYamato(yamato())
            .getStates();
        IYamato(yamato()).setTotalDebt(totalDebt - totalRedeemedCurrencyAmount);
        IYamato(yamato()).setTotalColl(totalColl - totalRedeemedEthAmount);

        address _redemptionBearer;
        address _returningDestination;
        if (_args.isCoreRedemption) {
            /* 
            [ Core Redemption - Pool Subtotal ]
                (-) Redemption Reserve (Currency)
                            v
                            v
                (+)  Fee Pool (ETH)
            */
            _redemptionBearer = pool();
            _returningDestination = feePool();
            IPool(pool()).useRedemptionReserve(totalRedeemedCurrencyAmount);
        } else {
            /* 
            [ Normal Redemption - Account Subtotal ]
                (-) Bearer Balance (Currency)
                            v
                            v
                (+) Bearer Balance (ETH)
            */
            _redemptionBearer = _args.sender;
            _returningDestination = _args.sender;
        }
        IPool(pool()).sendETH(_returningDestination, returningEthAmount);
        ICurrencyOS(currencyOS()).burnCurrency(
            _redemptionBearer,
            totalRedeemedCurrencyAmount
        );

        /*
            4. Gas compensation
        */
        uint256 gasCompensationInETH = totalRedeemedEthAmount *
            (vars._GRR / 100);
        IPool(pool()).sendETH(_args.sender, gasCompensationInETH);

        return
            RedeemedArgs(
                totalRedeemedCurrencyAmount,
                totalRedeemedEthAmount,
                vars._pledgesOwner,
                vars.ethPriceInCurrency,
                gasCompensationInETH
            );
    }

    /// @notice Use when redemption
    function redeemPledge(
        IYamato.Pledge memory sPledge,
        uint256 currencyAmount,
        uint256 ethPriceInCurrency
    ) public override onlyYamato returns (IYamato.Pledge memory, uint256) {
        require(sPledge.coll > 0, "Can't expense zero pledge.");
        uint256 collValuation = (sPledge.coll * ethPriceInCurrency) / 1e18;

        /*
            1. Calc reminder
        */
        uint256 redemptionAmount;
        uint256 reminder;
        uint256 ethToBeExpensed;

        uint256 icr = sPledge.getICR(priceFeed());
        uint256 mcr = uint256(IYamato(yamato()).MCR()) * 100;

        if (10000 < icr && icr < mcr) {
            // Note: Risky pledges. 10000<ICR<13000 redemption recovers ICR and calculations are tricky.
            uint256 cappedRedemptionAmount = sPledge.cappedRedemptionAmount(
                mcr,
                icr
            );

            if (cappedRedemptionAmount < currencyAmount) {
                redemptionAmount = cappedRedemptionAmount;
                ethToBeExpensed =
                    (cappedRedemptionAmount * 1e18) /
                    ethPriceInCurrency;

                reminder = currencyAmount - cappedRedemptionAmount;
            } else {
                redemptionAmount = currencyAmount;
                ethToBeExpensed =
                    (redemptionAmount * 1e18) /
                    ethPriceInCurrency;
                reminder = 0;
            }
        } else if (icr <= 10000) {
            // Note: Deficit pledges
            if (collValuation < currencyAmount) {
                redemptionAmount = collValuation;
                ethToBeExpensed = sPledge.coll;

                reminder = currencyAmount - collValuation;
            } else {
                redemptionAmount = currencyAmount;
                ethToBeExpensed =
                    (redemptionAmount * 1e18) /
                    ethPriceInCurrency;
                reminder = 0;
            }
        } else {
            // Note: Skip safe pledges
            revert("Can't come here");
            // return (sPledge, currencyAmount);
        }

        /*
            3. Update macro state
        */
        sPledge.coll -= ethToBeExpensed; // Note: storage variable in the internal func doesn't change state!
        sPledge.debt -= redemptionAmount;

        return (sPledge, reminder);
    }
}
