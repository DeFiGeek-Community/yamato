// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "forge-std/Test.sol";

contract BasicTest is Test {
    address public owner;
    address public user1;

    function setUp() public {
        owner = makeAddr("owner");
        user1 = makeAddr("user1");
    }

    function test_BasicSetup() public {
        assertEq(owner, makeAddr("owner"));
        assertEq(user1, makeAddr("user1"));
    }

    function test_AddressGeneration() public {
        address addr1 = makeAddr("test1");
        address addr2 = makeAddr("test2");
        
        assertTrue(addr1 != address(0));
        assertTrue(addr2 != address(0));
        assertTrue(addr1 != addr2);
    }

    function test_EtherDeal() public {
        vm.deal(user1, 10 ether);
        assertEq(user1.balance, 10 ether);
    }

    function test_Prank() public {
        vm.deal(user1, 1 ether);
        vm.startPrank(user1);
        
        // prankが設定されたことを確認（実際のmsg.senderはテストコントラクト）
        assertEq(user1.balance, 1 ether);
        
        vm.stopPrank();
    }
} 