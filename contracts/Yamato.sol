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
import "./IERC20MintableBurnable.sol";
import "hardhat/console.sol";

interface IYamato {

}


/// @title Yamato Pledge Manager Contract
/// @author 0xMotoko
contract Yamato is IYamato, ReentrancyGuard{
    IPool pool;
    IERC20MintableBurnable ymt;
    IERC20MintableBurnable cjpy;
    IPriceFeed feed;
    struct Pledge {
        uint coll;
        uint debt;
        bool isCreated;
        address owner;
    }
    mapping(address=>Pledge) public pledges;
    address[] public pledgesIndices;
    mapping(uint=>Pledge[]) private sortedPledges;
    uint public totalColl;
    uint public totalDebt;

    mapping(address=>bool) public issueLocks;
    mapping(address=>uint) public withdrawLocks;

    uint8 public MCR = 110; // MinimumCollateralizationRatio
    uint8 public FR = 20; // FeeRate
    uint8 public RRR = 80; // RedemptionReserveRate
    uint8 public SRR = 20; // SweepReserveRate
    uint8 public GRR = 1; // GasReserveRate

    constructor(address _pool, address _feed, address _ymt, address _cjpy){
         pool = IPool(_pool);
         feed = IPriceFeed(_feed);
         ymt = IERC20MintableBurnable(_ymt);
         cjpy = IERC20MintableBurnable(_cjpy);
    }


    /*
    ==============================
        Single Pledge Actions
    ==============================
        - issue
        - repay
        - withdraw
    */


    /// @notice Make a Pledge with ETH and borrow some CJPY instead. Forefront 20% fee.
    /// @dev In JPY term, 15.84%=RR, 0.16%=RRGas, 3.96%=SR, 0.4%=SRGas
    /// @param issueAmountInCjpy maximal redeemable amount
    function issue(uint issueAmountInCjpy) public payable {
        require(!issueLocks[msg.sender], "Issuance is being locked for this sender.");
        issueLocks[msg.sender] = true;

        uint ethAmount = msg.value;
        uint jpyPerEth = feed.fetchPrice();
        uint cjpyAmountToMint = jpyPerEth * ethAmount;
        cjpy.mint(msg.sender, cjpyAmountToMint); // onlyYamato
        uint fee = cjpyAmountToMint * FR/100;
        uint redemptionReserve = fee * RRR/100;
        uint sweepReserve = fee * SRR/100;
        uint availableCjpy = cjpyAmountToMint - fee;

        cjpy.transfer(address(pool), redemptionReserve);
        cjpy.transfer(address(pool), sweepReserve);
        cjpy.transfer(msg.sender, availableCjpy);

        pool.depositRedemptionReserve(redemptionReserve);
        pool.depositSweepReserve(sweepReserve);

        Pledge storage pledge = pledges[msg.sender];

        if(pledge.isCreated){
            require( getICR((pledge.coll+ethAmount)*jpyPerEth, pledge.debt+issueAmountInCjpy) >= MCR, "This minting is invalid because of too large borrowing.");
            pledge.coll += ethAmount;
            pledge.debt += issueAmountInCjpy;
            totalColl += ethAmount;
            totalDebt += issueAmountInCjpy;
        } else {
            require( getICR(ethAmount*jpyPerEth, issueAmountInCjpy/*issueAmountInCjpy*/) >= MCR, "This minting is invalid because of too large borrowing.");
            pledge.coll = ethAmount;
            pledge.debt = issueAmountInCjpy;
            pledge.isCreated = true;
            pledge.owner = msg.sender;

            pledgesIndices.push(msg.sender);
            totalColl += ethAmount;
            totalDebt += issueAmountInCjpy;
        }


        (bool success,) = payable(address(pool)).call{value:ethAmount}("");
        require(success, "transfer failed");
        pool.lockETH(ethAmount);
        issueLocks[msg.sender] = false;
        withdrawLocks[msg.sender] = block.timestamp + 3 days;
    }


    /// @notice Recover the collateral of one's pledge.
    /// @dev Need allowance. TCR will go up.
    /// @param cjpyAmount maximal redeemable amount
    function repay(uint cjpyAmount) public {
        /*
            1. Get feed and Pledge
        */
        uint jpyPerEth = feed.fetchPrice();
        Pledge storage pledge = pledges[msg.sender];


        /*
            2. Check repayability
        */
        require(getICR(pledge.coll*jpyPerEth,pledge.debt) >= MCR, "Repayment failure: ICR is not more than MCR.");

        /*
            2. Update pledge and the global variable
        */
        pledge.debt -= cjpyAmount;
        totalDebt -= cjpyAmount;

        /*
            3-1. Charge CJPY
            3-2. Return coll to the redeemer
        */
        cjpy.burnFrom(msg.sender, cjpyAmount);
    }


    /// @notice Withdraw collaterals from one's pledge.
    /// @dev Nood reentrancy guard. TCR will go down.
    /// @param ethAmount withdrawal amount
    function withdraw(uint ethAmount) public nonReentrant {
        /*
            1. Get feed and pledge
        */
        uint jpyPerEth = feed.fetchPrice();
        Pledge storage pledge = pledges[msg.sender];

        /*
            2. Validate
        */
        require(withdrawLocks[msg.sender] <= block.timestamp, "Withdrawal is being locked for this sender.");
        require(getICR(pledge.coll*jpyPerEth,pledge.debt) >= MCR, "Withdrawal failure: ICR is not more than MCR.");

        /*
            3. Update pledge
        */
        pledge.coll -= ethAmount;
        totalColl -= ethAmount;


        /*
            4. Validate TCR
        */
        require(getICR(pledge.coll*jpyPerEth,pledge.debt) >= MCR, "Withdrawal failure: ICR can't be less than MCR after withdrawal.");


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
    function redeem(uint maxRedemptionCjpyAmount, bool isCoreRedemption) public nonReentrant {
        uint redeemStart = pool.redemptionReserve();

        /*
            1. Get feed
        */
        uint jpyPerEth = feed.fetchPrice();
        

        /*
            2. Validate TCR
        */
        require(getTCR(jpyPerEth)<MCR, "Redemption failure: TCR is not less than MCR.");


        /*
            4. Sort Pledges by ICR
        */
        for(uint i = 0; i < pledgesIndices.length; i++){
            address borrower = pledgesIndices[i];

            Pledge memory pledge = pledges[borrower];
            if(pledge.coll > 0){
                uint ICR = getICR(pledge.coll * jpyPerEth, pledge.debt);
                if(ICR < MCR){
                    sortedPledges[ICR].push(pledge);
                }
            }
        }

        /*
            5. Update lowest ICR pledges until cjpy exhausted.
        */
        uint reserveLeftInEth = maxRedemptionCjpyAmount/jpyPerEth;
        for(uint i = 1; i < MCR; i++){
            uint ICR = i;
            Pledge[] storage _sortedPledgesPerICR = sortedPledges[ICR];
            for(uint j = 0; j < _sortedPledgesPerICR.length; j++){
                Pledge memory sPledge = _sortedPledgesPerICR[j];
                Pledge storage pledge = pledges[sPledge.owner];
                if(pledge.coll > 0){
                    bool isFullRedemption = reserveLeftInEth >= pledge.coll;
                    uint reducingEthAmount;
                    if(isFullRedemption){
                        reducingEthAmount = pledge.coll;
                    } else {
                        reducingEthAmount = reserveLeftInEth;
                    }

                    /*
                        5-1. Update
                    */
                    pledge.debt -= reducingEthAmount * jpyPerEth;
                    pledge.coll -= reducingEthAmount;

                    require(totalDebt > reducingEthAmount * jpyPerEth, "totalDebt is negative");
                    totalDebt -= reducingEthAmount * jpyPerEth;
                    require(totalColl > reducingEthAmount, "totalColl is negative");
                    totalColl -= reducingEthAmount;

                    reserveLeftInEth -= reducingEthAmount;
                }
            }
        }

        /*
            5-2. Delete temporal pledges
        */
        for(uint i = 1; i < MCR; i++){
            for(uint j = 1; j < sortedPledges[i].length; j++){
                delete sortedPledges[i][j];                    
            }
        }


        /*
            5. Ditribute colls.
        */
        uint totalRedeemedCjpyAmount = redeemStart - pool.redemptionReserve();
        uint totalRedeemedEthAmount = totalRedeemedCjpyAmount / jpyPerEth;
        uint dividendEthAmount = totalRedeemedEthAmount * (100-GRR)/100;
        if(isCoreRedemption){
            /* 
            [ Core Redemption - Pool Subtotal ]
                (-) Debt Cancel Reserve
                (+) Dividend Reserve
            */
            cjpy.burnFrom(address(pool), totalRedeemedCjpyAmount);
            pool.useRedemptionReserve(totalRedeemedCjpyAmount);
            pool.accumulateDividendReserve(dividendEthAmount);

            // TODO: gas compensation for the redeemed ETH
            pool.sendETH(address(pool), dividendEthAmount * (100-GRR)/100 );
        } else {
            /* 
            [ Peer redemption ]
            */
            cjpy.burnFrom(msg.sender, totalRedeemedCjpyAmount);
            pool.sendETH(msg.sender, dividendEthAmount);
        }


        /*
            6. Gas compensation
        */
        uint gasCompensation = totalRedeemedEthAmount * (GRR/100);
        (bool success,) = payable(msg.sender).call{value:gasCompensation}("");
        require(success, "Gas payback has been failed.");
    }



    /// @notice Initialize all pledges such that ICR is 0 (= (0*price)/debt )
    /// @dev Will be run by incentivised DAO member. Scan all pledges and filter debt>0, coll=0. Pay gas compensation from the 1% of SweepReserve at most, and as same as 1% of the actual sweeping amount.
    function sweep() public nonReentrant {
        uint sweepStart = pool.sweepReserve();
        require(sweepStart > 0, "Sweep failure: sweep reserve is empty.");
        uint maxGasCompensation = sweepStart * (GRR/100);
        uint maxSweeplable = sweepStart - maxGasCompensation;
        /*
            1. Scan Pledges
        */
        for(uint i = 0; i < pledgesIndices.length; i++){
            address borrower = pledgesIndices[i];
            Pledge storage pledge = pledges[borrower];
            uint currentUsage = sweepStart - pool.sweepReserve();

            /*
                2. (Full or partical) repayment of Zero-collateral Pledges
            */
            uint availablePart = maxSweeplable - currentUsage;
            console.log("totalColl:%s, totalDebt:%s", totalColl, totalDebt);
            if(pledge.coll == 0){
                uint _debt;
                if(availablePart >= pledge.debt) {
                    _debt = pledge.debt;
                } else {
                    _debt = availablePart;
                }
                console.log("_debt:%s", _debt);
                pool.useSweepReserve(_debt);
                cjpy.burnFrom(address(pool), _debt);
                pledge.debt -= _debt;
                totalDebt -= _debt;
                pledge.isCreated = (pledge.debt > 0);
            }
            console.log("totalColl:%s, totalDebt:%s", totalColl, totalDebt);

            /*
                3. Early quit for saving gas.
            */ 
            if(availablePart < pledge.debt) break;
        }

        /*
            4. Gas compensation
        */
        uint sweepEnd = pool.sweepReserve();
        uint sweepDiff = sweepStart - sweepEnd;
        uint gasCompensation = sweepDiff * (GRR/100);
        (bool success,) = payable(msg.sender).call{value:gasCompensation}("");
        require(success, "Gas payback has been failed.");
        pool.useSweepReserve(gasCompensation);

    }


    /// @notice Calculate ICR
    /// @dev (coll*priceInJpy)/debt, if debt==0 then return uint256-max ICR
    /// @param collInCjpy coll * ethPriceInJpy
    /// @param debt from pledge
    /// @return ICR in uint256
    function getICR(uint collInCjpy, uint debt) public view returns (uint ICR) {
        if(debt == 0){
            ICR = 2**256 - 1;
        } else {
            ICR = 100 * collInCjpy / debt;
        }
    }

    /// @notice Calculate TCR
    /// @dev (totalColl*jpyPerEth)/totalDebt
    /// @param jpyPerEth price of coll
    /// @return TCR in uint256
    function getTCR(uint jpyPerEth) public view returns (uint TCR) {
        TCR = getICR(totalColl*jpyPerEth,totalDebt);
    }


}