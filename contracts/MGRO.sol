// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MGRO
 * @notice ERC20 token with restricted burn mechanics for management flows.
 */
contract MGRO is ERC20 {

    address private _management;

    event ManagementUpdated(address indexed previousManagement, address indexed newManagement);

    constructor(uint256 initialSupply) ERC20("MGRO", "MGRO") {
        _management = msg.sender;
        if (initialSupply > 0) {
            _mint(msg.sender, initialSupply);
        }
    }

    modifier onlyManagement() {
        require(msg.sender == _management, "MGRO: unauthorized");
        _;
    }

    function management() external view returns (address) {
        return _management;
    }

    function updateManagement(address newManagement) external onlyManagement {
        require(newManagement != address(0), "MGRO: zero management");
        address previous = _management;
        _management = newManagement;
        emit ManagementUpdated(previous, newManagement);
    }

    function burnTokens(address account, uint256 amount) external onlyManagement {
        if (account == msg.sender) {
            _burn(account, amount);
            return;
        }

        uint256 currentAllowance = allowance(account, msg.sender);
        require(currentAllowance >= amount, "MGRO: insufficient allowance");

        _spendAllowance(account, msg.sender, amount);
        _transfer(account, msg.sender, amount);
        _burn(msg.sender, amount);
    }
}
