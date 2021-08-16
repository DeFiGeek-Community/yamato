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

interface ICurrencyOS {
    function mintCJPY(address to, uint amount) external;
    function burnCJPY(address to, uint amount) external;
}

contract CurrencyOS is ICurrencyOS {
    IERC20MintableBurnable currency;
    IERC20MintableBurnable YMT;
    IERC20MintableBurnable veYMT;
    IFeed feed;
    address public governance;
    mapping(address=>bool) public yamatoes;
    constructor(address currencyAddr, address ymtAddr, address veYmtAddr, address feedAddr){
        currency = IERC20MintableBurnable(currencyAddr);
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

    function mintCJPY(address to, uint amount) public onlyYamato override {
        currency.mint(to, amount);
    }
    function burnCJPY(address to, uint amount) public onlyYamato override {
        currency.burnFrom(to, amount);
    }

}