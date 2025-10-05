// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "./utils/Ownable.sol";

/// @title BaseMgroOapp
/// @notice Provides shared management configuration guarded by an ownership primitive.
abstract contract BaseMgroOapp is Ownable {
    address internal _management;

    event ManagementUpdated(address indexed previousManagement, address indexed newManagement);

    constructor(address management_, address owner_) Ownable(owner_) {
        _setManagement(management_);
    }

    function management() public view returns (address) {
        return _management;
    }

    function setManagement(address newManagement) public onlyOwner {
        _setManagement(newManagement);
    }

    function _setManagement(address newManagement) internal {
        require(newManagement != address(0), "BaseMgroOapp: zero address");
        address previousManagement = _management;
        _management = newManagement;
        emit ManagementUpdated(previousManagement, newManagement);
    }
}
