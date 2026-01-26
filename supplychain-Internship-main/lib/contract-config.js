// lib/contract-config.js

// TODO: set REACT_APP_CONTRACT_ADDRESS to your deployed SupplyChain contract address.
// Fallback to the existing default (common Hardhat default used in many dev setups).
export const DEFAULT_CONTRACT_ADDRESS = "0x12051CBdEB2E8d61A084EA52D24d9d03057114d1";
export const contractAddress = process.env.REACT_APP_CONTRACT_ADDRESS || DEFAULT_CONTRACT_ADDRESS;

/**
 * Ensure there's contract bytecode at the configured address.
 * Call this before interacting with view/nonpayable methods to get a clearer error.
 * Usage example (caller must provide an ethers Provider):
 *   await assertContractDeployed(provider);
 */
export async function assertContractDeployed(provider, address = contractAddress) {
	// provider: ethers.providers.Provider (or any object with getCode)
	const code = await provider.getCode(address);
	if (!code || code === "0x" || code === "0x0") {
		throw new Error(
			`No contract found at ${address} (provider.getCode returned ${code}). ` +
			`Check you are connected to the correct network and that REACT_APP_CONTRACT_ADDRESS is set to the deployed address. ` +
			`This is the usual cause of "could not decode result data (value=\"0x\")" errors.`
		);
	}
	return true;
}

