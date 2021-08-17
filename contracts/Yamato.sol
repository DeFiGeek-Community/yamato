pragma solidity 0.7.6;

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
import "./CurrencyOS.sol";
import "./PriceFeed.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./IERC20MintableBurnable.sol";
import "hardhat/console.sol";

interface IYamato {
    // function setFeed(address _feed) external; 
}


/// @title Yamato Pledge Manager Contract
/// @author 0xMotoko
contract Yamato is IYamato, ReentrancyGuard{

    IPool pool;
    ICurrencyOS cjpyOS;
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

    mapping(address=>uint) public withdrawLocks;
    mapping(address=>uint) public depositAndBorrowLocks;

    uint8 public MCR = 110; // MinimumCollateralizationRatio
    uint8 public RRR = 80; // RedemptionReserveRate
    uint8 public SRR = 20; // SweepReserveRate
    uint8 public GRR = 1; // GasReserveRate

    constructor(address _pool, address _cjpyOS, address _feed){
        pool = IPool(_pool);
        cjpyOS = ICurrencyOS(_cjpyOS);
        feed = IPriceFeed(_feed);
    }
    // function setFeed(address _feed) public onlyCurrencyOS override {
    //     feed = IPriceFeed(_feed);
    // }
    // modifier onlyCurrencyOS(){
    //     require(msg.sender == address(cjpyOS), "You are not the CurrencyOS");
    //     _;
    // }



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
        uint ethAmount = msg.value;

        /*
            1. Write to pledge
        */
        Pledge storage pledge = pledges[msg.sender];

        pledge.coll += ethAmount;
        totalColl += ethAmount;
        if(!pledge.isCreated){ // new pledge
            pledge.isCreated = true;
            pledge.owner = msg.sender;
            pledgesIndices.push(msg.sender);
        }

        /*
            2. Send ETH to pool
        */
        (bool success,) = payable(address(pool)).call{value:ethAmount}("");
        require(success, "transfer failed");
        pool.lockETH(ethAmount);
        depositAndBorrowLocks[msg.sender] = block.number;
    }


    /// @notice Borrow in CJPY. In JPY term, 15.84%=RR, 0.16%=RRGas, 3.96%=SR, 0.4%=SRGas
    /// @dev This function can't be executed just the same block with your deposit
    /// @param borrowAmountInCjpy maximal redeemable amount
    function borrow(uint borrowAmountInCjpy) public {
        /*
            1. Ready
        */
        Pledge storage pledge = pledges[msg.sender];
        uint jpyPerEth = feed.fetchPrice();
        uint _ICRAfter = getICR(pledge.coll * jpyPerEth, pledge.debt + borrowAmountInCjpy);

        /*
            2. Validate
        */
        require(depositAndBorrowLocks[msg.sender] < block.number, "Borrowing should not be executed within the same block with your deposit.");
        require(pledge.isCreated, "This pledge is not created yet.");
        require( _ICRAfter >= MCR, "This minting is invalid because of too large borrowing.");

        /*
            3. Fee
        */
        uint fee = borrowAmountInCjpy * FR(_ICRAfter*100)/10000;


        /*
            4. State transitions
        */

        /*
            4-1. Top-up scenario
        */
        pledge.debt += borrowAmountInCjpy;
        totalDebt += borrowAmountInCjpy;

        /*
            4-2. Cheat guard
        */
        withdrawLocks[msg.sender] = block.timestamp + 3 days;

        /*
            4-3. Borrowed fund & fee transfer
        */
        cjpyOS.mintCJPY(msg.sender, borrowAmountInCjpy-fee); // onlyYamato
        cjpyOS.mintCJPY(address(pool), fee); // onlyYamato

        if(pool.redemptionReserve()/pool.sweepReserve() >= 5){
            pool.depositSweepReserve(fee);
        } else {
            pool.depositRedemptionReserve(fee);
        }
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
        require(cjpyAmount > 0, "cjpyAmount is zero");
        require(pledge.debt > 0, "pledge.debt is zero");

        /*
            2-1. Update pledge and the global variable
        */
        pledge.debt -= cjpyAmount;
        totalDebt -= cjpyAmount;

        /*
            3-1. Charge CJPY
            3-2. Return coll to the redeemer
        */
        cjpyOS.burnCJPY(msg.sender, cjpyAmount);
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
        uint sortedPledgesCount = 0;

        /*
            1. Get feed
        */
        uint jpyPerEth = feed.fetchPrice();
        

        /*
            2. Sort Pledges by ICR
        */
        for(uint i = 0; i < pledgesIndices.length; i++){
            address borrower = pledgesIndices[i];

            Pledge memory pledge = pledges[borrower];
            if(pledge.coll > 0){
                uint ICR = getICR(pledge.coll * jpyPerEth, pledge.debt);
                if(ICR < MCR){
                    sortedPledges[ICR].push(pledge);
                    sortedPledgesCount += 1;
                }
            }
        }

        /*
            3. Validate TCR
        */
        require(sortedPledgesCount > 0, "No low-ICR pledges to redeem.");


        /*
            4. Update lowest ICR pledges until cjpy exhausted.
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
            5. Delete temporal pledges
        */
        for(uint i = 1; i < MCR; i++){
            for(uint j = 1; j < sortedPledges[i].length; j++){
                delete sortedPledges[i][j];                    
            }
        }


        /*
            6. Ditribute colls.
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
            cjpyOS.burnCJPY(address(pool), totalRedeemedCjpyAmount);
            pool.useRedemptionReserve(totalRedeemedCjpyAmount);
            pool.accumulateDividendReserve(dividendEthAmount);

            // TODO: gas compensation for the redeemed ETH
            pool.sendETH(address(pool), dividendEthAmount * (100-GRR)/100 );
        } else {
            /* 
            [ Peer redemption ]
            */
            cjpyOS.burnCJPY(msg.sender, totalRedeemedCjpyAmount);
            pool.sendETH(msg.sender, dividendEthAmount);
        }


        /*
            7. Gas compensation
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
            if(pledge.coll == 0){
                uint _debt;
                if(availablePart >= pledge.debt) {
                    _debt = pledge.debt;
                } else {
                    _debt = availablePart;
                }
                pool.useSweepReserve(_debt);
                cjpyOS.burnCJPY(address(pool), _debt);
                pledge.debt -= _debt;
                totalDebt -= _debt;
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


    /// @param _ICRpertenk IndividualCollateralRatio per 10k
    /// @dev Three linear fumula there are
    function FR(uint _ICRpertenk) public view returns (uint _FRpertenk) {
        require(_ICRpertenk >= 11000, "ICR too low to get fee data.");
        if(11000 <= _ICRpertenk && _ICRpertenk < 13000) {
            _FRpertenk = 2000 - (_ICRpertenk - 11000) * 80 /100;
        } else if (13000 <= _ICRpertenk && _ICRpertenk < 15000) {
            _FRpertenk = 400 - (_ICRpertenk - 13000) * 10 /100;
        } else if (15000 <= _ICRpertenk && _ICRpertenk < 20000) {
            _FRpertenk = 200 - (_ICRpertenk - 15000) * 2 /100;
        } else if (20000 <= _ICRpertenk && _ICRpertenk < 50000) {
            _FRpertenk = 100 - (_ICRpertenk - 20000) * 3 /10 /100;
        } else {
            _FRpertenk = 10;
        }
    }

}