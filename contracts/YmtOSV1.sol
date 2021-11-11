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
import "./Interfaces/ICurrencyOS.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/LiquityMath.sol";
import "./Dependencies/PledgeLib.sol";
import "hardhat/console.sol";
import "./Interfaces/IUUPSEtherscanVerifiable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

interface IYmtOSV1 {
    function vote(address _currencyOS, address _yamato) external;
}

contract YmtOSV1 is
    IYmtOSV1,
    IUUPSEtherscanVerifiable,
    Initializable,
    UUPSUpgradeable
{
    using SafeMath for uint256;
    using PledgeLib for IYamato.Pledge;

    struct Score {
        address yamato;
        uint256 yamatoScore;
        address[] voters;
        uint256[] voterScores;
        uint256 totalVoterScore;
    }
    struct Vars {
        uint256 mintableInTimeframe;
        Score[] scores;
        uint256 totalYamatoScore;
        uint256 at;
        uint256 cycle;
        uint256[2] range;
    }

    address governance;
    address[] currencyOSs;
    address[] voters;
    mapping(address => bool) voted;
    mapping(address => address) decisions;
    IveYMT veYMT;
    IYMT YMT;
    uint256 constant CYCLE_SIZE = 100000;

    function initialize(address _YMT, address _veYMT) public initializer {
        governance = msg.sender;
        YMT = IYMT(_YMT);
        veYMT = IveYMT(_veYMT);
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function _authorizeUpgrade(address) internal override onlyGovernance {}

    function getImplementation() external view override returns (address) {
        return _getImplementation();
    }

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
            voted[msg.sender] = true;
            voters.push(msg.sender);
        }
    }

    modifier onlyWhitelisted(address _currencyOS, address _yamato) {
        for (uint256 i = 0; i < currencyOSs.length; i++) {
            address[] memory _yamatoes = ICurrencyOS(currencyOSs[i]).yamatoes();
            for (uint256 j = 0; j < _yamatoes.length; j++) {
                if (_yamatoes[j] == _yamato) {
                    _;
                }
            }
        }
        revert("No yamato matched.");
    }

    function distributeYMT() public {
        Vars memory _vars;
        _vars.cycle = getLastCycle();
        _vars.at = _vars.cycle * CYCLE_SIZE;
        _vars.range = getLastCycleBlockRange();
        _vars.mintableInTimeframe = veYMT.mintableInTimeframe(
            _vars.range[0],
            _vars.range[1]
        );

        /*
            Allocate mintables to Yamato
        */
        uint256[] memory _yamatoVotingBalances;
        Score[] memory _scores;
        uint256 _totalYamatoScore;
        for (uint256 i = 0; i < currencyOSs.length; i++) {
            address[] memory _yamatoes = ICurrencyOS(currencyOSs[i]).yamatoes();
            for (uint256 j = 0; j < _yamatoes.length; j++) {
                uint256 l;
                for (uint256 k = 0; k < voters.length; j++) {
                    address _yamato = decisions[voters[k]];
                    if (_yamato == _yamatoes[j]) {
                        uint256 _votingBalance = veYMT.balanceOfAt(
                            voters[k],
                            _vars.at
                        ); // dec18
                        uint256 _voterScore = getScore(
                            _yamato,
                            voters[k],
                            _vars.at
                        );
                        _vars.scores[j].yamato = _yamato;
                        _vars.scores[j].yamatoScore = _votingBalance;
                        _vars.scores[j].voters[l] = voters[k];
                        _vars.scores[j].voterScores[l] = _voterScore;
                        _vars.scores[j].totalVoterScore += _voterScore;
                        _vars.totalYamatoScore += _votingBalance;
                        l++;
                    }
                }
            }
        }

        /*
            Calculate mintable YMT amount in this cycle
        */
        for (uint256 i = 0; i < currencyOSs.length; i++) {
            address[] memory _yamatoes = ICurrencyOS(currencyOSs[i]).yamatoes();
            for (uint256 j = 0; j < _yamatoes.length; j++) {
                uint256 _mintableForYamato = (_vars.mintableInTimeframe *
                    _vars.scores[j].yamatoScore) / _vars.totalYamatoScore;
                for (uint256 k = 0; k < _vars.scores[j].voters.length; k++) {
                    uint256 _mintThisPerson = (_mintableForYamato *
                        _vars.scores[j].voterScores[k]) /
                        _vars.scores[j].totalVoterScore;
                    YMT.mint(_vars.scores[j].voters[k], _mintThisPerson);
                }
            }
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

    function getScore(
        address _yamato,
        address _voter,
        uint256 _at
    ) public view returns (uint256) {
        // Note: https://docs.google.com/document/d/1URC_h5GpBNLGQxhE2sAAhJ86taoKHkqQEwXacp8msxw/edit
        // This document shows CJPY-denominated score result, but you still should normalize the score with "TotalScore"
        // And then multiply that share of score with the mintableInTimeframe

        IYamato.Pledge memory _pledge = IYamato(_yamato).getPledge(_voter);

        /*
            veYMT Bonus
        */
        uint256 _votingBalance = veYMT.balanceOfAt(_pledge.owner, _at); // dec18
        uint256 _votingTotal = veYMT.totalSupplyAt(_at);
        uint256 _borrow = _pledge.debt;
        (, uint256 _totalBorrow, , , , ) = IYamato(_yamato).getStates();
        uint256 _veCoef = LiquityMath._min(
            // Before optimization: (_borrow * 40/100) + (_totalBorrow * _votingBalance / _votingTotal * (100-40)/100),
            ((_borrow * 40) +
                ((_totalBorrow * _votingBalance * 60) / _votingTotal)) / 100,
            _borrow
        );

        /*
            ICR Bonus
        */
        uint256 _icrCoef; // dec18
        uint256 _icr = _pledge.getICR(IYamato(_yamato).feed());
        uint256 _mcr = uint256(IYamato(_yamato).MCR()) * 100;
        if (_icr < _mcr) {
            _icrCoef = 0;
        } else if (_icr < 15000) {
            _icrCoef = 4e17;
        } else if (_icr < 20000) {
            _icrCoef = 6e17;
        } else if (_icr < 25000) {
            _icrCoef = 8e17;
        } else {
            _icrCoef = 1e18;
        }

        return (_veCoef * _icrCoef) / 1e18; // dec18
    }
}
