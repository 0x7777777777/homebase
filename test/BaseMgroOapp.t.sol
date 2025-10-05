// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseMgroOapp} from "../contracts/BaseMgroOapp.sol";

contract BaseMgroOappHarness is BaseMgroOapp {
    constructor(address management_, address owner_) BaseMgroOapp(management_, owner_) {}
}

contract UnauthorizedCaller {
    function attemptSetManagement(BaseMgroOapp target, address newManagement) external {
        target.setManagement(newManagement);
    }
}

contract BaseMgroOappTest {
    BaseMgroOappHarness internal base;
    UnauthorizedCaller internal attacker;

    function setUp() public {
        base = new BaseMgroOappHarness(address(0xABCD), address(this));
        attacker = new UnauthorizedCaller();
    }

    function testOwnerCanUpdateManagement() public {
        address newManagement = address(0x1234);
        base.setManagement(newManagement);
        assertEq(base.management(), newManagement, "management should update for owner");
    }

    function testUnauthorizedCallerReverts() public {
        try attacker.attemptSetManagement(base, address(0x5678)) {
            fail("unauthorized caller should revert");
        } catch Error(string memory reason) {
            assertEq(reason, "Ownable: caller is not the owner", "unexpected revert reason");
        }
    }

    function fail(string memory message) internal pure {
        revert(message);
    }

    function assertEq(address a, address b, string memory message) internal pure {
        if (a != b) {
            revert(message);
        }
    }

    function assertEq(string memory a, string memory b, string memory message) internal pure {
        if (keccak256(bytes(a)) != keccak256(bytes(b))) {
            revert(message);
        }
    }
}
