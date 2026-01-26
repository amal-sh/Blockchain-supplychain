// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICollectionPoint {
    function receiveProduct(uint256 _productId) external;
    function splitAndShip(uint256 _sourceProductId, uint256 _quantity, address _destination) external;
}