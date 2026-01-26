// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Roles
 * @dev Manages user roles, registration status, and access control modifiers.
 * This contract is intended to be inherited and is not deployed directly.
 */
contract Roles {
    address public owner; // The contract deployer, the "super admin"
    
    // --- NEW: Service Account for automated sensor claims ---
    address public sensorServiceAccount;

    // Defines all possible roles in the system.
    enum Role { 
        NONE, 
        ADMIN,
        FARM, 
        COLLECTION_POINT, 
        WAREHOUSE, 
        PROCESSING_UNIT, 
        RETAILER 
    }

    // --- NEW: Struct to hold profile data for each actor ---
    struct ActorProfile {
        string name;
        string phone;
        string locationCoordinates; // e.g., "40.7128,-74.0060"
        bool isCreated; // Flag to check if profile exists
    }

    // --- State Variables ---
    mapping(address => Role) public roles;
    mapping(address => bool) public isRegistered;
    // --- NEW: Mapping from an address to their profile ---
    mapping(address => ActorProfile) public actorProfiles;


    // --- Events ---
    event RoleGranted(address indexed actor, Role role);
    // --- NEW: Event for profile updates ---
    event ProfileUpdated(address indexed actor, string name);
    // --- NEW: Event for service account changes ---
    event SensorServiceAccountUpdated(address indexed oldAccount, address indexed newAccount);


    // --- Modifiers ---
    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not the owner");
        _;
    }
    
    modifier onlyAdmin() {
        require(roles[msg.sender] == Role.ADMIN, "Caller is not an Admin");
        _;
    }

    modifier onlyRole(Role _role) {
        require(roles[msg.sender] == _role, "Caller does not have the required role");
        _;
    }
    
    // --- NEW: Modifier for sensor service account ---
    modifier onlySensorService() {
        require(msg.sender == sensorServiceAccount, "Caller is not the authorized sensor service");
        _;
    }
}