pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly
import "./Yamato.sol";
import "./Dependencies/PledgeLib.sol";
import "./Dependencies/SafeMath.sol";
import "hardhat/console.sol";

interface IPriorityRegistry {
    function upsert(IYamato.Pledge memory _pledge) external returns (uint256);

    function remove(IYamato.Pledge memory _pledge) external;

    function popRedeemable() external returns (IYamato.Pledge memory);

    function popSweepable() external returns (IYamato.Pledge memory);

    function currentLICRpertenk() external view returns (uint256);

    function pledgeLength() external view returns (uint256);

    function getLevelIndice(uint256 _icr, uint256 _i)
        external
        view
        returns (address);

    function nextRedeemable() external view returns (IYamato.Pledge memory);

    function nextSweepable() external view returns (IYamato.Pledge memory);
}

contract PriorityRegistry is IPriorityRegistry {
    using SafeMath for uint256;
    using PledgeLib for IYamato.Pledge;

    mapping(uint256 => mapping(address => IYamato.Pledge)) leveledPledges; // ICR => owner => Pledge
    mapping(uint256 => address[]) private levelIndice; // ICR => owner[]
    uint256 public override pledgeLength = 0;
    uint256 public override currentLICRpertenk = 0; // Note: Lowest ICR
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
    function upsert(IYamato.Pledge memory _pledge)
        public
        override
        onlyYamato
        returns (uint256 _newICRpertenk)
    {
        require(
            !(_pledge.coll == 0 &&
                _pledge.debt == 0 &&
                _pledge.lastUpsertedTimeICRpertenk != 0),
            "Upsert Error: The logless zero pledge cannot be upserted. It should be removed."
        );
        require(
            !(_pledge.coll > 0 &&
                _pledge.debt > 0 &&
                _pledge.lastUpsertedTimeICRpertenk == 0),
            "Upsert Error: Such a pledge can't exist!"
        );
        uint256 _oldICRpertenk = _pledge.lastUpsertedTimeICRpertenk;

        /*
            1. delete current pledge from sorted pledge and update currentLICRpertenk
        */
        if (
            !(_pledge.debt == 0 && _oldICRpertenk == 0) && /* Exclude "new pledge" */
            pledgeLength > 0 && /* Avoid overflow */
            leveledPledges[_oldICRpertenk][_pledge.owner].isCreated
            /* whether delete target exists */
        ) {
            if (_oldICRpertenk == 2**256 - 1)
                console.log("fresh-borrow deleting");
            _deletePledge(_pledge);
        }

        _traverseToNextLICR(_oldICRpertenk);

        /* 
            2. insert new pledge
        */
        _newICRpertenk = _pledge.getICR(IYamato(yamato).feed());

        _pledge.lastUpsertedTimeICRpertenk = _newICRpertenk;

        leveledPledges[_newICRpertenk][_pledge.owner] = _pledge;
        levelIndice[_newICRpertenk].push(_pledge.owner);
        pledgeLength = pledgeLength.add(1);

        /*
            3. Update currentLICRpertenk
        */
        if (
            (_newICRpertenk > 0 && _newICRpertenk < currentLICRpertenk) ||
            currentLICRpertenk == 0 ||
            pledgeLength == 1
        ) {
            currentLICRpertenk = _newICRpertenk;
        }
    }

    /*
        @dev It removes "just full swept" or "just full withdrawn" pledges.
    */
    function remove(IYamato.Pledge memory _pledge) public override onlyYamato {
        /*
            1. Delete a valid pledge
        */
        // Note: The original (in-Yamato.sol) pledge has to be zero
        require(
            _pledge.coll == 0,
            "Removal Error: coll has to be zero for removal."
        );
        require(
            _pledge.debt == 0,
            "Removal Error: coll has to be zero for removal."
        );

        // Note: In full withdrawal scenario, this value is MAX_UINT
        require(
            _pledge.lastUpsertedTimeICRpertenk == 0 ||
                _pledge.lastUpsertedTimeICRpertenk == 2**256 - 1,
            "Unintentional lastUpsertedTimeICRpertenk is given to the remove function."
        );

        _deletePledge(_pledge);
    }

    modifier onlyYamato() {
        require(msg.sender == yamato, "You are not Yamato contract.");
        _;
    }

    /*
    ==============================
        Mutable Getters
    ==============================
        - popRedeemable
        - popSweepable
    */

    /*
        @notice currentLICRpertenk-based lowest ICR pledge getter
        @dev Mutable read function. It pops.
        @return A pledge
    */
    function popRedeemable()
        public
        override
        onlyYamato
        returns (IYamato.Pledge memory)
    {
        uint256 licr = currentLICRpertenk;
        require(
            pledgeLength > 0,
            "pledgeLength=0 :: Need to upsert at least once."
        );
        require(licr > 0, "licr=0 :: Need to upsert at least once.");
        require(
            levelIndice[licr].length > 0,
            "The current lowest ICR data is inconsistent with actual sorted pledges."
        );

        address _addr;
        // Note: Not (Exist AND coll>0) then skip.
        while (
            !leveledPledges[licr][_addr].isCreated ||
            leveledPledges[licr][_addr].coll == 0
        ) {
            _addr = levelIndice[licr][levelIndice[licr].length - 1];

            levelIndice[licr].pop();
            // Note: pop() just deletes the item.
            // Note: Why pop()? Because it's the only way to decrease length.
            // Note: Hence the array won't be inflated.
            // Note: But pop() doesn't have return. Do it on your own.
        }

        // Note: Don't check LICR, real ICR is the matter.
        require(
            leveledPledges[licr][_addr].getICR(IYamato(yamato).feed()) <
                uint256(IYamato(yamato).MCR()).mul(100),
            "You can't redeem if redeemable candidate is more than MCR."
        );

        // Note: popped array and pledge must be deleted
        // Note: Traversing to the ICR=MAX_UINT256-ish pledges are validated, don't worry.
        _traverseToNextLICR(
            leveledPledges[licr][_addr].lastUpsertedTimeICRpertenk
        );

        return leveledPledges[licr][_addr];
    }

    /*
        @notice zero ICR pledge getter
        @return A pledge
    */
    function popSweepable()
        public
        override
        onlyYamato
        returns (IYamato.Pledge memory)
    {
        if (levelIndice[0].length > 0) {
            address _addr;

            // Note: Not (Exist AND debt>0) then skip
            while (
                !leveledPledges[0][_addr].isCreated ||
                leveledPledges[0][_addr].debt == 0
            ) {
                _addr = levelIndice[0][levelIndice[0].length - 1];
                levelIndice[0].pop();
                // Note: pop() just deletes the item.
                // Note: Why pop()? Because it's the only way to decrease length.
                // Note: Hence the array won't be inflated.
                // Note: But pop() doesn't have return. Do it on your own.
            }
            return leveledPledges[0][_addr];
        } else {
            revert("There're no sweepable pledges.");
        }
    }

    /*
    ==============================
        Internal Function
    ==============================
        - _deletePledge
        - _traverseToNextLICR
    */

    /*
        @dev delete of "address[] storage" causes gap in the list.
             For reasonably gas-saved delete, you must swap target with tail then delete it.
        @param _pledge the delete target
    */
    function _deletePledge(IYamato.Pledge memory _pledge) internal {
        uint256 icr = _pledge.lastUpsertedTimeICRpertenk;
        address _owner = _pledge.owner;

        if (leveledPledges[icr][_owner].isCreated) {
            // Note: upsert() requires to maintain the consistency of index
            for (uint256 i = 0; i < levelIndice[icr].length; i++) {
                if (levelIndice[icr][i] == _owner) {
                    levelIndice[icr][i] = levelIndice[icr][
                        levelIndice[icr].length - 1
                    ];
                    levelIndice[icr].pop();
                    break;
                }
            }

            // Note: Delete of pledge is damn simple
            delete leveledPledges[icr][_owner];
            pledgeLength -= 1;
        } else {
            revert("The delete target is not exist.");
        }
    }

    function _traverseToNextLICR(uint256 _icr) internal {
        uint256 _mcr = uint256(IYamato(yamato).MCR()).mul(100);
        // Note: The _oldICRpertenk == currentLICRpertenk now, and that former LICR-level has just been nullified. New licr is needed.

        console.log("---------");
        console.log("_icr: %s", _icr);
        console.log("currentLICRpertenk: %s", currentLICRpertenk);
        console.log("pledgeLength: %s", pledgeLength);
        console.log("levelIndice[0].length: %s", levelIndice[0].length);
        console.log("levelIndice[_icr].length: %s", levelIndice[_icr].length);
        console.log(
            "levelIndice[2**256 - 1].length: %s",
            levelIndice[2**256 - 1].length
        );
        console.log(
            levelIndice[_icr].length == 0 && /* Confirm the level is nullified */
                _icr == currentLICRpertenk && /* Confirm the deleted ICR is lowest  */
                currentLICRpertenk < _mcr &&
                pledgeLength > 1 && /* Not to scan infinitely */
                currentLICRpertenk != 0 && /* If 1st take, leave it to the logic in the bottom */
                pledgeLength - levelIndice[0].length >
                levelIndice[2**256 - 1].length
        );
        if (
            levelIndice[_icr].length == 0 && /* Confirm the level is nullified */
            _icr == currentLICRpertenk && /* Confirm the deleted ICR is lowest  */
            currentLICRpertenk < _mcr &&
            pledgeLength > 1 && /* Not to scan infinitely */
            currentLICRpertenk != 0 && /* If 1st take, leave it to the logic in the bottom */
            pledgeLength - levelIndice[0].length >
            levelIndice[2**256 - 1].length /* if new pledges only there are, don't traverse the list! */
        ) {
            uint256 _next = _icr + 1;
            while (
                levelIndice[_next].length == 0 && /* this level is empty! */
                _next < _mcr /* this level is redeemable! */
            ) {
                _next++;
            } // Note: if exist or out-of-range, stop it and set that level as the LICR
            currentLICRpertenk = _next;
        }
    }

    /*
    ==============================
        Getters
    ==============================
        - nextRedeemable
        - nextSweepable
    */
    function nextRedeemable()
        public
        view
        override
        returns (IYamato.Pledge memory)
    {
        if (levelIndice[currentLICRpertenk].length == 0) {
            return IYamato.Pledge(0, 0, false, address(0), 0);
        }

        address _poppedAddr = levelIndice[currentLICRpertenk][
            levelIndice[currentLICRpertenk].length - 1
        ];
        return leveledPledges[currentLICRpertenk][_poppedAddr];
    }

    function nextSweepable()
        public
        view
        override
        returns (IYamato.Pledge memory)
    {
        if (levelIndice[0].length == 0) {
            return IYamato.Pledge(0, 0, false, address(0), 0);
        }
        address _poppedAddr = levelIndice[0][levelIndice[0].length - 1];
        return leveledPledges[0][_poppedAddr];
    }

    function getLevelIndice(uint256 icr, uint256 i)
        public
        view
        override
        returns (address)
    {
        uint256 _mcr = uint256(IYamato(yamato).MCR()).mul(100);
        if (
            icr == _mcr &&
            icr == currentLICRpertenk &&
            levelIndice[icr].length == 0
        ) {
            return address(0);
        }
        return levelIndice[icr][i];
    }
}
