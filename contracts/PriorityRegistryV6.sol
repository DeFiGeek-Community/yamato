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
import "./Interfaces/IPriceFeedV3.sol";
import "./Interfaces/IPriorityRegistryV6.sol";
import "./Interfaces/IPriorityRegistryFlexV6.sol";
import "./Interfaces/IPriorityRegistryV4.sol";
import "./Dependencies/PledgeLib.sol";
import "./Dependencies/YamatoStore.sol";
import "./Dependencies/LiquityMath.sol";
import "hardhat/console.sol";

/// @dev For gas saving reason, we use percent denominated ICR only in this contract.
contract PriorityRegistryV6 is
    IPriorityRegistryV6,
    IPriorityRegistryFlexV6,
    YamatoStore
{
    using PledgeLib for IYamato.Pledge;

    mapping(uint256 => mapping(address => IYamato.Pledge))
        private leveledPledges; // ICR => owner => Pledge
    mapping(uint256 => address[]) private levelIndice; // ICR => owner[]
    uint256 public override pledgeLength; // Note: Deprecated in V6
    uint256 public override LICR; // Note: Lowest ICR in percent
    mapping(uint256 => IPriorityRegistryV4.FifoQueue) private rankedQueue; // Deprecated. Mar 28, 2020 - 0xMotoko
    uint256 public constant override MAX_PRIORITY =
        1157920892373161954235709850086879078532699846656405640394575840079131296399; // (2**256 - 1) / 100
    uint256 public nextResetRank;
    mapping(address => DeleteDictItem) private deleteDict;
    mapping(uint256 => FifoQueue) private rankedQueueV2;
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

    /// @notice The upsert process is  1. update coll/debt in Yamato-side 2. floor the last ICR to make "level" 3. upsert and return the new "upsert-time ICR"  4. update padded-priority to the Yamato
    /// @dev It upserts "deposited", "borrowed", "repayed", "partially withdrawn", "redeemed", or "partially swept" pledges.
    /// @return _newICRpercent is for overwriting Yamato.sol's pledge info
    function upsert(
        IYamato.Pledge memory _pledge
    ) public override onlyYamato returns (uint256) {
        IYamato.Pledge[] memory _pledges = new IYamato.Pledge[](1);
        _pledges[0] = _pledge;
        uint256[] memory priorities = bulkUpsert(_pledges);
        return priorities[0];
    }

    /// @notice upsert for several pledges without LICR update and traverse
    /// @return new ICRs in percent
    function bulkUpsert(
        IYamato.Pledge[] memory _pledges
    ) public override onlyYamato returns (uint256[] memory) {
        BulkUpsertVar memory vars;
        vars._ethPriceInCurrency = IPriceFeedV3(priceFeed()).getPrice(); // Note: can't use lastGoodPrice cuz bulkUpsert can also be called be syncer which does not use fetchPrice
        vars._newPriorities = new uint256[](_pledges.length);
        for (uint256 i; i < _pledges.length; i++) {
            vars._pledge = _pledges[i];
            if (vars._pledge.isCreated == false) {
                continue;
            }

            vars._oldICRpercent = floor(vars._pledge.priority);

            require(
                !(vars._pledge.coll == 0 &&
                    vars._pledge.debt == 0 &&
                    vars._oldICRpercent != 0),
                "Upsert Error: The logless zero pledge cannot be upserted. It should be removed."
            );

            /*
                1. delete current pledge from sorted pledge and update LICR
            */
            if (
                !(vars._pledge.debt == 0 &&
                    vars._oldICRpercent == 0) /* Exclude "new pledge" */
            ) {
                _deletePledge(vars._pledge);
            }

            /* 
                2. insert new pledge
            */

            vars._newICRPertenk = vars._pledge.getICRWithPrice(
                vars._ethPriceInCurrency
            );
            vars._newICRpercent = floor(vars._newICRPertenk);

            require(
                vars._newICRpercent <= MAX_PRIORITY,
                "priority can't be that big."
            );

            vars._pledge.priority = vars._newICRPertenk;

            rankedQueuePush(vars._newICRpercent, vars._pledge.owner);

            vars._newPriorities[i] = vars._newICRPertenk;
        }

        /*
            [LICR update]
                      
            checkSync ==[yes]=> findFloor(1, checkpoint)
                |
                no
                |
                V
            checkDirection
                |
                |
                |===[up]==>  rankedQueueLen(LICR) ===[ =0 ]==> findFloor(LICR+1, checkpoint)
                |                     |
                |                     >0
                |                     |
                |                     V
                |                    keep
                |
                |
                |==[down]=>  rankedQueueLen(LICR) ===[ =0 ]==> findFloor(watermark, checkpoint)
                |                     |
                |                     >0
                |                     |
                |                     V
                |          findFloor(watermark, LICR)
                |
                |
                |==[zero]=>  rankedQueueLen(LICR) ===[ =0 ]==> findFloor(LICR+1, checkpoint)
                                      |
                                      >0
                                      |
                                      V
                               findFloor(1, LICR)


        */
        vars._mcrPercent = uint256(IYamato(yamato()).MCR());
        vars._checkpoint =
            vars._mcrPercent +
            IYamatoV3(yamato()).CHECKPOINT_BUFFER(); // 185*0.7=130 ... priority=18400 pledge can be redeemable if 30% dump happens
        vars._isSyncAction = LICR == 0 && _pledges.length > 1;

        if (vars._isSyncAction) {
            _findFloor(1, vars._checkpoint);
        } else {
            vars._lenAtLICR = rankedQueueLen(LICR);
            vars._maxCount = IYamatoV3(yamato()).maxRedeemableCount();
            uint256 _len = (_pledges.length < vars._maxCount)
                ? _pledges.length
                : vars._maxCount;
            for (uint256 i; i < _len; i++) {
                if (_pledges[i].isCreated) {
                    vars._lastIndex++;
                }
            }
            vars._lastIndex = vars._lastIndex > 0 ? vars._lastIndex - 1 : 0;
            vars._preStateLowerBoundRank = LICR;
            vars._postStateLowerBoundRank = floor(
                _pledges[0].getICRWithPrice(vars._ethPriceInCurrency)
            );
            vars._postStateUpperBoundRank = floor(
                _pledges[vars._lastIndex].getICRWithPrice(
                    vars._ethPriceInCurrency
                )
            );

            uint256 _tmp = vars._postStateUpperBoundRank;
            if (_tmp < vars._postStateLowerBoundRank) {
                vars._postStateUpperBoundRank = vars._postStateLowerBoundRank;
                vars._postStateLowerBoundRank = _tmp;
            }

            (Direction _direction, uint256 _hint) = _checkDirection(
                vars._preStateLowerBoundRank,
                vars._postStateLowerBoundRank,
                vars._postStateUpperBoundRank
            );
            if (_direction == Direction.UP) {
                if (vars._lenAtLICR > 0) {
                    // Note: keep
                } else {
                    _findFloor(
                        vars._preStateLowerBoundRank + 1,
                        vars._checkpoint
                    );
                }
            } else if (_direction == Direction.DOWN) {
                if (vars._lenAtLICR > 0) {
                    _findFloor(_hint, vars._preStateLowerBoundRank);
                } else {
                    _findFloor(_hint, vars._checkpoint);
                }
            } else if (_direction == Direction.ZERO) {
                if (vars._lenAtLICR > 0) {
                    // Note: keep
                } else {
                    _findFloor(
                        vars._preStateLowerBoundRank + 1,
                        vars._checkpoint
                    );
                }
            }
        }

        return vars._newPriorities;
    }

    /// @dev It removes "just full swept" or "just full withdrawn" pledges.
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
        Fifo Managers (public, because of testability)
    ==============================
        - rankedQueuePush
        - rankedQueuePop
        - rankedQueueSearchAndDestroy
        - rankedQueueLen
        - rankedQueueTotalLen
    */
    /// @dev FIFO-esque priority mutation func
    function rankedQueuePush(
        uint256 _icr,
        address _pledgeAddr
    ) public override onlyYamato {
        address[] storage pledgeAddrs = rankedQueueV2[_icr].pledges;
        deleteDict[_pledgeAddr] = DeleteDictItem(
            true,
            uint248(pledgeAddrs.length)
        ); // Note: Fill it when you pushed, reset it when you deleted.
        pledgeAddrs.push(_pledgeAddr);
    }

    /// @dev FIFO-esque priority mutation func
    function rankedQueuePop(
        uint256 _icr
    ) public override onlyYamato returns (address _pledgeAddr) {
        FifoQueue storage fifoQueue = rankedQueueV2[_icr];
        uint256 _nextout = fifoQueue.nextout;
        uint256 _nextin = rankedQueueTotalLen(_icr);

        if (_nextout < _nextin) {
            _pledgeAddr = fifoQueue.pledges[_nextout]; // Note: It enables early finish and can save gas

            if (_pledgeAddr == address(0)) {
                while (
                    _nextout < _nextin - 1 /* len - 1 is the upper bound */ &&
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

    /// @dev FIFO-esque priority mutation func
    function rankedQueueSearchAndDestroy(
        uint256 _icr,
        uint256 _i
    ) public override onlyYamato {
        delete rankedQueueV2[_icr].pledges[_i];
    }

    /// @dev real length of fifo queue
    function rankedQueueLen(
        uint256 _icr
    ) public view override returns (uint256 count) {
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

    /// @dev total length of fifo queue
    function rankedQueueTotalLen(
        uint256 _icr
    ) public view override returns (uint256) {
        return rankedQueueV2[_icr].pledges.length;
    }

    /// @dev index of next pop
    function rankedQueueNextout(
        uint256 _icr
    ) public view override returns (uint256) {
        return rankedQueueV2[_icr].nextout;
    }

    /*
    ==============================
        Internal Function
    ==============================
        - _deletePledge
        - _findFloor
        - _checkDirection
    */
    /*
        @dev delete of "address[] storage" (rankedQueueSearchAndDestroy) causes gap in the list.
             deleteDict knows which pledge is in which index.
        @param _pledge the delete target
    */
    /// @dev wrapper of rankedQueueSearchAndDestroy
    function _deletePledge(IYamato.Pledge memory _pledge) internal {
        uint256 _icr = floor(_pledge.priority);
        DeleteDictItem memory _item = deleteDict[_pledge.owner];
        if (
            _item.isCreated &&
            uint256(_item.index) <
            rankedQueueTotalLen(
                _icr
            ) /* To distinguish isCreated=true and index=0 */
        ) {
            rankedQueueSearchAndDestroy(_icr, uint256(_item.index));
        }
    }

    /// @notice Finding highest priority pledge with scanning logic until checkpoint.
    /// @dev Assumes pledges more than checkpoint is not redeemable if price drops more than buffer.
    /// @dev But having some un-redeemable pledges is not a really big deal as long as TCR > 100%
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

    /// @dev Comparison function between LICR and post state
    function _checkDirection(
        uint256 _preStateLowerBoundRank,
        uint256 _postStateLowerBoundRank,
        uint256 _postStateUpperBoundRank
    ) internal pure returns (Direction _direction, uint256 _hint) {
        if (_postStateLowerBoundRank == 0 && _postStateUpperBoundRank == 0) {
            return (Direction.ZERO, 0);
        }

        if (_preStateLowerBoundRank <= _postStateLowerBoundRank) {
            /*
                            post state
                                |
                LICR -- [lower -- upper]
            */
            return (Direction.UP, 0);
        } else if (_postStateUpperBoundRank <= _preStateLowerBoundRank) {
            uint256 watermark = _postStateLowerBoundRank > 0
                ? _postStateLowerBoundRank
                : _postStateUpperBoundRank;

            /*
                    post state
                        |
                [lower -- upper] -- LICR
            */
            return (Direction.DOWN, watermark);
        } else if (
            _postStateLowerBoundRank < _preStateLowerBoundRank &&
            _preStateLowerBoundRank < _postStateUpperBoundRank
        ) {
            /*
                # Happens when sweepables are born
                lower -- LICR -- upper
                    |        |        |
                    |      empty      |
                    |                 |
                    zero            find this
            */
            return (Direction.UP, _postStateUpperBoundRank);
        } else {
            revert("_checkDirection: impossible case");
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
    /// @notice Just getting a fifo queue item
    function getRankedQueue(
        uint256 _icr,
        uint256 i
    ) public view override returns (address) {
        if (i < rankedQueueTotalLen(_icr)) {
            return rankedQueueV2[_icr].pledges[i];
        }
    }

    /// @dev Redeemable amount calculator
    function getRedeemablesCap() external view returns (uint256 _cap) {
        uint256 _mcrPercent = uint256(IYamato(yamato()).MCR());
        uint256 _checkpoint = _mcrPercent +
            IYamatoV3(yamato()).CHECKPOINT_BUFFER();
        // uint256 ethPriceInCurrency = IPriceFeedV3(feed()).lastGoodPrice();
        uint256 ethPriceInCurrency = IPriceFeedV3(priceFeed()).getPrice();

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
                    if (_pledge.isCreated /* to skip gap */) {
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

    /// @dev Sweepable amount calculator
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

    /// @dev ICR to priority converter
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

    /// @dev When harsh storage upgrade there is, you may need this one.
    function resetQueue(
        uint256 _defaultRank,
        IYamato.Pledge[] calldata pledges
    ) public onlyGovernance {
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

    /// @dev When harsh storage upgrade there is, you may need this one.
    function syncRankedQueue(
        IYamato.Pledge[] memory pledges
    ) public onlyGovernance {
        this.bulkUpsert(pledges);
    }
}
