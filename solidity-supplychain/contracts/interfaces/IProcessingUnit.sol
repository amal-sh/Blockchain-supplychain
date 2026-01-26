// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IProcessingUnit {
    function receiveProduct(uint256 _productId) external;
    function splitAndShip(uint256 _sourceProductId, uint256 _quantity, address _destination) external;
    
    // UPDATED: Added _quantityToProcess to match the implementation
    function processProduct(
        uint256 _sourceProductId,
        uint256 _quantityToProcess,
        string memory _newProductName,
        uint256 _newQuantity,
        string memory _newUnit
    ) external;
}
