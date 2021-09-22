pragma solidity 0.7.6;
pragma abicoder v2;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
*/

//solhint-disable max-line-length
//solhint-disable no-inline-assembly
import "./Yamato.sol";
import "./Dependencies/PledgeLib.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "hardhat/console.sol";

interface IPriorityRegistry {
    function upsert(IYamato.Pledge memory _pledge) external;
    function remove(IYamato.Pledge memory _pledge) external;
    function getLowerstICRPledge() external view returns (IYamato.Pledge memory);
}

contract PriorityRegistry is IPriorityRegistry {
    using SafeMath for uint256;
    using PledgeLib for IYamato.Pledge;

    mapping(uint=>IYamato.Pledge[]) sortedPledges; // ICR => [Pledge, Pledge, Pledge, ...]
    uint public pledgeLength = 0;
    IYamato yamato;

    constructor(address _yamato) {
        yamato = IYamato(_yamato);
    }

    /*
        @dev The upsert process is  1. update coll/debt  2. upsert and return "upsert-time ICR"  3. update lastUpsertedTimeICRpertenk with the "upsert-time ICR"
    */
    function upsert(IYamato.Pledge memory myPledge) public onlyYamato override {

        uint _oldICRpertenk = myPledge.lastUpsertedTimeICRpertenk;

        /* delete current pledge form sorted pledge */
        IYamato.Pledge[] memory _arr = sortedPledges[_oldICRpertenk];

        for(uint i = 0; i < _arr.length; i++){
            IYamato.Pledge memory _p = _arr[i];
            if (_p.owner == myPledge.owner){
                delete sortedPledges[_oldICRpertenk][i];
                pledgeLength = pledgeLength.sub(1);
            }
        }

        /* insert new pledge */
        uint _newICRpertenk = myPledge.getICR(yamato.getFeed());

        myPledge.lastUpsertedTimeICRpertenk = _newICRpertenk;

        sortedPledges[_newICRpertenk].push(myPledge);
        pledgeLength = pledgeLength.add(1);
    }
    function remove(IYamato.Pledge memory _pledge) public onlyYamato override {
        // uint _ICRpertenk = _pledge.lastUpsertedTimeICRpertenk;
        // for(uint i = 0; i < sortedPledges[_ICRpertenk].length; i++){
        //     IYamato.Pledge _scannedPledge = sortedPledges[_ICRpertenk][i];
        //     if(_pledge.owner == _scannedPledge.owner) {
        //         delete sortedPledges[_ICRpertenk][i];
        //     }
        // }
        // pledgeLength = pledgeLength.sub(1);
    }
    modifier onlyYamato(){
        require(msg.sender == address(yamato), "You are not Yamato contract.");
        _;
    }



    function getLowerstICRPledge() public view override returns (IYamato.Pledge memory) {
        // for(uint _ICRpertenk = 1; _ICRpertenk < 11000; _ICRpertenk++) {
        //     if(sortedPledges[_ICRpertenk].length > 0) {
        //         return sortedPledges[_ICRpertenk][0];
        //     }
        // }
    }


}