// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Roles.sol";

/**
 * @title Products
 * @dev Defines the data structures for products and their history.
 * This contract is intended to be inherited and is not deployed directly.
 */
contract Products {
    // Defines the possible states a Product can be in.
    enum State {
        AT_FARM,
        IN_TRANSIT,
        AT_COLLECTION_POINT,
        AT_WAREHOUSE,
        AT_PROCESSING_UNIT,
        PROCESSING,
        PROCESSED,
        AT_RETAILER,
        SOLD
    }

    // Defines the structure for a single history log entry.
    struct HistoryEvent {
        address actor;
        Roles.Role actorRole;
        uint256 timestamp;
        string details;
    }

    // The single, unified struct for all trackable items.
    struct Product {
        uint256 productId;
        uint256 parentProductId; // 0 if it's an original harvest, otherwise points to the source.
        string name;             // e.g., "Organic Mangoes"
        uint256 quantity;        // The current quantity of THIS specific product record.
        string unit;             // e.g., "kg"
        State currentState;
        address currentOwner;
        address destinationAddress;
        HistoryEvent[] history; // Each product has its own self-contained history.
    }

    // --- State Variables ---
    uint256 public productCounter;
    mapping(uint256 => Product) public products;

    // --- Events ---
    event ProductCreated(uint256 indexed productId, uint256 indexed parentProductId, string name, uint256 quantity);
    event ProductShipped(uint256 indexed productId, address destination);
    event ProductReceived(uint256 indexed productId, address receiver);
    event ProductStateChanged(uint256 indexed productId, State newState);
}