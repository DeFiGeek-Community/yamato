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

contract YamatoRedeemerV4 is IYamatoRedeemer, YamatoAction {
    using PledgeLib for IYamato.Pledge;
    using PledgeLib for uint256;

    function initialize(address _yamato) public initializer {
        __YamatoAction_init(_yamato);
    }

    function runRedeem(RunRedeemArgs memory _args)
        public
        override
        onlyYamato
        returns (RedeemedArgs memory)
    {
        IYamatoRedeemerV4.RunRedeemVars memory vars;
        vars.ethPriceInCurrency = IPriceFeed(feed()).fetchPrice();
        vars.currencyAmountStart = _args.wantToRedeemCurrencyAmount;
        vars._reminder = _args.wantToRedeemCurrencyAmount;
        vars._pledgeLength = IPriorityRegistry(priorityRegistry())
            .pledgeLength();
        vars._pledgesOwner = new address[](vars._pledgeLength);
        vars._GRR = IYamato(yamato()).GRR();
        vars._mcrPercent = uint256(IYamato(yamato()).MCR());
        vars._mcrPertenk = vars._mcrPercent * 100;

        /*
            On memory update: Get redemption candidates with calculating after-redemption state
        */
        vars._nextICR = IPriorityRegistryV6(priorityRegistry()).LICR();
        vars._nextout = IPriorityRegistryV6(priorityRegistry())
            .rankedQueueNextout(vars._nextICR);
        vars._nextin = IPriorityRegistryV6(priorityRegistry())
            .rankedQueueTotalLen(vars._nextICR);
        vars._maxCount = IYamatoV3(yamato()).maxRedeemableCount();
        vars._bulkedPledges = new IYamato.Pledge[](vars._maxCount);
        vars._pledgesOwner = new address[](vars._maxCount);
        IPriorityRegistryV6 _prv6 = IPriorityRegistryV6(priorityRegistry());
        vars._activePledgeLength =
            vars._pledgeLength -
            _prv6.rankedQueueLen(0) -
            _prv6.rankedQueueLen(_prv6.MAX_PRIORITY());

        while (true) {
            address _pledgeAddr = _prv6.rankedQueuePop(vars._nextICR);

            if (vars._activePledgeLength - vars._count == 0) {
                break; /* inf loop checker */
            }

            if (_pledgeAddr == address(0)) {
                vars._nextICR++;
                continue; /* That rank has been exhausted */
            }

            IYamato.Pledge memory _pledge = IYamato(yamato()).getPledge(
                _pledgeAddr
            );
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
                vars._redeemingAmount = _pledge.toBeRedeemed(
                    vars._mcrPertenk,
                    _ICRpertenk,
                    vars.ethPriceInCurrency
                );

                if (vars._redeemingAmount == 0) {
                    break; /* Given "just-on-MCR" pledge, full redemption but less than the sender wants */
                }
                /* state update for redeemed pledge */

                console.log(_pledge.getICRWithPrice(vars.ethPriceInCurrency));
                _pledge.debt -= vars._redeemingAmount;
                _pledge.coll -=
                    (vars._redeemingAmount * 1e18) /
                    vars.ethPriceInCurrency;
                vars._toBeRedeemed += vars._redeemingAmount;
                vars._pledgesOwner[vars._count] = _pledge.owner;
                vars._bulkedPledges[vars._count] = _pledge;
                vars._count++;

                if (vars._toBeRedeemed >= _args.wantToRedeemCurrencyAmount) {
                    break; /* redeeming amount reached to the target */
                }
                if (vars._count >= vars._maxCount) {
                    break; /* count reached to the target */
                }
            }
        }
        require(vars._toBeRedeemed > 0, "No pledges are redeemed.");

        /*
            External tx: bulkUpsert and LICR update
        */
        uint256[] memory _priorities = IPriorityRegistryV6(priorityRegistry())
            .bulkUpsert(vars._bulkedPledges);

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
        IYamato(yamato()).setTotalColl(
            totalColl - (vars._toBeRedeemed * 1e18) / vars.ethPriceInCurrency
        );

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
        IPool(pool()).sendETH(
            _returningDestination,
            (vars._toBeRedeemed * 1e18) / vars.ethPriceInCurrency
        );
        ICurrencyOS(currencyOS()).burnCurrency(
            _redemptionBearer,
            vars._toBeRedeemed
        );

        /*
            4. Gas compensation
        */
        uint256 gasCompensationInETH = ((vars._toBeRedeemed * 1e18) /
            vars.ethPriceInCurrency) * (vars._GRR / 100);
        IPool(pool()).sendETH(_args.sender, gasCompensationInETH);

        return
            RedeemedArgs(
                vars._toBeRedeemed,
                (vars._toBeRedeemed * 1e18) / vars.ethPriceInCurrency,
                vars._pledgesOwner,
                vars.ethPriceInCurrency,
                gasCompensationInETH
            );
    }

    /*****************************************************
        !!! Deprecated but in the IYamatoRedeemer.sol !!!
    *****************************************************/

    /// @dev Deprecated in V4. It was used older runRedeem() that only redeems one pledge.
    /// @notice Use when redemption
    function redeemPledge(
        IYamato.Pledge memory sPledge,
        uint256 currencyAmount,
        uint256 ethPriceInCurrency
    ) public override onlyYamato returns (IYamato.Pledge memory, uint256) {
        IYamato.Pledge memory sPledge;
        uint256 reminder;
        return (sPledge, reminder);
    }
}
