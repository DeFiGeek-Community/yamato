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
    uint public currentLICRpertenk = 0; // Note: Lowest ICR
    address public yamato;

    constructor(address _yamato) {
        yamato = _yamato;
    }



    /*
    ==============================
        Queue Managers
    ==============================
        - upsert
        - remove
    */

    /*
        @notice The upsert process is  1. update coll/debt  2. upsert and return "upsert-time ICR"  3. update lastUpsertedTimeICRpertenk with the "upsert-time ICR"
        @dev It upserts "deposited", "borrowed", "repayed", "partially withdrawn", "redeemed", or "partially swept" pledges.
        @return _newICRpertenk is for overwriting Yamato.sol's pledge info
    */
    function upsert(IYamato.Pledge memory _pledge) public onlyYamato override returns (uint _newICRpertenk) {
        require( !(_pledge.coll == 0 && _pledge.debt == 0 && _pledge.lastUpsertedTimeICRpertenk != 0) , "Upsert Error: The logless zero pledge cannot be upserted. It should be removed.");
        uint _oldICRpertenk = _pledge.lastUpsertedTimeICRpertenk;

        /*
            1. delete current pledge from sorted pledge and update currentLICRpertenk
        */
        IYamato.Pledge[] storage pledgesInICR = sortedPledges[_oldICRpertenk];
        if(pledgesInICR.length > 0) {
            _deletePledge(pledgesInICR, _pledge);
        }

        // Note: The _oldICRpertenk is currentLICRpertenk and that ICR-column has just nullified now.
        if (currentLICRpertenk != 0
            && _oldICRpertenk == currentLICRpertenk
            && pledgesInICR.length == 0) {
            uint i = _oldICRpertenk + 1;
            while(sortedPledges[i].length > 0) { i++; }
            currentLICRpertenk = i;
        }


        /* 
            2. insert new pledge
        */
        _newICRpertenk = _pledge.getICR(IYamato(yamato).getFeed());

        _pledge.lastUpsertedTimeICRpertenk = _newICRpertenk;

        sortedPledges[_newICRpertenk].push(_pledge);
        pledgeLength = pledgeLength.add(1);

        /*
            3. Update currentLICRpertenk
        */
        if (
            (_newICRpertenk > 0 && _newICRpertenk < currentLICRpertenk)
            ||
            currentLICRpertenk == 0
        ) {
            currentLICRpertenk = _newICRpertenk;
        }
    }

    /*
        @dev It removes "just full swept" or "just full withdrawn" pledges.
    */
    function remove(IYamato.Pledge memory _pledge) public onlyYamato override {

        /*
            1. Delete a valid pledge
        */
        // Note: The original (in-Yamato.sol) pledge has to be zero
        require(_pledge.coll == 0, "Removal Error: coll has to be zero for removal.");
        require(_pledge.debt == 0, "Removal Error: coll has to be zero for removal.");

        // Note: In full withdrawal scenario, this value is MAX_UINT
        require(_pledge.lastUpsertedTimeICRpertenk == 0 || _pledge.lastUpsertedTimeICRpertenk == 2**256 - 1, "Unintentional lastUpsertedTimeICRpertenk is given to the remove function.");

        uint _removableICRpertenk = _pledge.lastUpsertedTimeICRpertenk;

        IYamato.Pledge[] storage removablePledges = sortedPledges[_removableICRpertenk];

        _deletePledge(removablePledges, _pledge);
    }

    modifier onlyYamato(){
        require(msg.sender == yamato, "You are not Yamato contract.");
        _;
    }


    /*
    ==============================
        Getters
    ==============================
        - getRedeemable
        - getSweepable
    */

    /*
        @notice currentLICRpertenk-based lowest ICR pledge getter
        @return A pledge
    */
    function getRedeemable() public view override returns (IYamato.Pledge memory) {
        require(currentLICRpertenk > 0, "");
        IYamato.Pledge[] storage pledgesLICR = sortedPledges[currentLICRpertenk];
        if (pledgesLICR.length > 0) {
            return pledgesLICR[0];
        } else {
            revert("The current lowest ICR data is inconsistent with actual sorted pledges.");            
        }
    }

    /*
        @notice zero ICR pledge getter
        @return A pledge
    */
    function getSweepable() public view override returns (IYamato.Pledge memory) {
        IYamato.Pledge[] storage sweepablePledges = sortedPledges[0];
        if (sweepablePledges.length > 0) {
            return sweepablePledges[0];
        } else {
            // TODO: Write regression tests for this flow
            revert("There're no sweepable pledges.");            
        }
    }



    /*
    ==============================
        Internal Function
    ==============================
        - _deletePledge
    */

    function _deletePledge(IYamato.Pledge[] storage sPledges, IYamato.Pledge memory _pledge) internal {
        for(uint i = 0; i < sPledges.length; i++){
            IYamato.Pledge memory _scannedPledge = sPledges[i];
            if(_pledge.owner == _scannedPledge.owner) {
                delete sPledges[i];
                pledgeLength = pledgeLength.sub(1);
            }
        }
    }

}