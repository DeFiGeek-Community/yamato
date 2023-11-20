pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2023 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "./Interfaces/IYMT.sol";
import "./Interfaces/IScoreRegistry.sol";
import "./Interfaces/IScoreController.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

/***
 *@title Token Minter
 */

contract YmtMinter is
    UUPSBase,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    event Minted(address indexed recipient, address score, uint256 minted);

    address public token;
    address public controller;

    // user -> score -> value
    mapping(address => mapping(address => uint256)) public minted; // minted amount of user from specific score.

    // minter -> user -> can mint?
    mapping(address => mapping(address => bool)) public allowedToMintFor; // A can mint for B if [A => B => true].

    function initialize(
        address _token,
        address _controller
    ) public initializer {
        token = _token;
        controller = _controller;
        __ReentrancyGuard_init();
        __Pausable_init();
    }

    function _mintFor(address scoreAddr_, address for_) internal {
        require(
            IScoreController(controller).scoreTypes(scoreAddr_) >= 0,
            "dev: score is not added"
        );

        IScoreRegistry(scoreAddr_).userCheckpoint(for_);
        uint256 totalMint = IScoreRegistry(scoreAddr_).integrateFraction(for_);
        uint256 _toMint = totalMint - minted[for_][scoreAddr_];

        if (_toMint != 0) {
            IYMT(token).mint(for_, _toMint);
            minted[for_][scoreAddr_] = totalMint;

            emit Minted(for_, scoreAddr_, totalMint);
        }
    }

    /***
     *@notice Mint everything which belongs to `msg.sender` and send to them
     *@param scoreAddr_ `LiquidityScore` address to get mintable amount from
     */
    function mint(address scoreAddr_) external nonReentrant {
        _mintFor(scoreAddr_, msg.sender);
    }

    /***
     *@notice Mint everything which belongs to `msg.sender` across multiple scores
     *@param scoreAddrs_ List of `LiquidityScore` addresses
     *@dev address[8]: 8 has randomly decided and has no meaning.
     */
    function mintMany(address[8] memory scoreAddrs_) external nonReentrant {
        for (uint256 i; i < 8; ) {
            if (scoreAddrs_[i] == address(0)) {
                break;
            }
            _mintFor(scoreAddrs_[i], msg.sender);
            unchecked {
                ++i;
            }
        }
    }

    /***
     *@notice Mint tokens for `for_`
     *@dev Only possible when `msg.sender` has been approved via `toggle_approve_mint`
     *@param scoreAddr_ `LiquidityScore` address to get mintable amount from
     *@param for_ Address to mint to
     */
    function mintFor(address scoreAddr_, address for_) external nonReentrant {
        if (allowedToMintFor[msg.sender][for_]) {
            _mintFor(scoreAddr_, for_);
        }
    }

    /***
     *@notice allow `mintingUser` to mint for `msg.sender`
     *@param mintingUser_ Address to toggle permission for
     */
    function toggleApproveMint(address mintingUser_) external {
        allowedToMintFor[mintingUser_][msg.sender] = !allowedToMintFor[
            mintingUser_
        ][msg.sender];
    }

    /*
    ==============================
        Internal Helpers
    ==============================
        - toggle
    */

    /// @dev Pausable
    function toggle() external onlyGovernance {
        if (paused()) {
            _unpause();
        } else {
            _pause();
        }
    }
}
