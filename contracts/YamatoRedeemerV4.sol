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
import "./PriceFeedV3.sol";
import "./Dependencies/YamatoAction.sol";
import "./Dependencies/PledgeLib.sol";
import "./Dependencies/SafeMath.sol";
import "./Interfaces/IYamato.sol";
import "./Interfaces/IYamatoV3.sol";
import "./Interfaces/IFeePool.sol";
import "./Interfaces/ICurrencyOS.sol";
import "./Interfaces/IYamatoRedeemer.sol";
import "./Interfaces/IYamatoRedeemerV4.sol";
import "./Interfaces/IPriorityRegistry.sol";
import "./Interfaces/IPriorityRegistryV6.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

/// @title Yamato Redeemer Contract
/// @author 0xMotoko

contract YamatoRedeemerV4 is IYamatoRedeemerV4, YamatoAction {
    using PledgeLib for IYamato.Pledge;
    using PledgeLib for uint256;

    function initialize(address _yamato) public initializer {
        __YamatoAction_init(_yamato);
    }

    function runRedeem(
        IYamatoRedeemer.RunRedeemArgs memory _args
    ) public override onlyYamato returns (IYamatoRedeemer.RedeemedArgs memory) {
        IYamatoRedeemerV4.RunRedeemVars memory vars;
        IPriorityRegistryV6 _prv6 = IPriorityRegistryV6(priorityRegistry());
        ICurrencyOS _currencyOS = ICurrencyOS(currencyOS());
        IERC20 _cjpy = IERC20(_currencyOS.currency());
        IYamato _yamato = IYamato(yamato());

        vars.ethPriceInCurrency = IPriceFeedV3(priceFeed()).fetchPrice();
        if (_args.isCoreRedemption) {
            _args.wantToRedeemCurrencyAmount = IPool(pool())
                .redemptionReserve();
            require(
                _args.wantToRedeemCurrencyAmount > 0,
                "The redemption reserve is empty."
            );
        } else {
            require(
                _cjpy.balanceOf(_args.sender) >=
                    _args.wantToRedeemCurrencyAmount,
                "Insufficient currency balance to redeem."
            );
        }
        vars._GRR = _yamato.GRR();
        vars._mcrPercent = uint256(_yamato.MCR());
        vars._mcrPertenk = vars._mcrPercent * 100;

        /*
            On memory update: Get redemption candidates with calculating after-redemption state
        */
        vars._nextICR = _prv6.LICR();
        vars._nextICR = vars._nextICR == 0 ? 1 : vars._nextICR;
        vars._nextout = _prv6.rankedQueueNextout(vars._nextICR);
        vars._nextin = _prv6.rankedQueueTotalLen(vars._nextICR);
        vars._maxCount = IYamatoV3(yamato()).maxRedeemableCount();
        vars._bulkedPledges = new IYamato.Pledge[](vars._maxCount * 2);
        vars._skippedPledges = new IYamato.Pledge[](vars._maxCount);
        vars._pledgesOwner = new address[](vars._maxCount);
        vars._checkpoint =
            vars._mcrPercent +
            IYamatoV3(yamato()).CHECKPOINT_BUFFER();

        while (true) {
            address _pledgeAddr = _prv6.rankedQueuePop(vars._nextICR);

            if (vars._nextICR >= vars._checkpoint) {
                // Note: This case conditioned as
                //       vars._activePledgeLength - vars._count == 0 || vars._nextICR >= vars._checkpoint
                //       but removed the first clause for simplicity.
                //       It would cause worse gas consumption in pledge-lacking cases but it's okay.
                break; /* inf loop checker */
            }

            if (_pledgeAddr == address(0)) {
                vars._nextICR++;
                continue; /* That rank has been exhausted */
            }

            IYamato.Pledge memory _pledge = _yamato.getPledge(_pledgeAddr);

            uint256 _ICRpertenk = _pledge.getICRWithPrice(
                vars.ethPriceInCurrency
            );

            if (
                vars._nextICR == vars._mcrPercent &&
                _ICRpertenk == vars._mcrPertenk /* priority=realICR=MCR */
            ) {
                vars._nextICR++;
                vars._nextout = _prv6.rankedQueueNextout(vars._nextICR);
                vars._nextin = _prv6.rankedQueueTotalLen(vars._nextICR);
                continue; /* To avoid "just-on-MCR" pledges */
            } else {
                vars._toBeRedeemedFragment = _pledge.toBeRedeemed(
                    vars._mcrPertenk,
                    _ICRpertenk,
                    vars.ethPriceInCurrency
                );

                if (
                    vars._toBeRedeemedFragment == 0 &&
                    _ICRpertenk >= vars._mcrPertenk
                ) {
                    vars._skippedPledges[vars._skipCount] = _pledge;
                    vars._skipCount++;
                    continue; /* To skip until next poppables. This must be upserted below to refresh obsoleted priority. */
                }

                if (
                    vars._toBeRedeemed + vars._toBeRedeemedFragment >
                    _args.wantToRedeemCurrencyAmount
                ) {
                    vars._toBeRedeemedFragment =
                        _args.wantToRedeemCurrencyAmount -
                        vars
                            ._toBeRedeemed; /* Limiting redeeming amount within the amount sender has. */
                }

                vars._toBeRedeemedFragmentInEth =
                    (vars._toBeRedeemedFragment * 1e18) /
                    vars.ethPriceInCurrency;
                /* state update for redeemed pledge */

                require(
                    vars._toBeRedeemedFragmentInEth <= _pledge.coll,
                    "redemption fragment can't be bigger than coll."
                );
                uint256 _dustyDiff = _pledge.coll -
                    vars._toBeRedeemedFragmentInEth;
                uint256 _debtAfter = _pledge.debt - vars._toBeRedeemedFragment;
                bool _isSweepableWithColl = (_dustyDiff > 0) &&
                    ((_dustyDiff * vars.ethPriceInCurrency) / 1e18 <
                        _debtAfter);
                uint256 _increasedToBeRedeemedFragment = vars
                    ._toBeRedeemedFragment +
                    (_dustyDiff * vars.ethPriceInCurrency) /
                    1e18;
                bool _hasRoundingBudget = vars._toBeRedeemed +
                    _increasedToBeRedeemedFragment <=
                    _args.wantToRedeemCurrencyAmount;

                if (_isSweepableWithColl && _hasRoundingBudget) {
                    /* Rounding a dusty collateral */
                    vars._toBeRedeemedFragmentInEth += _dustyDiff;
                    require(
                        vars._toBeRedeemedFragmentInEth == _pledge.coll,
                        "For ICR=0% pledge, coll must be zero."
                    );
                    vars._toBeRedeemedFragment = _increasedToBeRedeemedFragment;
                }

                _pledge.debt -= vars._toBeRedeemedFragment;
                _pledge.coll -= vars._toBeRedeemedFragmentInEth;

                vars._toBeRedeemed += vars._toBeRedeemedFragment;
                vars._toBeRedeemedInEth += vars._toBeRedeemedFragmentInEth;
                vars._pledgesOwner[vars._count] = _pledge.owner;
                vars._bulkedPledges[vars._count] = _pledge;
                vars._count++;

                if (vars._toBeRedeemed == _args.wantToRedeemCurrencyAmount) {
                    break; /* Could pile up money as sender wants. */
                }
                if (vars._count >= vars._maxCount) {
                    break; /* count reached to the target */
                }
            }
        }
        require(vars._toBeRedeemed > 0, "No pledges are redeemed.");
        require(
            vars._toBeRedeemed <= _args.wantToRedeemCurrencyAmount,
            "Redeeming amount exceeds bearer's balance."
        );

        /*
            Merge skipped pledges to re-redeem later
        */
        for (uint256 i; i < vars._maxCount; ) {
            vars._bulkedPledges[vars._maxCount + i] = vars._skippedPledges[i];
            unchecked {
                ++i; // Note: gas saving
            }
        }

        /*
            External tx: bulkUpsert and LICR update
        */
        uint256[] memory _priorities = _prv6.bulkUpsert(vars._bulkedPledges);

        /*
            On memory update: priority
        */
        for (uint256 i; i < vars._bulkedPledges.length; i++) {
            vars._bulkedPledges[i].priority = _priorities[i];
        }

        /*
            External tx: setPledges
        */

        IYamatoV3(yamato()).setPledges(vars._bulkedPledges);

        /*
            External tx: setTotalColl, setTotalDebt
        */
        (uint256 totalColl, uint256 totalDebt, , , , ) = IYamato(yamato())
            .getStates();
        IYamato(yamato()).setTotalDebt(totalDebt - vars._toBeRedeemed);
        IYamato(yamato()).setTotalColl(totalColl - vars._toBeRedeemedInEth);
        /*
            Handle compensations
        */
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
            IPool(pool()).useRedemptionReserve(vars._toBeRedeemed);
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

        // Burn 100%
        _currencyOS.burnCurrency(_redemptionBearer, vars._toBeRedeemed);

        // Pay 99% in ETH
        vars._effectiveRedemptionAmountInCurrency =
            (vars._toBeRedeemed * (100 - vars._GRR)) /
            100;
        vars._effectiveRedemptionAmount =
            (vars._toBeRedeemedInEth * (100 - vars._GRR)) /
            100;
        IPool(pool()).sendETH(
            _returningDestination,
            vars._effectiveRedemptionAmount
        );

        /*
            4. Pay 1% gas compensation in ETH
        */
        vars._gasCompensationInETH =
            vars._toBeRedeemedInEth -
            vars._effectiveRedemptionAmount;
        IPool(pool()).sendETH(_args.sender, vars._gasCompensationInETH);

        return
            IYamatoRedeemer.RedeemedArgs(
                vars._effectiveRedemptionAmountInCurrency,
                vars._effectiveRedemptionAmount,
                vars._pledgesOwner,
                vars.ethPriceInCurrency,
                vars._gasCompensationInETH
            );
    }
}
