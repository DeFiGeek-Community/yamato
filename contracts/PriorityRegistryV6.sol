pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly
import "./Yamato.sol";
import "./Interfaces/IYamatoV3.sol";
import "./Interfaces/IPriceFeed.sol";
import "./Interfaces/IPriorityRegistryV6.sol";
import "./Dependencies/PledgeLib.sol";
import "./Dependencies/YamatoStore.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/LiquityMath.sol";
import "hardhat/console.sol";

// @dev For gas saving reason, we use percent denominated ICR only in this contract.
contract PriorityRegistryV6 is IPriorityRegistryV6, YamatoStore {
    using SafeMath for uint256;
    using PledgeLib for IYamato.Pledge;

    mapping(uint256 => mapping(address => IYamato.Pledge)) leveledPledges; // ICR => owner => Pledge
    mapping(uint256 => address[]) private levelIndice; // ICR => owner[]
    uint256 public override pledgeLength; // Note: Deprecated in V6
    uint256 public override LICR; // Note: Lowest ICR in percent
    mapping(uint256 => FifoQueue) rankedQueue;
    uint256 public constant override MAX_PRIORITY =
        1157920892373161954235709850086879078532699846656405640394575840079131296399; // (2**256 - 1) / 100
    uint256 public nextResetRank;
    mapping(address => DeleteDictItem) deleteDict;

    function initialize(address _yamato) public initializer {
        __YamatoStore_init(_yamato);
    }

    /*
    ==============================
        Queue Managers
    ==============================
        - upsert
        - bulkUpsert
        - remove
    */

    /*
        @notice The upsert process is  1. update coll/debt in Yamato-side 2. floor the last ICR to make "level" 3. upsert and return the new "upsert-time ICR"  4. update padded-priority to the Yamato
        @dev It upserts "deposited", "borrowed", "repayed", "partially withdrawn", "redeemed", or "partially swept" pledges.
        @return _newICRpercent is for overwriting Yamato.sol's pledge info
    */
    function upsert(IYamato.Pledge memory _pledge)
        public
        override
        onlyYamato
        returns (uint256)
    {
        IYamato.Pledge[] memory _pledges = new IYamato.Pledge[](1);
        _pledges[0] = _pledge;
        uint256[] memory priorities = bulkUpsert(_pledges);
        return priorities[0];
    }

    /*
        @notice upsert for several pledges without LICR update and traverse
        @return new ICRs in percent
    */
    function bulkUpsert(IYamato.Pledge[] memory _pledges)
        public
        override
        onlyYamato
        returns (uint256[] memory)
    {
        uint256 _ethPriceInCurrency = IPriceFeed(feed()).lastGoodPrice();
        uint256[] memory _newPriorities = new uint256[](_pledges.length);
        for (uint256 i; i < _pledges.length; i++) {
            IYamato.Pledge memory _pledge = _pledges[i];
            if (_pledge.isCreated == false) {
                continue;
            }

            uint256 _oldICRpercent = floor(_pledge.priority);

            require(
                !(_pledge.coll == 0 &&
                    _pledge.debt == 0 &&
                    _oldICRpercent != 0),
                "Upsert Error: The logless zero pledge cannot be upserted. It should be removed."
            );

            /*
                1. delete current pledge from sorted pledge and update LICR
            */
            if (
                !(_pledge.debt == 0 && _oldICRpercent == 0) /* Exclude "new pledge" */
            ) {
                _deletePledge(_pledge);
            }

            /* 
                2. insert new pledge
            */

            uint256 _newICRPertenk = _pledge.getICRWithPrice(
                _ethPriceInCurrency
            );
            uint256 _newICRpercent = floor(_newICRPertenk);

            require(
                _newICRpercent <= MAX_PRIORITY,
                "priority can't be that big."
            );

            _pledge.priority = _newICRPertenk;

            rankedQueuePush(_newICRpercent, _pledge.owner);

            _newPriorities[i] = _newICRPertenk;
        }

        /*
            LICR update or traverse
        */
        // Note: All deletions could cause traverse.
        // Note: Traversing to the ICR=MAX_UINT256 pledges are checked, don't worry about gas cost explosion.
        /*
            LICR determination algo for bulkUpsert
                - The first pledge is ICR-lowest pledge
                - Check the len of the rank
                - If empty, start traversing from that rank.
        */
        uint256 _licrCandidate = _detectLowestICR(
            _pledges[_pledges.length - 1].getICRWithPrice(_ethPriceInCurrency),
            floor(_pledges[_pledges.length - 1].priority),
            LICR
        );
        if (_licrCandidate < LICR || LICR == 0) {
            if (_licrCandidate > 0) {
                if (rankedQueueLen(_licrCandidate) > 0) {
                    LICR = _licrCandidate;
                } else {
                    _traverseToNextLICR(_licrCandidate);
                }
            } else {
                _traverseToNextLICR(1); /* If _licrCandidate=0 (just after full-redemption) and current LICR will be obsoleted. Then search next. */
            }
        }

        return _newPriorities;
    }

    function _detectLowestICR(
        uint256 _newICRpercent,
        uint256 _oldICRpercent,
        uint256 _licr
    ) internal pure returns (uint256 _newLowestICR) {
        if (_oldICRpercent > 0 && _newICRpercent > 0) {
            _newLowestICR = LiquityMath._min(_oldICRpercent, _newICRpercent);
        } else if (_oldICRpercent > 0) {
            _newLowestICR = _oldICRpercent;
        } else if (_newICRpercent > 0) {
            _newLowestICR = _newICRpercent;
        }
        if (_licr > 0) {
            _newLowestICR = LiquityMath._min(_newLowestICR, _licr);
        }
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
            _oldICRpercent == 0 || _oldICRpercent == MAX_PRIORITY,
            "Unintentional priority is given to the remove function."
        );

        _deletePledge(_pledge);

        /*
            Reset deleteDict to make pledge fresh.
        */
        DeleteDictItem memory _d;
        deleteDict[_pledge.owner] = _d;
    }

    /*
    ==============================
        Mutable Getters
    ==============================
        - popSweepable
    */

    /*
        @notice zero ICR pledge getter
        @dev It doesn't change pledgeLength until remove runs.
        @return A pledge
    */
    function popSweepable()
        public
        override
        onlyYamato
        returns (address _poppedPledgeAddr)
    {
        require(rankedQueueLen(0) > 0, "Pop must not be done for empty queue");
        _poppedPledgeAddr = rankedQueuePop(0);
    }

    /*
    ==============================
        Fifo Managers (public, because of testability)
    ==============================
        - rankedQueuePush
        - rankedQueuePop
        - rankedQueueSearchAndDestroy
        - rankedQueueLen
        - rankedQueueTotalLen
    */
    function rankedQueuePush(uint256 _icr, address _pledgeAddr)
        public
        override
        onlyYamato
    {
        address[] storage pledgeAddrs = rankedQueue[_icr].pledges;
        deleteDict[_pledgeAddr] = DeleteDictItem(
            true,
            uint248(pledgeAddrs.length)
        );
        pledgeAddrs.push(_pledgeAddr);
    }

    function rankedQueuePop(uint256 _icr)
        public
        override
        onlyYamato
        returns (address _pledgeAddr)
    {
        FifoQueue storage fifoQueue = rankedQueue[_icr];
        uint256 _nextout = fifoQueue.nextout;
        uint256 _nextin = rankedQueueTotalLen(_icr);

        if (_nextout < _nextin) {
            _pledgeAddr = fifoQueue.pledges[_nextout]; // Note: It enables early finish and can save gas

            if (_pledgeAddr == address(0)) {
                while (
                    _nextout < _nextin - 1 && /* len - 1 is the upper bound */
                    _pledgeAddr == address(0)
                ) {
                    _nextout++;
                    _pledgeAddr = fifoQueue.pledges[_nextout];
                }
            }

            delete fifoQueue.pledges[_nextout];
            fifoQueue.nextout = _nextout + 1;
        }

    }

    function rankedQueueSearchAndDestroy(uint256 _icr, uint256 _i)
        public
        override
        onlyYamato
    {
        delete rankedQueue[_icr].pledges[_i];
    }

    function rankedQueueLen(uint256 _icr)
        public
        view
        override
        returns (uint256 count)
    {
        FifoQueue storage fifoQueue = rankedQueue[_icr];
        for (
            uint256 i = fifoQueue.nextout;
            i < rankedQueueTotalLen(_icr);
            i++
        ) {
            if (fifoQueue.pledges[i] != address(0)) {
                count++;
            }
        }
    }

    function rankedQueueTotalLen(uint256 _icr)
        public
        view
        override
        returns (uint256)
    {
        return rankedQueue[_icr].pledges.length;
    }

    function rankedQueueNextout(uint256 _icr)
        public
        view
        override
        returns (uint256)
    {
        return rankedQueue[_icr].nextout;
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
             deleteDict knows which pledge is in which index.
        @param _pledge the delete target
    */
    function _deletePledge(IYamato.Pledge memory _pledge) internal {
        uint256 _icr = floor(_pledge.priority);
        DeleteDictItem memory _item = deleteDict[_pledge.owner];
        if (
            _item.isCreated /* To distinguish isCreated=true and index=0 */
        ) {
            rankedQueueSearchAndDestroy(_icr, uint256(_item.index));
        }
    }

    function _traverseToNextLICR(uint256 _icr) internal {
        uint256 _mcrPercent = uint256(IYamato(yamato()).MCR());
        uint256 _checkpoint = _mcrPercent +
            IYamatoV3(yamato()).CHECKPOINT_BUFFER(); // 185*0.7=130 ... It's possible to be "priority=184 but deficit" with 30% dump, but "priority=20000 but deficit" is impossible.
        uint256 _next = _icr;
        while (true) {
            if (rankedQueueLen(_next) != 0) {
                if (LICR == _mcrPercent && _icr == _mcrPercent) {
                    _next++; // skip just-to-MCR redemption
                } else {
                    LICR = _next; // the first filled rankedQueue
                }
                break;
            } else if (_next >= _checkpoint) {
                LICR = _checkpoint - 1; // default LICR
                break;
            } else {
                _next++;
            }
        }
    }

    /*
    ==============================
        Getters
    ==============================
        - getRankedQueue
        - getRedeemablesCap
        - getSweepablesCap
    */
    function getRankedQueue(uint256 _icr, uint256 i)
        public
        view
        override
        returns (address)
    {
        if (i < rankedQueueTotalLen(_icr)) {
            return rankedQueue[_icr].pledges[i];
        }
    }

    function getRedeemablesCap() external view returns (uint256 _cap) {
        uint256 _mcrPercent = uint256(IYamato(yamato()).MCR());
        uint256 _checkpoint = _mcrPercent +
            IYamatoV3(yamato()).CHECKPOINT_BUFFER();
        uint256 ethPriceInCurrency = IPriceFeed(feed()).lastGoodPrice();

        uint256 _rank = 1;
        uint256 _nextout = rankedQueueNextout(_rank);
        address _pledgeAddr = getRankedQueue(_rank, _nextout);
        IYamato.Pledge memory _pledge = IYamato(yamato()).getPledge(
            _pledgeAddr
        );
        uint256 _icr = _pledge.getICRWithPrice(ethPriceInCurrency);
        while (true) {
            if (
                _icr > _mcrPercent * 100 || _rank >= _checkpoint
            ) {
                return _cap; // end
            } else {
                if (
                    rankedQueueLen(_rank) > 0 &&
                    (_nextout < rankedQueueTotalLen(_rank)) /* in range */
                ) {
                    if (
                        _pledge.isCreated /* to skip gap */
                    ) {
                        // icr check and cap addition
                        _cap += _pledge.toBeRedeemed(
                            _mcrPercent * 100,
                            _icr,
                            ethPriceInCurrency
                        );
                    }
                    _nextout++; // to next index
                } else {
                    _rank++; // to next rank
                    _nextout = rankedQueueNextout(_rank); // default index
                }
            }
            _pledgeAddr = getRankedQueue(_rank, _nextout);
            _pledge = IYamato(yamato()).getPledge(_pledgeAddr);

            _icr = _pledge.getICRWithPrice(ethPriceInCurrency);
        }
    }

    function getSweepablesCap() external view returns (uint256 _cap) {
        IYamato.Pledge memory _pledge;
        address _pledgeAddr;
        uint256 _nextout = rankedQueue[0].nextout;
        uint256 _nextin = rankedQueueTotalLen(0);
        while (_nextout <= _nextin) {
            _pledgeAddr = getRankedQueue(0, _nextout);
            if (_pledgeAddr != address(0)) {
                _pledge = IYamato(yamato()).getPledge(_pledgeAddr);
                _cap += _pledge.debt;
            }
            _nextout++;
        }
    }

    function floor(uint256 _ICRpertenk) internal pure returns (uint256) {
        return _ICRpertenk / 100;
    }

    /*
        ====================
            Upgrade Helpers
        ====================
        - resetQueue
        - syncRankedQueue
    */
    function resetQueue(uint256 _defaultRank) public onlyGovernance {
        if (_defaultRank != 0) {
            nextResetRank = _defaultRank;
        }
        /*
            Reset to avoid fragmented queue and redeem malfunction
        */
        while (rankedQueue[0].pledges.length > 0) {
            rankedQueue[0].pledges.pop();
        }
        while (rankedQueue[floor(2**256 - 1)].pledges.length > 0) {
            rankedQueue[floor(2**256 - 1)].pledges.pop();
        }
        for (uint256 i = nextResetRank; i <= floor(2**256 - 1); i++) {
            if (i > nextResetRank && i % 500 == 0) {
                nextResetRank = i;
                return;
            }
            while (rankedQueue[i].pledges.length > 0) {
                rankedQueue[i].pledges.pop();
            }

            rankedQueue[i].nextout = 0;
        }
    }

    function syncRankedQueue(IYamato.Pledge[] calldata pledges)
        public
        onlyGovernance
    {
        for (uint256 i = 0; i < pledges.length; i++) {
            this.upsert(pledges[i]);
        }
    }

    /******************************
        !!! Deprecated !!!
    ******************************/
    /*
        @notice LICR-based lowest ICR pledge getter
        @dev Mutable read function. It doesn't change pledgeLength until upsert runs.
        @return A pledge
    */
    function popRedeemable() public override onlyYamato returns (address) {
        return rankedQueuePop(LICR);
    }
}
