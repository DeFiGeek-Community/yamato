// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

// Interface for checking whether address belongs to a whitelisted type of a smart wallet.
// When new types are added - the whole contract is changed
// The check() method is modifying to be able to use caching
// for individual wallet addresses
interface ISmartWalletChecker {
    function check(address addr_) external returns (bool);
}
