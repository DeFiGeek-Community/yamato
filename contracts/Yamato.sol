pragma solidity ^0.8.3;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Yamato
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 *
 * This Factory is a fork of Murray Software's deliverables.
 * And this entire project is including the fork of Hegic Protocol.
 * Hence the license is alinging to the GPL-3.0
*/

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "./Pool.sol";
import "./YMT.sol";
import "./CJPY.sol";
import "./PriceFeed.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Yamato is ReentrancyGuard {
    IPool pool = address(0);
    IYMT ymt = address(0);
    ICJPY cjpy = address(0);
    IPriceFeed feed = address(0);
    struct Pledge {
        uint coll;
        uint debt;
        bool isCreated;
    }
    mapping(address=>Pledge) public pledges;
    address[] public pledgesIndices;
    mapping(address=>bool) public issueLocks;
    mapping(address=>uint) public withdrawLocks;

    uint8 public MCR = 110; // MinimumCollateralizationRatio
    uint8 public FR = 20; // FeeRate
    uint8 public RRR = 80; // RedemptionReserveRate
    uint8 public DCRR = 20; // DebtCancelReserveRate
    uint8 public GRR = 1; // GasReserveRate



    /*
    ==============================
        Single Pledge Actions
    ==============================
        - issue
        - repay
        - withdraw
    */


    /// @title issue()
    /// @author 0xMotoko
    /// @notice Make a Pledge with ETH and borrow some CJPY instead. Forefront 20% fee.
    /// @dev In JPY term, 15.84%=RR, 0.16%=RRGas, 3.96%=DCR, 0.4%=DCRGas
    /// @param cjpyAmount maximal redeemable amount
    /// @return void
    function issue(uint issueAmountInCjpy) public {
        bool storage locked = issueLocks[msg.sender];
        require(!locked, "Issuance is being locked for this sender.");
        locked = true;

        uint ethAmount = msg.value;
        (uint jpyPerUSD, uint ethPerUSD) = feed.fetchPrice();
        uint jpyPerEth = jpyPerUSD / ethPerUSD; // jpy/eth = (jpy/usd) / (eth/usd)
        uint jpyAmountToMint = jpyPerEth * ethAmount;
        cjpy.mint(jpyAmountToMint); // onlyYamato
        uint fee = jpyAmountToMint * FR/100;
        uint redemptionReserve = fee * RRR/100;
        uint debtCancelReserve = fee * DCRR/100;

        cjpy.transfer(address(pool), redemptionReserve);
        cjpy.transfer(address(pool), debtCancelReserve);
        cjpy.transfer(msg.sender, jpyAmountToMint - fee);

        pool.depositRedemptionReserve(redemptionReserve);
        pool.depositDebtCancelReserve(debtCancelReserve);

        Pledge storage pledge = pledges[msg.sender];

        if(pledge.isCreated){
            require( getICR((pledge.coll+ethAmount)*jpyPerEth, pledge.debt+issueAmountInCjpy) >= MCR, "This minting is invalid because of too large borrowing.");
            pledge.coll += ethAmount;
            pledge.debt += issueAmountInCjpy;
        } else {
            require( getICR(ethAmount*jpyPerEth, issueAmountInCjpy) >= MCR, "This minting is invalid because of too large borrowing.");
            pledge = Pledge(
                ethAmount,
                jpyAmountToMint,
                true
            );
            pledgesIndices.push(msg.sender);
        }


        (bool success,) = payable(pool).call{value:ethAmount}("");
        require(success, "transfer failed");
        pool.lockETH(ethAmount);
        locked = false;
        withdrawLocks[msg.sender] = block.timestamp + 3 days;
    }


    /// @title repay()
    /// @author 0xMotoko
    /// @notice Recover the collateral of one's pledge.
    /// @dev Need allowance. TCR will go up.
    /// @param cjpyAmount maximal redeemable amount
    /// @return void
    function repay(uint cjpyAmount) public {
        /*
            1. Get feed
        */
        (uint jpyPerUSD, uint ethPerUSD) = feed.fetchPrice();
        uint jpyPerEth = jpyPerUSD / ethPerUSD; // jpy/eth = (jpy/usd) / (eth/usd)
        uint ethAmount = cjpyAmount / jpyPerEth;


        /*
            2. Update pledge
        */
        Pledge storage pledge = pledges[msg.sender];
        pledge.debt -= cjpyAmount;


        /*
            3. Validate TCR
        */
        require(getICR(pledge.coll*jpyPerEth,pledge.debt()) >= MCR, "Repayment failure: ICR is not more than MCR.");



        /*
            4-1. Charge CJPY
            4-2. Return coll to the redeemer
        */
        cjpy.burn(msg.sender, cjpyAmount);
    }


    /// @title withdraw()
    /// @author 0xMotoko
    /// @notice Withdraw collaterals from one's pledge.
    /// @dev Nood reentrancy guard. TCR will go down.
    /// @param ethAmount withdrawal amount
    /// @return void
    function withdraw(uint ethAmount) public nonReentrant {
        uint storage lockedUntil = withdrawLocks[msg.sender];
        require(lockedUntil <= block.timestamp, "Withdrawal is being locked for this sender.");

        /*
            1. Get feed
        */
        (uint jpyPerUSD, uint ethPerUSD) = feed.fetchPrice();
        uint jpyPerEth = jpyPerUSD / ethPerUSD; // jpy/eth = (jpy/usd) / (eth/usd)

        /*
            2. Update pledge
        */
        Pledge storage pledge = pledges[msg.sender];
        pledge.coll -= ethAmount;


        /*
            3. Validate TCR
        */
        require(getICR(pledge.coll*jpyPerEth,pledge.debt()) >= MCR, "Withdrawal failure: ICR is not more than MCR.");


        /*
            4-1. Charge CJPY
            4-2. Return coll to the redeemer
        */
        (bool success,) = payable(msg.sender).call{value:ethAmount}("");
        require(success, "ETH transfer failed");
    }



    /*
    ==============================
        Multi Pledge Actions
    ==============================
        - redeem
        - sweep
    */

    /// @title redeem()
    /// @author 0xMotoko
    /// @notice Retrieve ETH collaterals from Pledges by burning CJPY
    /// @dev Need allowance. Lowest ICR Pledges get redeemed first. TCR will go up. coll=0 pledges are to be remained.
    /// @param maxRedemptionCjpyAmount maximal redeemable amount
    /// @param isCoreRedemption A flag for who to pay
    /// @return void
    function redeem(uint maxRedemptionCjpyAmount, bool isCoreRedemption) public nonReentrant {
        uint redeemStart = pool.redemptionReserve;

        /*
            1. Get feed
        */
        (uint jpyPerUSD, uint ethPerUSD) = feed.fetchPrice();
        uint jpyPerEth = jpyPerUSD / ethPerUSD; // jpy/eth = (jpy/usd) / (eth/usd)

        /*
            2. Validate TCR
        */
        require(getICR(getEntireSystemColl()*jpyPerEth,getEntireSystemDebt())<MCR, "Redemption failure: TCR is not less than MCR.");


        /*
            4. Sort Pledges by ICR
        */
        for(uint i = 0; i < pledgesIndices.length; i++){
            address borrower = pledgesIndices[i];

            Pledge storage pledge = pledges[borrower];
            uint jpyAmountOfColl = jpyPerEth * pledge.coll;
            uint8 IndividualCollateralRatio = (pledge.debt / jpyAmountOfColl) * 100;

            if(IndividualCollateralRatio < MCR){
                sortedPledges[IndividualCollateralRatio].push(pledge);
            }
        }

        /*
            5. Update lowest ICR pledges until cjpy exhausted.
        */
        uint oldDebt;
        uint reserveLeft = maxRedemptionCjpyAmount;
        for(uint8 i = 1; i < MCR; i++){
            uint8 ICR = i;
            Pledge[] storage _sortedPledgesPerICR = sortedPledges[ICR];
            for(uint j = 0; j < _sortedPledgesPerICR.length; j++){
                Pledge storage pledge = _sortedPledgesPerICR[j];
                uint oldDebt = pledge.debt;
                uint reducingCjpyAmount;

                if(reserveLeft >= pledge.debt){
                    reducingCjpyAmount = oldDebt;
                } else {
                    reducingCjpyAmount = reserveLeft;
                }
                if(reducingCjpyAmount > reserveLeft) break; // TODO: Can it quit 2-depth loops early?

                uint reducingEthAmount = reducingCjpyAmount / jpyPerEth;
                pledge.debt -= reducingCjpyAmount;
                pledge.coll -= reducingEthAmount;
                reserveLeft -= reducingCjpyAmount;
            }
        }


        /*
            5. Ditribute colls.
        */
        uint totalRedeemedCjpyAmount = redeemStart - pool.redemptionReserve;
        uint totalRedeemedEthAmount = totalRedeemedCjpyAmount / jpyPerEth;
        uint dividendEthAmount = totalRedeemedEthAmount * (100-GRR)/100;
        if(isCoreRedemption){
            /* 
            [ Core Redemption - Pool Subtotal ]
                (-) Debt Cancel Reserve
                (+) Dividend Reserve
            */
            cjpy.burn(address(pool), totalRedeemedCjpyAmount);
            pool.useRedemptionReserve(totalRedeemedCjpyAmount);
            pool.accumulateDividendReserve(dividendEthAmount);

            // TODO: gas compensation for the redeemed ETH
            pool.sendETH(address(pool), dividendEthAmount * (100-GRR)/100 );
        } else {
            /* 
            [ Peer redemption ]
            */
            cjpy.burn(msg.sender, totalRedeemedCjpyAmount);
            pool.sendETH(msg.sender, dividendEthAmount);
        }


        /*
            6. Gas compensation
        */
        uint gasCompensation = totalRedeemedEthAmount * (GRR/100);
        (bool success,) = payable(msg.sender).call{value:gasCompensation}("");
        require(success, "Gas payback has been failed.");
    }



    /// @title sweep()
    /// @author 0xMotoko
    /// @notice Initialize all pledges such that ICR is 0 (= (0*price)/debt )
    /// @dev Will be run by incentivised DAO member. Scan all pledges and filter debt>0, coll=0. Pay gas compensation from the 1% of DebtCancelReserve at most, and as same as 1% of the actual debt cancelling amount.
    /// @return void
    function sweep() public nonReentrant {
        uint debtCancelStart = pool.debtCancelReserve;
        require(debtCancelStart > 0, "Sweep failure: debt cancel reserve is empty.");
        uint maxGasCompensation = debtCancelStart * (GRR/100);
        uint maxDebtCancellable = debtCancelStart - maxGasCompensation;
        /*
            1. Scan Pledges
        */
        for(uint i = 0; i < pledgesIndices.length; i++){
            address borrower = pledgesIndices[i];
            Pledge storage pledge = pledges[borrower];
            uint currentUsage = debtCancelStart - pool.debtCancelReserve;

            /*
                2. (Full or partical) repayment of Zero-collateral Pledges
            */
            uint availablePart = maxDebtCancellable - currentUsage;
            if(pledge.coll == 0){
                uint _debt;
                if(availablePart >= pledge.debt) {
                    _debt = pledge.debt;
                } else {
                    _debt = availablePart;
                }
                pool.useDebtCancelReserve(_debt);
                cjpy.burn(address(pool), _debt);
                pledge.debt -= _debt;
                pledge.isCreated = (pledge.debt > 0);
            }

            /*
                3. Early quit for saving gas.
            */ 
            if(availablePart < pledge.debt) break;
        }

        /*
            4. Gas compensation
        */
        uint debtCancelEnd = pool.debtCancelReserve;
        uint debtCancelDiff = debtCancelStart - debtCancelEnd;
        uint gasCompensation = debtCancelDiff * (GRR/100);
        (bool success,) = payable(msg.sender).call{value:gasCompensation}("");
        require(success, "Gas payback has been failed.");
        pool.useDebtCancelReserve(gasCompensation);


    }



    function getICR(uint collInCjpy, uint debt) internal returns (uint ICR) {
        if(debt == 0){
            ICR = 2**256 - 1;
        } else {
            ICR = (collInCjpy / debt)*100;
        }
    }

}