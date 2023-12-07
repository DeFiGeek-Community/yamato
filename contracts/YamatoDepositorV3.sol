pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2023 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "./PoolV2.sol";
import "./YMT.sol";
import "./PriceFeedV3.sol";
import "./Dependencies/YamatoAction.sol";
import "./Dependencies/PledgeLib.sol";
import "./Dependencies/SafeMath.sol";
import "./Interfaces/IYamato.sol";
import "./Interfaces/IYamatoV4.sol";
import "./Interfaces/IFeePool.sol";
import "./Interfaces/ICurrencyOS.sol";
import "./Interfaces/IYamatoDepositor.sol";
import "./Interfaces/IPriorityRegistryV6.sol";
import "./Interfaces/IScoreRegistry.sol";
import "hardhat/console.sol";

/// @title Yamato Depositor Contract
contract YamatoDepositorV3 is IYamatoDepositor, YamatoAction {
    using PledgeLib for IYamato.Pledge;
    using PledgeLib for uint256;

    function initialize(address _yamato) public initializer {
        __YamatoAction_init(_yamato);
    }

    /// @dev no reentrancy guard because action funcs are protected by permitDeps()
    function runDeposit(address _sender) public payable override onlyYamato {
        IPriceFeedV3(priceFeed()).fetchPrice();
        uint256 _ethAmount = msg.value;

        /*
            1. Validate lock
            2. Compose a pledge in memory
        */
        require(
            !IYamato(yamato()).checkFlashLock(_sender),
            "Those can't be called in the same block."
        );

        IYamato.Pledge memory pledge = IYamato(yamato()).getPledge(_sender);
        (uint256 totalColl, uint256 totalDebt, , , , ) = IYamato(yamato())
            .getStates();

        pledge.coll += _ethAmount;

        require(
            pledge.coll >= IYamatoV4(yamato()).collFloor(),
            "Deposit or Withdraw can't make pledge less than floor size."
        );

        if (!pledge.isCreated) {
            // new pledge
            pledge.isCreated = true;
            pledge.owner = _sender;
        }

        /*
            scoreRegistry checkpoint
        */
        IScoreRegistry _scoreRegistry = IScoreRegistry(
            IYamatoV4(yamato()).scoreRegistry()
        );
        if (pledge.debt > 0) {
            _scoreRegistry.checkpoint(_sender);
        }

        /*
            3. Update PriorityRegistry
        */
        pledge.priority = IPriorityRegistryV6(priorityRegistry()).upsert(
            pledge
        );

        /*
            4. Commit pledge modifications
        */
        IYamato(yamato()).setPledge(pledge.owner, pledge);

        /*
            5. Set totalColl
        */
        IYamato(yamato()).setTotalColl(totalColl + _ethAmount);

        /*
            6. Set FlashLock
        */
        IYamato(yamato()).setFlashLock(_sender);

        /*
            Update score
        */
        if (pledge.debt > 0) {
            _scoreRegistry.updateScoreLimit(
                _sender,
                pledge.debt,
                totalDebt,
                pledge.getICR(priceFeed())
            );
        }

        /*
            7. Send ETH to pool
        */
        (bool success, ) = payable(pool()).call{value: _ethAmount}("");
        require(success, "transfer failed");
    }
}
