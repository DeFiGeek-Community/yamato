pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Written by 0xMotoko (0xmotoko@pm.me)
 * Copyright (C) 2021 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "./veYMT.sol";
import "./Interfaces/IYMT.sol";
import "./Interfaces/IYamato.sol";
import "./Interfaces/IYmtOS.sol";
import "./Dependencies/UUPSBase.sol";
import "hardhat/console.sol";

contract YmtOS is IYmtOS, UUPSBase {
    string constant YMT_SLOT_ID = "deps.YMT";
    string constant VEYMT_SLOT_ID = "deps.veYMT";
    uint256 constant CYCLE_SIZE = 1;

    address[] currencyOSs;
    mapping(address => address[]) yamatoesOfCurrencyOS;
    address[] voters;
    mapping(address => bool) voted;
    mapping(address => address) decisions;
    mapping(address => uint256) memScore;

    function initialize(
        address _YMT,
        address _veYMT
    ) public override initializer {
        __UUPSBase_init();

        bytes32 YMT_KEY = bytes32(keccak256(abi.encode(YMT_SLOT_ID)));
        bytes32 VEYMT_KEY = bytes32(keccak256(abi.encode(VEYMT_SLOT_ID)));

        assembly {
            sstore(YMT_KEY, _YMT)
            sstore(VEYMT_KEY, _veYMT)
        }
    }

    function addYamatoOfCurrencyOS(
        address _yamatoAddr
    ) public override onlyCurrencyOSs {
        // TODO: Given there exists a Yamato before adding the YmtOS contract to CurrencyOS contract, such Yamato contract won't be registered to YmtOS because the Yamato.sol doesn't know which YmtOS is should be added yet.
        // So you need to make a new function onto CurrencyOS.sol where it can sync the existing, but unregistered yamatoes of CurrencyOS.sol.
        /*
            function syncYamatoesToYmtOS() onlyGovernance {
                yamatoes.map(y=>{
                    ymtOS.addYamatoOfCurrencyOS(address(y));
                })
            }
        */
    }

    modifier onlyCurrencyOSs() {
        require(_exists(), "You are not the registered CurrencyOS.");
        _;
    }

    function _exists() internal returns (bool) {
        for (uint256 i = 0; i < currencyOSs.length; ++i) {
            if (msg.sender == currencyOSs[i]) return true;
        }
        return false;
    }

    function addCurrencyOS(address _currencyOS) external onlyGovernance {
        currencyOSs.push(_currencyOS);
    }

    function vote(
        address _currencyOS,
        address _yamato
    ) public override onlyWhitelisted(_currencyOS, _yamato) {
        decisions[msg.sender] = _yamato;

        /*
            Log all voters for only once
        */
        if (!voted[msg.sender]) {
            //Note: "Once vote and transfer the veYMT" is not a DoS-vector because veYMT is not transferrable.
            voters.push(msg.sender);
        }
    }

    modifier onlyWhitelisted(address _currencyOS, address _yamato) {
        address[] memory cos = yamatoesOfCurrencyOS[_currencyOS];
        for (uint256 i = 0; i < cos.length; i++) {
            if (cos[i] == _yamato) {
                _;
            }
        }
        revert("No yamato matched.");
    }

    function distributeYMT() public {
        uint256 _cycle = getLastCycle();
        uint256 _at = _cycle * CYCLE_SIZE;
        uint256[2] memory _range = getLastCycleBlockRange();
        uint256 _mintableInTimeframe = IveYMT(veYMT()).mintableInTimeframe(
            _range[0],
            _range[1]
        );
        uint256 _totalScore = 0;

        /*
            Sum up all score
        */
        for (uint256 i = 0; i < voters.length; i++) {
            address _voter = voters[i];
            address _yamato = decisions[_voter];
            IYamato.Pledge memory _pledge = IYamato(_yamato).getPledge(_voter);
            uint256 _score = getScore(_pledge, _at);
            memScore[_voter] = _score;
            _totalScore += _score;
        }

        /*
            Calculate mintable YMT amount in this cycle
        */
        for (uint256 i = 0; i < voters.length; i++) {
            address _voter = voters[i];
            address _yamato = decisions[_voter];
            IYamato.Pledge memory _pledge = IYamato(_yamato).getPledge(_voter);

            // TODO: min((borrow*40/100)+(Totalborrow*VotingBalance/VotingTotal*(100-40)/100),borrow)*0or0.4ro0.6or0.8ro1.0
            // Note: https://docs.google.com/document/d/1URC_h5GpBNLGQxhE2sAAhJ86taoKHkqQEwXacp8msxw/edit
            // This document shows CJPY-denominated score result, but you still should normalize the score with "TotalScore"
            // And then multiply that scoreShare with the

            uint256 _mintThisPerson = (_mintableInTimeframe *
                getScore(_pledge, _at)) / _totalScore;
            IYMT(YMT()).mint(_voter, _mintThisPerson);
            delete memScore[_voter];
        }

        /*
            TODO: Gas compensation
        */

        // uint _amount = ???;
        // IFeePoolV1(feePool).withdrawFromProtocol(_amount);
    }

    function getCurrentCycle() public view returns (uint256) {
        return (block.number / CYCLE_SIZE);
    }

    function getLastCycle() public view returns (uint256) {
        return getCurrentCycle() - 1;
    }

    function getCurrentCycleBlockRange()
        public
        view
        returns (uint256[2] memory)
    {
        return [
            getCurrentCycle() * CYCLE_SIZE,
            (getCurrentCycle() + 1) * CYCLE_SIZE - 1
        ];
    }

    function getLastCycleBlockRange() public view returns (uint256[2] memory) {
        return [
            getLastCycle() * CYCLE_SIZE,
            (getLastCycle() + 1) * CYCLE_SIZE - 1
        ];
    }

    function getScore(
        IYamato.Pledge memory _pledge,
        uint256 _at
    ) public view returns (uint256) {
        uint256 veScore = IveYMT(veYMT()).balanceOfAt(_pledge.owner, _at);

        // TODO: Do some magic :)

        return 1;
    }

    function YMT() public view override returns (address _YMT) {
        bytes32 YMT_KEY = bytes32(keccak256(abi.encode(YMT_SLOT_ID)));
        assembly {
            _YMT := sload(YMT_KEY)
        }
    }

    function veYMT() public view override returns (address _veYMT) {
        bytes32 VEYMT_KEY = bytes32(keccak256(abi.encode(VEYMT_SLOT_ID)));
        assembly {
            _veYMT := sload(VEYMT_KEY)
        }
    }
}
