// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

/// @title Migrations
/// @notice Standard Truffle support contract used to track executed migrations.
contract Migrations {
    address public owner = msg.sender;
    uint256 public lastCompletedMigration;

    modifier restricted() {
        require(msg.sender == owner, "This function is restricted to the contract owner");
        _;
    }

    function setCompleted(uint256 completed) public restricted {
        lastCompletedMigration = completed;
    }
}
