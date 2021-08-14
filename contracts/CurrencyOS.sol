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

import "./IERC20MintableBurnable.sol";
import "./IFeed.sol";

contract CurrencyOS {
    IERC20MintableBurnable CJPY;
    IERC20MintableBurnable YMT;
    IERC20MintableBurnable veYMT;
    IFeed feed;
    address public governance;
    mapping(address=>bool) public yamatoes;
    constructor(address cjpyAddr, address ymtAddr, address veYmtAddr, address feedAddr){
        CJPY = IERC20MintableBurnable(cjpyAddr);
        YMT = IERC20MintableBurnable(ymtAddr);
        veYMT = IERC20MintableBurnable(veYmtAddr);
        feed = IFeed(feedAddr);
        governance = msg.sender;
    }
    function addYamato(address _yamato) public onlyGovernance {
        yamatoes[_yamato] = true;
    }
    modifier onlyGovernance(){
        require(msg.sender == governance, "You are not the governer.");
        _;
    }



    modifier onlyYamato(){
        require(yamatoes[msg.sender], "Caller is not Yamato");
        _;
    }

}