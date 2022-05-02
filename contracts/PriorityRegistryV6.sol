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
import "./Interfaces/IPriceFeedV2.sol";
import "./Interfaces/IPriorityRegistryV6.sol";
import "./Interfaces/IPriorityRegistryV4.sol";
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
    mapping(uint256 => IPriorityRegistryV4.FifoQueue) rankedQueue; // Deprecated. Mar 28, 2020 - 0xMotoko
    uint256 public constant override MAX_PRIORITY =
        1157920892373161954235709850086879078532699846656405640394575840079131296399; // (2**256 - 1) / 100
    uint256 public nextResetRank;
    mapping(address => DeleteDictItem) deleteDict;
    mapping(uint256 => FifoQueue) rankedQueueV2;
    uint256 public nextUpsertPledgeIndex;

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
        uint256 _ethPriceInCurrency = IPriceFeedV2(feed()).getPrice(); // Note: can't use lastGoodPrice cuz bulkUpsert can also be called be syncer which does not use fetchPrice
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
        // Note: 2022-04-29 pledges must be sorted by those real ICR. Also, the last element can be MAXINT if you do sync.
        // Note: 2022-04-30 YamatoActions have pre-state and post-state of its pledges. pre-state pledge ICR boundary can be alternated by LICR and it can be used as hint of effective upsert.
        /*
            LICR determination algo for bulkUpsert
                - The first pledge is ICR-lowest pledge
                - Check the len of the rank
                - If empty, start traversing from that rank.
        */

        uint256 _maxCount = IYamatoV3(yamato()).maxRedeemableCount();
        uint256 _lastIndex = (_pledges.length >= _maxCount)
            ? _maxCount - 1
            : _pledges.length - 1;
        uint256 _preStateLowerBoundRank = LICR;
        Yamato.Pledge memory _postStateLowerBoundPledge = _pledges[0];
        Yamato.Pledge memory _postStateUpperBoundPledge = _pledges[_lastIndex];
        uint256 _postStateLowerBoundRank = floor(
            _postStateLowerBoundPledge.getICRWithPrice(_ethPriceInCurrency)
        );
        uint256 _postStateUpperBoundRank = floor(
            _postStateUpperBoundPledge.getICRWithPrice(_ethPriceInCurrency)
        );
        _postStateLowerBoundRank = LiquityMath._min(
            _postStateLowerBoundRank,
            _postStateUpperBoundRank
        );
        _postStateUpperBoundRank = LiquityMath._max(
            _postStateLowerBoundRank,
            _postStateUpperBoundRank
        );

        uint256 _licrCandidate = _assumeCandidateByHint(
            _preStateLowerBoundRank,
            _postStateLowerBoundRank,
            _postStateUpperBoundRank
        );

        uint256 _mcrPercent = uint256(IYamato(yamato()).MCR());
        uint256 _checkpoint = _mcrPercent +
            IYamatoV3(yamato()).CHECKPOINT_BUFFER(); // 185*0.7=130 ... priority=18400 pledge can be redeemable if 30% dump happens
        if (_licrCandidate <= 1) {
            // Note: Gas saving logic

            uint256 i = 1;
            uint256 _lastFromICR = _checkpoint;
            while (true) {
                _licrCandidate = _mcrPercent / i - 1;
                _findFloor(_licrCandidate, _lastFromICR);
                if (_licrCandidate > 1 && LICR > 0) {
                    break;
                }
                i++;
                _lastFromICR = _licrCandidate;
            }
        } else {
            // Note: Naive logic
            if (rankedQueueLen(_licrCandidate) > 0) {
                // Note: No need to scan ranks if the candidate is filled with pledges
                LICR = _licrCandidate;
            } else {
                _findFloor(_licrCandidate, _checkpoint);
            }
        }

        return _newPriorities;
    }

    /// @dev Gas saving function by elaborating the start rank of _findFloor().
    function _assumeCandidateByHint(
        uint256 _preStateLowerBoundRank,
        uint256 _postStateLowerBoundRank,
        uint256 _postStateUpperBoundRank
    ) internal pure returns (uint256 _newLowestICR) {
        _newLowestICR = 1; // Note: fallback by default
        if (
            _preStateLowerBoundRank == 0 ||
            _postStateLowerBoundRank == 0 ||
            _postStateUpperBoundRank == 0
        ) {
            return 1;
        }

        if (
            _preStateLowerBoundRank < 100 &&
            _postStateLowerBoundRank < 100 &&
            _postStateUpperBoundRank < 100
        ) {
            // Note: Optimise gas if possible
            if (_preStateLowerBoundRank > _postStateUpperBoundRank) {
                /*
                    postLower <<< postUpper <<< pre <<< 100 (redeem)
                */
                _newLowestICR = _postStateLowerBoundRank;
            } else {
                /*
                    pre <<< postLower <<< postUpper <<< 100 (repay/deposit)
                */
                _newLowestICR = _preStateLowerBoundRank;
            }
        } else if (
            _preStateLowerBoundRank >= 100 &&
            _postStateLowerBoundRank >= 100 &&
            _postStateUpperBoundRank >= 100
        ) {
            // Note: Optimise gas if possible
            if (_preStateLowerBoundRank < _postStateLowerBoundRank) {
                /*
                    100 <<< pre <<< postLower <<< postUpper (redeem/repay/deposit)
                */
                _newLowestICR = _preStateLowerBoundRank;
            } else {
                /*
                    100 <<< postLower <<< postUpper <<< pre (borrow/withdraw)
                */
                _newLowestICR = _postStateLowerBoundRank;
            }
        } else {
            // Note: Fallback case
            _newLowestICR = _postStateLowerBoundRank;
            _newLowestICR = LiquityMath._min(
                _newLowestICR,
                _preStateLowerBoundRank
            );
            _newLowestICR = LiquityMath._min(
                _newLowestICR,
                _postStateUpperBoundRank
            );
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
        address[] storage pledgeAddrs = rankedQueueV2[_icr].pledges;
        deleteDict[_pledgeAddr] = DeleteDictItem(
            true,
            uint248(pledgeAddrs.length)
        ); // Note: Fill it when you pushed, reset it when you deleted.
        pledgeAddrs.push(_pledgeAddr);
    }

    function rankedQueuePop(uint256 _icr)
        public
        override
        onlyYamato
        returns (address _pledgeAddr)
    {
        FifoQueue storage fifoQueue = rankedQueueV2[_icr];
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
        delete rankedQueueV2[_icr].pledges[_i];
    }

    function rankedQueueLen(uint256 _icr)
        public
        view
        override
        returns (uint256 count)
    {
        FifoQueue storage fifoQueue = rankedQueueV2[_icr];
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
        return rankedQueueV2[_icr].pledges.length;
    }

    function rankedQueueNextout(uint256 _icr)
        public
        view
        override
        returns (uint256)
    {
        return rankedQueueV2[_icr].nextout;
    }

    /*
    ==============================
        Internal Function
    ==============================
        - _deletePledge
        - _findFloor
    */
    /*
        @dev delete of "address[] storage" (rankedQueueSearchAndDestroy) causes gap in the list.
             deleteDict knows which pledge is in which index.
        @param _pledge the delete target
    */
    function _deletePledge(IYamato.Pledge memory _pledge) internal {
        uint256 _icr = floor(_pledge.priority);
        DeleteDictItem memory _item = deleteDict[_pledge.owner];
        if (
            _item.isCreated && uint256(_item.index) < rankedQueueTotalLen(_icr) /* To distinguish isCreated=true and index=0 */
        ) {
            rankedQueueSearchAndDestroy(_icr, uint256(_item.index));
        }
    }

    function _findFloor(uint256 _fromICR, uint256 _toICR) internal {
        uint256 _mcrPercent = uint256(IYamato(yamato()).MCR());
        uint256 _next = _fromICR;
        uint256 _checkpoint = _toICR;
        while (true) {
            if (_next < _checkpoint && rankedQueueLen(_next) > 0) {
                if (LICR == _mcrPercent && _next == _mcrPercent) {
                    _next++; // skip just-to-MCR redemption
                } else {
                    LICR = _next; // the first filled rankedQueue
                    break;
                }
            } else if (_next < _checkpoint && rankedQueueLen(_next) == 0) {
                _next++;
            } else if (_next >= _checkpoint) {
                LICR = _checkpoint - 1; // default LICR
                break;
            } else {
                // Note: void
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
            return rankedQueueV2[_icr].pledges[i];
        }
    }

    function getRedeemablesCap() external view returns (uint256 _cap) {
        uint256 _mcrPercent = uint256(IYamato(yamato()).MCR());
        uint256 _checkpoint = _mcrPercent +
            IYamatoV3(yamato()).CHECKPOINT_BUFFER();
        // uint256 ethPriceInCurrency = IPriceFeedV2(feed()).lastGoodPrice();
        uint256 ethPriceInCurrency = IPriceFeedV2(feed()).getPrice();

        uint256 _rank = 1;
        uint256 _nextout = rankedQueueNextout(_rank);
        address _pledgeAddr = getRankedQueue(_rank, _nextout);
        IYamato.Pledge memory _pledge = IYamato(yamato()).getPledge(
            _pledgeAddr
        );
        uint256 _icr = _pledge.getICRWithPrice(ethPriceInCurrency);
        while (true) {
            if (_icr > _mcrPercent * 100 || _rank >= _checkpoint) {
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
        uint256 _nextout = rankedQueueV2[0].nextout;
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

    function resetQueue(uint256 _defaultRank, IYamato.Pledge[] calldata pledges)
        public
        onlyGovernance
    {
        LICR = 0;

        if (_defaultRank != 0) {
            nextResetRank = _defaultRank;
        }
        /*
            Reset to avoid fragmented queue and redeem malfunction
        */
        while (rankedQueueV2[0].pledges.length > 0) {
            rankedQueueV2[0].pledges.pop();
            rankedQueueV2[0].nextout = 0;
        }
        while (rankedQueueV2[MAX_PRIORITY].pledges.length > 0) {
            rankedQueueV2[MAX_PRIORITY].pledges.pop();
            rankedQueueV2[MAX_PRIORITY].nextout = 0;
        }

        for (uint256 i = nextResetRank; i <= MAX_PRIORITY; i++) {
            if (i > nextResetRank && i % 500 == 0) {
                nextResetRank = i;
                return;
            }
            while (rankedQueueV2[i].pledges.length > 0) {
                rankedQueueV2[i].pledges.pop();
            }

            rankedQueueV2[i].nextout = 0;
        }

        DeleteDictItem memory nullItem;
        for (uint256 i = 0; i < pledges.length; i++) {
            deleteDict[pledges[i].owner] = nullItem;
        }
    }

    function syncRankedQueue(IYamato.Pledge[] memory pledges)
        public
        onlyGovernance
    {
        this.bulkUpsert(pledges);
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
