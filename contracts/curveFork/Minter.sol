pragma solidity 0.8.18;

/***
 *@title Token Minter
 * SPDX-License-Identifier: MIT
 */

import "./interfaces/ICRV.sol";
import "./interfaces/ILiquidityGauge.sol";
import "./interfaces/IGaugeController.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Minter is ReentrancyGuard {
    event Minted(address indexed recipient, address gauge, uint256 minted);

    address public token;
    address public controller;

    // user -> gauge -> value
    mapping(address => mapping(address => uint256)) public minted; // minted amount of user from specific gauge.

    // minter -> user -> can mint?
    mapping(address => mapping(address => bool)) public allowedToMintFor; // A can mint for B if [A => B => true].

    constructor(address _token, address _controller) {
        token = _token;
        controller = _controller;
    }

    function _mintFor(address gaugeAddr_, address for_) internal {
        require(
            IGaugeController(controller).gaugeTypes(gaugeAddr_) >= 0,
            "dev: gauge is not added"
        );

        ILiquidityGauge(gaugeAddr_).userCheckpoint(for_);
        uint256 totalMint = ILiquidityGauge(gaugeAddr_).integrateFraction(for_);
        uint256 _toMint = totalMint - minted[for_][gaugeAddr_];

        if (_toMint != 0) {
            ICRV(token).mint(for_, _toMint);
            minted[for_][gaugeAddr_] = totalMint;

            emit Minted(for_, gaugeAddr_, totalMint);
        }
    }

    /***
     *@notice Mint everything which belongs to `msg.sender` and send to them
     *@param gaugeAddr_ `LiquidityGauge` address to get mintable amount from
     */
    function mint(address gaugeAddr_) external nonReentrant {
        _mintFor(gaugeAddr_, msg.sender);
    }

    /***
     *@notice Mint everything which belongs to `msg.sender` across multiple gauges
     *@param gaugeAddrs_ List of `LiquidityGauge` addresses
     *@dev address[8]: 8 has randomly decided and has no meaning.
     */
    function mintMany(address[8] memory gaugeAddrs_) external nonReentrant {
        for (uint256 i; i < 8; ) {
            if (gaugeAddrs_[i] == address(0)) {
                break;
            }
            _mintFor(gaugeAddrs_[i], msg.sender);
            unchecked {
                ++i;
            }
        }
    }

    /***
     *@notice Mint tokens for `for_`
     *@dev Only possible when `msg.sender` has been approved via `toggle_approve_mint`
     *@param gaugeAddr_ `LiquidityGauge` address to get mintable amount from
     *@param for_ Address to mint to
     */
    function mintFor(address gaugeAddr_, address for_) external nonReentrant {
        if (allowedToMintFor[msg.sender][for_]) {
            _mintFor(gaugeAddr_, for_);
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
}
