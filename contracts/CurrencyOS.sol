pragma solidity 0.7.6;
pragma abicoder v2;
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
import "./PriceFeed.sol";
import "./Yamato.sol";
import "hardhat/console.sol";

interface ICurrencyOS {
    function mintCJPY(address to, uint amount) external;
    function burnCJPY(address to, uint amount) external;
    function feed() external view returns (address);
}

contract CurrencyOS is ICurrencyOS {
    struct YamatoConf {
        address yamatoAddr;
        uint rewardAllocation;
        bool isL2;
        bool isFilled;
    }

    IERC20MintableBurnable public currency;
    IERC20MintableBurnable public YMT;
    IERC20MintableBurnable public veYMT;
    address public override feed;
    address public governance;
    mapping(address=>YamatoConf) public yamatoes;
    address[] public yamatoIndice;
    constructor(address currencyAddr, address ymtAddr, address veYmtAddr, address feedAddr){
        currency = IERC20MintableBurnable(currencyAddr);
        YMT = IERC20MintableBurnable(ymtAddr);
        veYMT = IERC20MintableBurnable(veYmtAddr);
        feed = feedAddr;
        governance = msg.sender;
    }
    function addYamato(YamatoConf memory _conf) public onlyGovernance {
        yamatoIndice.push(_conf.yamatoAddr);
        yamatoes[_conf.yamatoAddr] = _conf;
    }
    modifier onlyGovernance(){
        require(msg.sender == governance, "You are not the governer.");
        _;
    }



    modifier onlyYamato(){
        require(yamatoes[msg.sender].isFilled, "Caller is not Yamato");
        _;
    }

    function mintCJPY(address to, uint amount) public onlyYamato override {
        currency.mint(to, amount);
    }
    function burnCJPY(address to, uint amount) public onlyYamato override {
        currency.burnFrom(to, amount);
    }

}