export const supplyChainAbi = [
      {
      "inputs": [],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "claimId",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "claimant",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "sensorType",
          "type": "string"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "sensorValue",
          "type": "string"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "timestamp",
          "type": "uint256"
        }
      ],
      "name": "InsuranceClaimFiled",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "productId",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "parentProductId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "name",
          "type": "string"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "quantity",
          "type": "uint256"
        }
      ],
      "name": "ProductCreated",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "productId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "receiver",
          "type": "address"
        }
      ],
      "name": "ProductReceived",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "productId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "destination",
          "type": "address"
        }
      ],
      "name": "ProductShipped",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "productId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "enum Products.State",
          "name": "newState",
          "type": "uint8"
        }
      ],
      "name": "ProductStateChanged",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "actor",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "name",
          "type": "string"
        }
      ],
      "name": "ProfileUpdated",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "actor",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "enum Roles.Role",
          "name": "role",
          "type": "uint8"
        }
      ],
      "name": "RoleGranted",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "oldAccount",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "newAccount",
          "type": "address"
        }
      ],
      "name": "SensorServiceAccountUpdated",
      "type": "event"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "actorProfiles",
      "outputs": [
        {
          "internalType": "string",
          "name": "name",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "phone",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "locationCoordinates",
          "type": "string"
        },
        {
          "internalType": "bool",
          "name": "isCreated",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_farmAddress",
          "type": "address"
        },
        {
          "internalType": "string",
          "name": "_name",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "_phone",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "_locationCoordinates",
          "type": "string"
        }
      ],
      "name": "addFarmAndProfile",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "_name",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "_phone",
          "type": "string"
        }
      ],
      "name": "claimAdminRole",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "_name",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "_phone",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "_locationCoordinates",
          "type": "string"
        }
      ],
      "name": "claimCollectionPointRole",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "_name",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "_phone",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "_locationCoordinates",
          "type": "string"
        }
      ],
      "name": "claimProcessingUnitRole",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "_name",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "_phone",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "_locationCoordinates",
          "type": "string"
        }
      ],
      "name": "claimRetailerRole",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "_name",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "_phone",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "_locationCoordinates",
          "type": "string"
        }
      ],
      "name": "claimWarehouseRole",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "claimsByFarmer",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "_name",
          "type": "string"
        },
        {
          "internalType": "uint256",
          "name": "_quantity",
          "type": "uint256"
        },
        {
          "internalType": "string",
          "name": "_unit",
          "type": "string"
        }
      ],
      "name": "createProduct",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "_sensorType",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "_sensorValue",
          "type": "string"
        }
      ],
      "name": "fileInsuranceClaim",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_farmAddress",
          "type": "address"
        },
        {
          "internalType": "string",
          "name": "_sensorType",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "_sensorValue",
          "type": "string"
        }
      ],
      "name": "fileInsuranceClaimFor",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_actorAddress",
          "type": "address"
        }
      ],
      "name": "getActorProfile",
      "outputs": [
        {
          "components": [
            {
              "internalType": "string",
              "name": "name",
              "type": "string"
            },
            {
              "internalType": "string",
              "name": "phone",
              "type": "string"
            },
            {
              "internalType": "string",
              "name": "locationCoordinates",
              "type": "string"
            },
            {
              "internalType": "bool",
              "name": "isCreated",
              "type": "bool"
            }
          ],
          "internalType": "struct Roles.ActorProfile",
          "name": "",
          "type": "tuple"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_farmerAddress",
          "type": "address"
        }
      ],
      "name": "getClaimsByFarmer",
      "outputs": [
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "claimId",
              "type": "uint256"
            },
            {
              "internalType": "address",
              "name": "claimant",
              "type": "address"
            },
            {
              "internalType": "string",
              "name": "sensorType",
              "type": "string"
            },
            {
              "internalType": "string",
              "name": "sensorValue",
              "type": "string"
            },
            {
              "internalType": "uint256",
              "name": "timestamp",
              "type": "uint256"
            },
            {
              "internalType": "string",
              "name": "status",
              "type": "string"
            }
          ],
          "internalType": "struct SupplyChain.InsuranceClaim[]",
          "name": "",
          "type": "tuple[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_productId",
          "type": "uint256"
        }
      ],
      "name": "getProduct",
      "outputs": [
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "productId",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "parentProductId",
              "type": "uint256"
            },
            {
              "internalType": "string",
              "name": "name",
              "type": "string"
            },
            {
              "internalType": "uint256",
              "name": "quantity",
              "type": "uint256"
            },
            {
              "internalType": "string",
              "name": "unit",
              "type": "string"
            },
            {
              "internalType": "enum Products.State",
              "name": "currentState",
              "type": "uint8"
            },
            {
              "internalType": "address",
              "name": "currentOwner",
              "type": "address"
            },
            {
              "internalType": "address",
              "name": "destinationAddress",
              "type": "address"
            },
            {
              "components": [
                {
                  "internalType": "address",
                  "name": "actor",
                  "type": "address"
                },
                {
                  "internalType": "enum Roles.Role",
                  "name": "actorRole",
                  "type": "uint8"
                },
                {
                  "internalType": "uint256",
                  "name": "timestamp",
                  "type": "uint256"
                },
                {
                  "internalType": "string",
                  "name": "details",
                  "type": "string"
                }
              ],
              "internalType": "struct Products.HistoryEvent[]",
              "name": "history",
              "type": "tuple[]"
            }
          ],
          "internalType": "struct Products.Product",
          "name": "",
          "type": "tuple"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "insuranceClaims",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "claimId",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "claimant",
          "type": "address"
        },
        {
          "internalType": "string",
          "name": "sensorType",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "sensorValue",
          "type": "string"
        },
        {
          "internalType": "uint256",
          "name": "timestamp",
          "type": "uint256"
        },
        {
          "internalType": "string",
          "name": "status",
          "type": "string"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "isRegistered",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "owner",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_sourceProductId",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_quantityToProcess",
          "type": "uint256"
        },
        {
          "internalType": "string",
          "name": "_newProductName",
          "type": "string"
        },
        {
          "internalType": "uint256",
          "name": "_newQuantity",
          "type": "uint256"
        },
        {
          "internalType": "string",
          "name": "_newUnit",
          "type": "string"
        }
      ],
      "name": "processProduct",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256[]",
          "name": "_ingredientProductIds",
          "type": "uint256[]"
        },
        {
          "internalType": "uint256[]",
          "name": "_ingredientQuantitiesToUse",
          "type": "uint256[]"
        },
        {
          "internalType": "string",
          "name": "_newProductName",
          "type": "string"
        },
        {
          "internalType": "uint256",
          "name": "_newQuantity",
          "type": "uint256"
        },
        {
          "internalType": "string",
          "name": "_newUnit",
          "type": "string"
        }
      ],
      "name": "processWithRecipe",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "productCounter",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "products",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "productId",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "parentProductId",
          "type": "uint256"
        },
        {
          "internalType": "string",
          "name": "name",
          "type": "string"
        },
        {
          "internalType": "uint256",
          "name": "quantity",
          "type": "uint256"
        },
        {
          "internalType": "string",
          "name": "unit",
          "type": "string"
        },
        {
          "internalType": "enum Products.State",
          "name": "currentState",
          "type": "uint8"
        },
        {
          "internalType": "address",
          "name": "currentOwner",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "destinationAddress",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_productId",
          "type": "uint256"
        }
      ],
      "name": "receiveProduct",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "roles",
      "outputs": [
        {
          "internalType": "enum Roles.Role",
          "name": "",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_sourceProductId",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_quantityToSell",
          "type": "uint256"
        }
      ],
      "name": "sellProduct",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "sensorServiceAccount",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_serviceAccount",
          "type": "address"
        }
      ],
      "name": "setSensorServiceAccount",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_sourceProductId",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_quantity",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "_destination",
          "type": "address"
        }
      ],
      "name": "splitAndShip",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
];