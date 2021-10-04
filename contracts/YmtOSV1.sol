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
import "./Dependencies/SafeMath.sol";
import "hardhat/console.sol";

interface IYmtOSV1 {
    function initialize(
        address _governance,
        address _YMT,
        address _veYMT
    ) external;

    function addYamatoOfCurrencyOS(address _yamatoAddr) external;

    function vote(address _currencyOS, address _yamato) external;
}

contract YmtOSV1 is IYmtOSV1 {
    using SafeMath for uint256;

    bool initialized = false;
    address governance;
    address[] currencyOSs;
    mapping(address => address[]) yamatoesOfCurrencyOS;
    address[] voters;
    mapping(address => bool) voted;
    mapping(address => address) decisions;
    mapping(address => uint256) memScore;
    IveYMT veYMT;
    IYMT YMT;
    uint constant CYCLE_SIZE = 100000;

    /*
        !!! Admin Caution !!!
        Make sure you've explicitly initialized this contract after deployment; otherwise, someone will do it for her to set am evil governer.
    */
    function initialize(address _governance, address _YMT, address _veYMT) public onlyOnce override {
        governance = _governance;       
        YMT = IYMT(_YMT);
        veYMT = IveYMT(_veYMT);
    }

    modifier onlyOnce() {
        require(!initialized, "This contract is already initialized.");
        initialized = true;
        _;
    }

    function addYamatoOfCurrencyOS(address _yamatoAddr)
        public
        override
        onlyCurrencyOSs
    {}

    modifier onlyCurrencyOSs() {
        for (uint256 i = 0; i < currencyOSs.length; ++i) {
            if (msg.sender == currencyOSs[i]) {
                _;
            }
        }
    }

    function addCurrencyOS(address _currencyOS) external onlyGovernance {
        currencyOSs.push(_currencyOS);
    }

    modifier onlyGovernance() {
        require(msg.sender == governance, "You are not the governer.");
        _;
    }

    function vote(address _currencyOS, address _yamato)
        public
        override
        onlyWhitelisted(_currencyOS, _yamato)
    {
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
        uint256 _mintableInTimeframe = veYMT.mintableInTimeframe(
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

            uint256 _mintThisPerson = _mintableInTimeframe
                .mul(getScore(_pledge, _at))
                .div(_totalScore);
            YMT.mint(_voter, _mintThisPerson);
            delete memScore[_voter];
        }

        /*
            TODO: Gas compensation
        */

        // uint _amount = ???;
        // IFeePoolV1(feePoolProxy).withdrawFromProtocol(_amount);
    }

    function getCurrentCycle() public view returns (uint256) {
        return (block.number / CYCLE_SIZE);
    }

    function getLastCycle() public view returns (uint256) {
        return getCurrentCycle().sub(1);
    }

    function getCurrentCycleBlockRange()
        public
        view
        returns (uint256[2] memory)
    {
        return [
            getCurrentCycle().mul(CYCLE_SIZE),
            (getCurrentCycle().add(1)).mul(CYCLE_SIZE).sub(1)
        ];
    }

    function getLastCycleBlockRange() public view returns (uint256[2] memory) {
        return [
            getLastCycle().mul(CYCLE_SIZE),
            (getLastCycle().add(1)).mul(CYCLE_SIZE).sub(1)
        ];
    }

    function getScore(IYamato.Pledge memory _pledge, uint256 _at)
        public
        view
        returns (uint256)
    {
        uint256 veScore = veYMT.balanceOfAt(_pledge.owner, _at);

        // TODO: Do some magic :)

        return 1;
    }
}
