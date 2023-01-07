pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly
import "./Yamato.sol";
import "./Interfaces/IPriceFeed.sol";
import "./Interfaces/IPriorityRegistry.sol";
import "./Dependencies/PledgeLib.sol";
import "./Dependencies/YamatoStore.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/LiquityMath.sol";
import "hardhat/console.sol";

// @dev For gas saving reason, we use percent denominated ICR only in this contract.
contract PriorityRegistryV2 is IPriorityRegistry, YamatoStore {
    using SafeMath for uint256;
    using PledgeLib for IYamato.Pledge;

    mapping(uint256 => mapping(address => IYamato.Pledge)) leveledPledges; // ICR => owner => Pledge
    mapping(uint256 => address[]) private levelIndice; // ICR => owner[]
    uint256 public override pledgeLength;
    uint256 public override LICR; // Note: Lowest ICR in percent

    function initialize(address _yamato) public initializer {
        __YamatoStore_init(_yamato);
    }

    /*
    ==============================
        Queue Managers
    ==============================
        - upsert
        - remove
    */

    /*
        @notice The upsert process is  1. update coll/debt in Yamato-side 2. floor the last ICR to make "level" 3. upsert and return the new "upsert-time ICR"  4. update padded-priority to the Yamato
        @dev It upserts "deposited", "borrowed", "repayed", "partially withdrawn", "redeemed", or "partially swept" pledges.
        @return _newICRpercent is for overwriting Yamato.sol's pledge info
    */
    function upsert(
        IYamato.Pledge memory _pledge
    ) public override onlyYamato returns (uint256) {
        uint256 _oldICRpercent = floor(_pledge.priority);
        require(
            !(_pledge.coll == 0 && _pledge.debt == 0 && _oldICRpercent != 0),
            "Upsert Error: The logless zero pledge cannot be upserted. It should be removed."
        );

        /*
            1. delete current pledge from sorted pledge and update LICR
        */
        if (
            !(_pledge.debt == 0 &&
                _oldICRpercent == 0) /* Exclude "new pledge" */ &&
            pledgeLength > 0 /* Avoid overflow */ &&
            leveledPledges[_oldICRpercent][_pledge.owner].isCreated
            /* whether delete target exists */
        ) {
            _deletePledge(_pledge);
        }

        /* 
            2. insert new pledge
        */
        uint256 _newICRpercent = floor(_pledge.getICR(priceFeed()));
        require(
            _newICRpercent <= floor(2 ** 256 - 1),
            "priority can't be that big."
        );

        _pledge.priority = _newICRpercent * 100;

        leveledPledges[_newICRpercent][_pledge.owner] = _pledge;
        levelIndice[_newICRpercent].push(_pledge.owner);
        pledgeLength = pledgeLength.add(1);

        /*
            3. Update LICR for new ICR data
        */
        if (
            (_newICRpercent > 0 && _newICRpercent < LICR) ||
            LICR == 0 ||
            pledgeLength == 1
        ) {
            LICR = _newICRpercent;
        }

        /*  
            2-2. Traverse from min(oldICR,newICR) to fill the loss of popRedeemable
        */
        // Note: All deletions could cause traverse.
        // Note: Traversing to the ICR=MAX_UINT256 pledges are validated, don't worry about gas.
        // Note: LICR is state variable and it will be undated here.
        uint256 _traverseStartICR;
        if (_oldICRpercent > 0 && _newICRpercent > 0) {
            _traverseStartICR = LiquityMath._min(
                _oldICRpercent,
                _newICRpercent
            );
        } else if (_oldICRpercent > 0) {
            _traverseStartICR = _oldICRpercent;
        } else if (_newICRpercent > 0) {
            _traverseStartICR = _newICRpercent;
        }

        if (_traverseStartICR > 0) _traverseToNextLICR(_traverseStartICR);

        return _newICRpercent * 100;
    }

    /*
        @dev It removes "just full swept" or "just full withdrawn" pledges.
    */
    function remove(IYamato.Pledge memory _pledge) public override onlyYamato {
        uint256 _oldICRpercent = floor(_pledge.priority);
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
            "Removal Error: debt has to be zero for removal."
        );

        // Note: In full withdrawal scenario, this value is MAX_UINT
        require(
            _oldICRpercent == 0 || _oldICRpercent == floor(2 ** 256 - 1),
            "Unintentional priority is given to the remove function."
        );

        _deletePledge(_pledge);
    }

    /*
    ==============================
        Mutable Getters
    ==============================
        - popRedeemable
        - popSweepable
    */

    /*
        @notice LICR-based lowest ICR pledge getter
        @dev Mutable read function. It pops.
        @return A pledge
    */
    function popRedeemable()
        public
        override
        onlyYamato
        returns (IYamato.Pledge memory)
    {
        require(
            pledgeLength > 0,
            "pledgeLength=0 :: Need to upsert at least once."
        );
        require(LICR > 0, "licr=0 :: Need to upsert at least once.");
        require(
            levelIndice[LICR].length > 0,
            "The current lowest ICR data is inconsistent with actual sorted pledges."
        );

        address _addr;
        // Note: Not (Exist AND coll>0) then skip.
        while (
            !leveledPledges[LICR][_addr].isCreated ||
            leveledPledges[LICR][_addr].coll == 0
        ) {
            _addr = levelIndice[LICR][levelIndice[LICR].length - 1];

            levelIndice[LICR].pop();
            // Note: pop() just deletes the item.
            // Note: Why pop()? Because it's the only way to decrease length.
            // Note: Hence the array won't be inflated.
            // Note: But pop() doesn't have return. Do it on your own.
        }
        IYamato.Pledge memory poppedPledge = leveledPledges[LICR][_addr];

        // Note: Don't check LICR, real ICR is the matter.
        require(
            floor(poppedPledge.getICR(priceFeed())) <
                uint256(IYamato(yamato()).MCR()),
            "You can't redeem if redeemable candidate is more than MCR."
        );

        // Note: pop is deletion. So traverse could be needed.
        // Note: Traversing to the ICR=MAX_UINT256 pledges are validated, don't worry about gas.
        // Note: LICR is state variable and it will be undated here.

        return poppedPledge;
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
        uint256 icr = floor(_pledge.priority);
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
        uint256 _mcr = uint256(IYamato(yamato()).MCR());
        bool infLoopish = pledgeLength ==
            levelIndice[0].length + levelIndice[floor(2 ** 256 - 1)].length;
        // Note: The _oldICRpercent == LICR now, and that former LICR-level has just been nullified. New licr is needed.

        if (
            levelIndice[_icr].length ==
            0 /* Confirm the level is nullified */ &&
            _icr == LICR /* Confirm the deleted ICR is lowest  */ &&
            pledgeLength > 1 /* Not to scan infinitely */ &&
            LICR != 0 /* If 1st take, leave it to the logic in the bottom */
        ) {
            if (infLoopish) {
                // Note: Okie you avoided inf loop but make sure you don't redeem ICR=MCR pledge
                LICR = _mcr - 1;
            } else {
                // TODO: Out-of-gas fail safe
                uint256 _next = _icr;
                while (
                    levelIndice[_next].length == 0 /* this level is empty! */
                ) {
                    _next++;
                } // Note: if exist or out-of-range, stop it and set that level as the LICR
                LICR = _next;
            }
        }
    }

    /*
    ==============================
        Getters
    ==============================
        - nextRedeemable
        - nextSweepable
        - getLevelIndice
        - getRedeemablesCap
        - getSweepablesCap
    */
    function nextRedeemable()
        public
        view
        override
        returns (IYamato.Pledge memory)
    {
        if (levelIndice[LICR].length == 0) {
            return IYamato.Pledge(0, 0, false, address(0), 0);
        }

        address _poppedAddr = levelIndice[LICR][levelIndice[LICR].length - 1];
        return leveledPledges[LICR][_poppedAddr];
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

    function getLevelIndice(
        uint256 icr,
        uint256 i
    ) public view override returns (address) {
        uint256 _mcr = uint256(IYamato(yamato()).MCR());
        if (icr == _mcr && icr == LICR && levelIndice[icr].length == 0) {
            return address(0);
        }
        return levelIndice[icr][i];
    }

    function getRedeemablesCap() external view returns (uint256 _cap) {
        for (uint256 i = 1; i < uint256(IYamato(yamato()).MCR()); i++) {
            for (uint256 j = 0; j < levelIndice[i].length; j++) {
                _cap +=
                    (leveledPledges[i][levelIndice[i][j]].coll *
                        IPriceFeed(priceFeed()).lastGoodPrice()) /
                    1e18;
            }
        }
    }

    function getSweepablesCap() external view returns (uint256 _cap) {
        for (uint256 j = 0; j < levelIndice[0].length; j++) {
            _cap += leveledPledges[0][levelIndice[0][j]].debt;
        }
    }

    function floor(uint256 _ICRpertenk) internal returns (uint256) {
        return _ICRpertenk / 100;
    }
}
