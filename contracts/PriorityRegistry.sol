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
    function upsert(IYamato.Pledge memory _pledge) external returns (uint);
    function remove(IYamato.Pledge memory _pledge) external;
    function getRedeemable() external view returns (IYamato.Pledge memory);
    function getSweepable() external view returns (IYamato.Pledge memory);
}

contract PriorityRegistry is IPriorityRegistry {
    using SafeMath for uint256;
    using PledgeLib for IYamato.Pledge;

    mapping(uint=>IYamato.Pledge[]) sortedPledges; // ICR => [Pledge, Pledge, Pledge, ...]
    uint public pledgeLength = 0;
    address public yamato;

    constructor(address _yamato) {
        yamato = _yamato;
    }

    /*
        @dev The upsert process is  1. update coll/debt  2. upsert and return "upsert-time ICR"  3. update lastUpsertedTimeICRpertenk with the "upsert-time ICR"
        @return _newICRpertenk is for overwriting Yamato.sol's pledge info
    */
    function upsert(IYamato.Pledge memory _pledge) public onlyYamato override returns (uint _newICRpertenk) {
        require( !(_pledge.coll == 0 && _pledge.debt == 0 && _pledge.lastUpsertedTimeICRpertenk != 0) , "Upsert Error: The logless zero pledge cannot be upserted. It should be removed.");
        uint _oldICRpertenk = _pledge.lastUpsertedTimeICRpertenk;

        /* delete current pledge form sorted pledge */
        IYamato.Pledge[] storage pledgesInICR = sortedPledges[_oldICRpertenk];

        _deletePledge(pledgesInICR, _pledge);

        /* insert new pledge */
        _newICRpertenk = _pledge.getICR(IYamato(yamato).getFeed());

        _pledge.lastUpsertedTimeICRpertenk = _newICRpertenk;

        sortedPledges[_newICRpertenk].push(_pledge);
        pledgeLength = pledgeLength.add(1);
    }
    function remove(IYamato.Pledge memory _pledge) public onlyYamato override {
        require(_pledge.coll == 0, "Removal Error: coll has to be zero for removal.");
        require(_pledge.debt == 0, "Removal Error: coll has to be zero for removal.");
        require(_pledge.lastUpsertedTimeICRpertenk == 0, "Removal Error: coll has to be zero for removal.");
        uint _removableICRpertenk = 0;
        IYamato.Pledge[] storage removablePledges = sortedPledges[_removableICRpertenk];

        _deletePledge(removablePledges, _pledge);
    }
    modifier onlyYamato(){
        require(msg.sender == yamato, "You are not Yamato contract.");
        _;
    }

    function _deletePledge(IYamato.Pledge[] storage sPledges, IYamato.Pledge memory _pledge) internal {
        for(uint i = 0; i < sPledges.length; i++){
            IYamato.Pledge memory _scannedPledge = sPledges[i];
            if(_pledge.owner == _scannedPledge.owner) {
                delete sPledges[i];
                pledgeLength = pledgeLength.sub(1);
            }
        }
    }



    function getRedeemable() public view override returns (IYamato.Pledge memory) {
        // for(uint _ICRpertenk = 1; _ICRpertenk < 11000; _ICRpertenk++) {
        //     if(sortedPledges[_ICRpertenk].length > 0) {
        //         return sortedPledges[_ICRpertenk][0];
        //     }
        // }
    }
    function getSweepable() public view override returns (IYamato.Pledge memory) {
        // for(uint _ICRpertenk = 1; _ICRpertenk < 11000; _ICRpertenk++) {
        //     if(sortedPledges[_ICRpertenk].length > 0) {
        //         return sortedPledges[_ICRpertenk][0];
        //     }
        // }
    }


}