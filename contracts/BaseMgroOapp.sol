// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";

abstract contract BaseMgroOapp {
    using Address for address;

    event ManagementSet(address indexed management);

    address private _management;

    modifier validManagement(address management_) {
        require(management_ != address(0), "BaseMgroOapp: management is zero address");
        require(management_.isContract(), "BaseMgroOapp: management must be contract");
        _;
    }

    constructor(address management_) validManagement(management_) {
        _management = management_;
        emit ManagementSet(management_);
    }

    function management() public view returns (address) {
        return _management;
    }

    function setManagement(address management_) public virtual validManagement(management_) {
        _management = management_;
        emit ManagementSet(management_);
    }
}
