pragma solidity 0.8.4;

/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright (C) 2023 Yamato Protocol (DeFiGeek Community Japan)
 */

//solhint-disable max-line-length
//solhint-disable no-inline-assembly

import "./Interfaces/IYMT.sol";
import "./Interfaces/IScoreRegistry.sol";
import "./Interfaces/IScoreWeightController.sol";
import "./Dependencies/UUPSBase.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

/**
 * @title YMT Minter
 */

contract YmtMinter is
    UUPSBase,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    event Minted(address indexed recipient, address score, uint256 minted);

    string constant YMT_SLOT_ID = "deps.YMT";
    string constant WEIGHT_CONTROLLER_SLOT_ID = "deps.ScoreWeightController";

    // user -> score -> value
    mapping(address => mapping(address => uint256)) public minted; // minted amount of user from specific score.

    // ymtMinter -> user -> can mint?
    mapping(address => mapping(address => bool)) public allowedToMintFor; // A can mint for B if [A => B => true].

    function initialize(
        address ymtAddr,
        address scoreWeightControllerAddr
    ) public initializer {
        __UUPSBase_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        bytes32 YMT_KEY = bytes32(keccak256(abi.encode(YMT_SLOT_ID)));
        bytes32 WEIGHT_CONTROLLER_KEY = bytes32(
            keccak256(abi.encode(WEIGHT_CONTROLLER_SLOT_ID))
        );
        assembly {
            sstore(YMT_KEY, ymtAddr)
            sstore(WEIGHT_CONTROLLER_KEY, scoreWeightControllerAddr)
        }
    }

    function _mintFor(address scoreAddr_, address for_) internal returns (uint256) {
        require(
            IScoreWeightController(scoreWeightController()).scores(scoreAddr_) >
                0,
            "dev: score is not added"
        );

        IScoreRegistry(scoreAddr_).userCheckpoint(for_);
        uint256 totalMint = IScoreRegistry(scoreAddr_).integrateFraction(for_);
        uint256 _toMint = totalMint - minted[for_][scoreAddr_];

        if (_toMint != 0) {
            IYMT(YMT()).mint(for_, _toMint);
            minted[for_][scoreAddr_] = totalMint;

            emit Minted(for_, scoreAddr_, totalMint);
        }
        return _toMint;
    }

    /**
     * @notice Mint everything which belongs to `msg.sender` and send to them
     * @param scoreAddr_ `ScoreRegistry` address to get mintable amount from
     */
    function mint(address scoreAddr_) external nonReentrant returns (uint256) {
        return _mintFor(scoreAddr_, msg.sender);
    }

    /**
     * @notice Mint everything which belongs to `msg.sender` across multiple scores
     * @param scoreAddrs_ List of `ScoreRegistry` addresses
     * @dev address[8]: 8 has randomly decided and has no meaning.
     */
    // function mintMany(address[8] memory scoreAddrs_) external nonReentrant {
    //     for (uint256 i; i < 8; ) {
    //         if (scoreAddrs_[i] == address(0)) {
    //             break;
    //         }
    //         _mintFor(scoreAddrs_[i], msg.sender);
    //         unchecked {
    //             ++i;
    //         }
    //     }
    // }

    /**
     * @notice Mint tokens for `for_`
     * @dev Only possible when `msg.sender` has been approved via `toggle_approve_mint`
     * @param scoreAddr_ `ScoreRegistry` address to get mintable amount from
     * @param for_ Address to mint to
     */
    function mintFor(address scoreAddr_, address for_) external nonReentrant returns (uint256) {
        uint256 toMint = 0;
        if (allowedToMintFor[msg.sender][for_]) {
            toMint = _mintFor(scoreAddr_, for_);
        }
        return toMint;
    }

    /**
     * @notice allow `mintingUser` to mint for `msg.sender`
     * @param mintingUser_ Address to toggle permission for
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

    /*
        =====================
        Getter Functions
        =====================
    */
    function YMT() public view returns (address _YMT) {
        bytes32 YMT_KEY = bytes32(keccak256(abi.encode(YMT_SLOT_ID)));
        assembly {
            _YMT := sload(YMT_KEY)
        }
    }

    function scoreWeightController()
        public
        view
        returns (address _scoreWeightController)
    {
        bytes32 WEIGHT_CONTROLLER_KEY = bytes32(
            keccak256(abi.encode(WEIGHT_CONTROLLER_SLOT_ID))
        );
        assembly {
            _scoreWeightController := sload(WEIGHT_CONTROLLER_KEY)
        }
    }
}
