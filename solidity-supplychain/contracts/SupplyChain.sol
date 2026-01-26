// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./storage/Roles.sol";
import "./storage/Products.sol";
import "./interfaces/IFarm.sol";
import "./interfaces/ICollectionPoint.sol";
import "./interfaces/IWarehouse.sol";
import "./interfaces/IProcessingUnit.sol";
import "./interfaces/IRetailer.sol";

contract SupplyChain is
    Roles,
    Products,
    IFarm,
    ICollectionPoint,
    IWarehouse,
    IProcessingUnit,
    IRetailer
{
    // --- Insurance Claim Additions Start ---

    struct InsuranceClaim {
        uint256 claimId;
        address claimant; // The farmer's farm address
        string sensorType;
        string sensorValue;
        uint256 timestamp;
        string status; // e.g., "Filed", "Reviewed", "Paid"
    }

    event InsuranceClaimFiled(
        uint256 claimId,
        address indexed claimant,
        string sensorType,
        string sensorValue,
        uint256 timestamp
    );

    uint256 private claimCounter;
    mapping(uint256 => InsuranceClaim) public insuranceClaims;
    mapping(address => uint256[]) public claimsByFarmer;

    // --- Insurance Claim Additions End ---


    constructor() {
        owner = msg.sender;
        _grantInitialAdmin(msg.sender);
    }

    // --- NEW: Function to set the sensor service account (only owner can call) ---
    function setSensorServiceAccount(address _serviceAccount) public onlyOwner {
        require(_serviceAccount != address(0), "Service account cannot be zero address");
        address oldAccount = sensorServiceAccount;
        sensorServiceAccount = _serviceAccount;
        emit SensorServiceAccountUpdated(oldAccount, _serviceAccount);
    }

    function _grantRole(address _actor, Role _role) internal {
        require(!isRegistered[_actor], "Address is already registered with a role.");
        roles[_actor] = _role;
        isRegistered[_actor] = true;
        emit RoleGranted(_actor, _role);
    }
    
    function _grantInitialAdmin(address _adminAddress) internal {
        roles[_adminAddress] = Role.ADMIN;
        isRegistered[_adminAddress] = true;
        emit RoleGranted(_adminAddress, Role.ADMIN);
    }

    function addFarmAndProfile(
        address _farmAddress,
        string memory _name,
        string memory _phone,
        string memory _locationCoordinates
    ) public onlyAdmin {
        _grantRole(_farmAddress, Role.FARM);
        actorProfiles[_farmAddress] = ActorProfile(_name, _phone, _locationCoordinates, true);
        emit ProfileUpdated(_farmAddress, _name);
    }

    function claimAdminRole(string memory _name, string memory _phone) public {
        _grantRole(msg.sender, Role.ADMIN);
        actorProfiles[msg.sender] = ActorProfile(_name, _phone, "", true);
        emit ProfileUpdated(msg.sender, _name);
    }

    function claimCollectionPointRole(string memory _name, string memory _phone, string memory _locationCoordinates) public {
        _grantRole(msg.sender, Role.COLLECTION_POINT);
        actorProfiles[msg.sender] = ActorProfile(_name, _phone, _locationCoordinates, true);
        emit ProfileUpdated(msg.sender, _name);
    }

    function claimWarehouseRole(string memory _name, string memory _phone, string memory _locationCoordinates) public {
        _grantRole(msg.sender, Role.WAREHOUSE);
        actorProfiles[msg.sender] = ActorProfile(_name, _phone, _locationCoordinates, true);
        emit ProfileUpdated(msg.sender, _name);
    }

    function claimProcessingUnitRole(string memory _name, string memory _phone, string memory _locationCoordinates) public {
        _grantRole(msg.sender, Role.PROCESSING_UNIT);
        actorProfiles[msg.sender] = ActorProfile(_name, _phone, _locationCoordinates, true);
        emit ProfileUpdated(msg.sender, _name);
    }

    function claimRetailerRole(string memory _name, string memory _phone, string memory _locationCoordinates) public {
        _grantRole(msg.sender, Role.RETAILER);
        actorProfiles[msg.sender] = ActorProfile(_name, _phone, _locationCoordinates, true);
        emit ProfileUpdated(msg.sender, _name);
    }

    function createProduct(string memory _name, uint256 _quantity, string memory _unit) public override onlyRole(Role.FARM) {
        uint256 id = productCounter++;
        products[id] = Product(id, 0, _name, _quantity, _unit, State.AT_FARM, msg.sender, address(0), new HistoryEvent[](0));
        _addHistory(id, "Harvested");
        emit ProductCreated(id, 0, _name, _quantity);
    }

    function splitAndShip(uint256 _sourceProductId, uint256 _quantity, address _destination) public override(IFarm, ICollectionPoint, IWarehouse, IProcessingUnit, IRetailer) {
        Product storage sourceProduct = products[_sourceProductId];
        require(sourceProduct.currentOwner == msg.sender, "Caller is not owner of source product.");
        require(sourceProduct.quantity >= _quantity, "Insufficient quantity in source product.");
        require(sourceProduct.currentState != State.IN_TRANSIT, "Cannot ship product already in transit.");

        sourceProduct.quantity -= _quantity;
        
        uint256 newId = productCounter++;
        products[newId] = Product(newId, _sourceProductId, sourceProduct.name, _quantity, sourceProduct.unit, State.IN_TRANSIT, msg.sender, _destination, new HistoryEvent[](0));
        
        _addHistory(newId, string.concat("Split from Product #", uint2str(_sourceProductId)));
        _addHistory(_sourceProductId, string.concat("Split ", uint2str(_quantity), " ", sourceProduct.unit, " into new Product #", uint2str(newId)));

        emit ProductCreated(newId, _sourceProductId, sourceProduct.name, _quantity);
        emit ProductShipped(newId, _destination);
    }

    function receiveProduct(uint256 _productId) public override(ICollectionPoint, IWarehouse, IProcessingUnit, IRetailer) {
        Product storage p = products[_productId];
        require(p.destinationAddress == msg.sender, "Caller is not the destination.");
        require(p.currentState == State.IN_TRANSIT, "Product not in transit.");

        p.currentOwner = msg.sender;
        p.destinationAddress = address(0);

        Role receiverRole = roles[msg.sender];
        if (receiverRole == Role.COLLECTION_POINT) p.currentState = State.AT_COLLECTION_POINT;
        else if (receiverRole == Role.WAREHOUSE) p.currentState = State.AT_WAREHOUSE;
        else if (receiverRole == Role.PROCESSING_UNIT) p.currentState = State.AT_PROCESSING_UNIT;
        else if (receiverRole == Role.RETAILER) p.currentState = State.AT_RETAILER;
        else revert("Invalid receiver role.");
        
        _addHistory(_productId, "Received by new owner");
        emit ProductReceived(_productId, msg.sender);
        emit ProductStateChanged(_productId, p.currentState);
    }

    // --- Retailer-only action: sell a quantity of a product ---
    function sellProduct(uint256 _sourceProductId, uint256 _quantityToSell) public override onlyRole(Role.RETAILER) {
        Product storage p = products[_sourceProductId];
        require(p.currentOwner == msg.sender, "Caller is not owner of product.");
        require(p.currentState == State.AT_RETAILER, "Product not at retailer.");
        require(p.quantity >= _quantityToSell, "Insufficient quantity to sell.");

        p.quantity -= _quantityToSell;

        _addHistory(_sourceProductId, string.concat("Sold ", uint2str(_quantityToSell), " ", p.unit));

        if (p.quantity == 0) {
            p.currentState = State.SOLD;
            emit ProductStateChanged(_sourceProductId, p.currentState);
        }
    }
    
    function processProduct(
        uint256 _sourceProductId,
        uint256 _quantityToProcess,
        string memory _newProductName,
        uint256 _newQuantity,
        string memory _newUnit
    ) public override onlyRole(Role.PROCESSING_UNIT) {
        Product storage sourceProduct = products[_sourceProductId];
        require(sourceProduct.currentOwner == msg.sender, "Caller is not the owner.");
        require(sourceProduct.currentState == State.AT_PROCESSING_UNIT, "Product not at processing unit.");
        require(sourceProduct.quantity >= _quantityToProcess, "Insufficient quantity to process.");

        sourceProduct.quantity -= _quantityToProcess;

        uint256 newId = productCounter++;
        products[newId] = Product(newId, _sourceProductId, _newProductName, _newQuantity, _newUnit, State.AT_PROCESSING_UNIT, msg.sender, address(0), new HistoryEvent[](0));
        
        string memory sourceHistoryDetails = string.concat("Processed ", uint2str(_quantityToProcess), " ", sourceProduct.unit, " into new Product #", uint2str(newId), " (", _newProductName, ")");
        _addHistory(_sourceProductId, sourceHistoryDetails);

        string memory newHistoryDetails = string.concat("Created from processing Product #", uint2str(_sourceProductId));
        _addHistory(newId, newHistoryDetails);

        if (sourceProduct.quantity == 0) {
            sourceProduct.currentState = State.PROCESSED;
            emit ProductStateChanged(_sourceProductId, State.PROCESSED);
        }
        
        emit ProductCreated(newId, _sourceProductId, _newProductName, _newQuantity);
    }

    function processWithRecipe(
        uint256[] memory _ingredientProductIds,
        uint256[] memory _ingredientQuantitiesToUse,
        string memory _newProductName,
        uint256 _newQuantity,
        string memory _newUnit
    ) public onlyRole(Role.PROCESSING_UNIT) {
        require(_ingredientProductIds.length > 0, "Must provide at least one ingredient.");
        require(_ingredientProductIds.length == _ingredientQuantitiesToUse.length, "Mismatched ingredient data.");

        string memory historySourceIds = "";

        for (uint i = 0; i < _ingredientProductIds.length; i++) {
            uint256 currentId = _ingredientProductIds[i];
            Product storage ingredient = products[currentId];

            require(ingredient.currentOwner == msg.sender, "Caller is not the owner of all ingredients.");
            require(ingredient.quantity >= _ingredientQuantitiesToUse[i], "Insufficient quantity for an ingredient.");

            ingredient.quantity -= _ingredientQuantitiesToUse[i];
            historySourceIds = string.concat(historySourceIds, "#", uint2str(currentId), " ");

            if (ingredient.quantity == 0) {
                ingredient.currentState = State.PROCESSED;
                emit ProductStateChanged(currentId, State.PROCESSED);
            }
        }

        uint256 newId = productCounter++;
        products[newId] = Product(newId, 0, _newProductName, _newQuantity, _newUnit, State.AT_PROCESSING_UNIT, msg.sender, address(0), new HistoryEvent[](0));
        
        string memory newHistoryDetails = string.concat("Created from processing ingredients: ", historySourceIds);
        _addHistory(newId, newHistoryDetails);
        
        emit ProductCreated(newId, 0, _newProductName, _newQuantity);
    }

    // --- Insurance Claim Functions Start ---

    // Original function - farm files their own claim
    function fileInsuranceClaim(
        string memory _sensorType,
        string memory _sensorValue
    ) public override onlyRole(Role.FARM) {
        uint256 id = claimCounter++;
        
        insuranceClaims[id] = InsuranceClaim(
            id,
            msg.sender,
            _sensorType,
            _sensorValue,
            block.timestamp,
            "Filed"
        );

        claimsByFarmer[msg.sender].push(id);

        emit InsuranceClaimFiled(id, msg.sender, _sensorType, _sensorValue, block.timestamp);
    }

    // --- NEW: Service account files claim on behalf of a farm ---
    function fileInsuranceClaimFor(
        address _farmAddress,
        string memory _sensorType,
        string memory _sensorValue
    ) public onlySensorService {
        require(roles[_farmAddress] == Role.FARM, "Target address is not a registered farm");
        
        uint256 id = claimCounter++;
        
        insuranceClaims[id] = InsuranceClaim(
            id,
            _farmAddress,
            _sensorType,
            _sensorValue,
            block.timestamp,
            "Filed"
        );

        claimsByFarmer[_farmAddress].push(id);

        emit InsuranceClaimFiled(id, _farmAddress, _sensorType, _sensorValue, block.timestamp);
    }

    function getClaimsByFarmer(address _farmerAddress) external view returns (InsuranceClaim[] memory) {
        uint256[] memory claimIds = claimsByFarmer[_farmerAddress];
        InsuranceClaim[] memory claims = new InsuranceClaim[](claimIds.length);

        for (uint i = 0; i < claimIds.length; i++) {
            claims[i] = insuranceClaims[claimIds[i]];
        }

        return claims;
    }

    // --- Insurance Claim Functions End ---

    function _addHistory(uint256 _productId, string memory _details) internal {
        products[_productId].history.push(HistoryEvent(msg.sender, roles[msg.sender], block.timestamp, _details));
    }

    function uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) return "0";
        uint j = _i;
        uint len;
        while (j != 0) { len++; j /= 10; }
        bytes memory bstr = new bytes(len);
        uint k = len;
        while (_i != 0) { k = k-1; uint8 temp = (48 + uint8(_i - _i / 10 * 10)); bstr[k] = bytes1(temp); _i /= 10; }
        return string(bstr);
    }

    function getProduct(uint256 _productId) external view returns (Product memory) {
        return products[_productId];
    }

    function getActorProfile(address _actorAddress) external view returns (ActorProfile memory) {
        return actorProfiles[_actorAddress];
    }
}