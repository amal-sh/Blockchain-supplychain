const hre = require("hardhat");
require("dotenv").config();

/**
 * This script sets up the sensor service account after contract deployment.
 * Run this AFTER deploying the SupplyChain contract.
 * 
 * Usage:
 *   npx hardhat run scripts/setup-service-account.js --network besu_private_net
 */

async function main() {
  // Get the deployed contract address
  const contractAddress = process.env.CONTRACT_ADDRESS;
  
  if (!contractAddress) {
    console.error("❌ CONTRACT_ADDRESS not found in .env file");
    console.log("Please add: CONTRACT_ADDRESS=0x...");
    process.exit(1);
  }

  // Get the service account address from env
  const serviceAccountPrivateKey = process.env.SENSOR_SERVICE_PRIVATE_KEY;
  
  if (!serviceAccountPrivateKey) {
    console.error("❌ SENSOR_SERVICE_PRIVATE_KEY not found in .env file");
    console.log("Please generate a new wallet and add its private key to .env");
    process.exit(1);
  }

  // Create wallet from private key
  const serviceWallet = new hre.ethers.Wallet(serviceAccountPrivateKey, hre.ethers.provider);
  const serviceAccountAddress = serviceWallet.address;

  console.log("\n=== Setting Up Sensor Service Account ===\n");
  console.log("Contract Address:", contractAddress);
  console.log("Service Account Address:", serviceAccountAddress);
  console.log("\n");

  // Get the contract instance
  const SupplyChain = await hre.ethers.getContractFactory("SupplyChain");
  const contract = await SupplyChain.attach(contractAddress);

  // Check if caller is the owner
  const owner = await contract.owner();
  const [signer] = await hre.ethers.getSigners();
  
  console.log("Contract Owner:", owner);
  console.log("Current Signer:", signer.address);
  
  if (signer.address.toLowerCase() !== owner.toLowerCase()) {
    console.error("\n❌ You are not the contract owner!");
    console.log("Only the contract owner can set the service account.");
    console.log("Please use the owner's wallet to run this script.");
    process.exit(1);
  }

  // Set the service account
  console.log("\n📝 Setting service account...");
  const tx = await contract.setSensorServiceAccount(serviceAccountAddress);
  
  console.log("Transaction submitted. Waiting for confirmation...");
  console.log("TX Hash:", tx.hash);
  
  const receipt = await tx.wait();
  
  console.log("\n✅ Service account successfully registered!");
  console.log("Block Number:", receipt.blockNumber);
  console.log("Gas Used:", receipt.gasUsed.toString());

  // Verify the service account was set correctly
  const registeredServiceAccount = await contract.sensorServiceAccount();
  
  console.log("\n=== Verification ===");
  console.log("Registered Service Account:", registeredServiceAccount);
  console.log("Expected:", serviceAccountAddress);
  console.log("Match:", registeredServiceAccount.toLowerCase() === serviceAccountAddress.toLowerCase() ? "✅ YES" : "❌ NO");

  console.log("\n=== Setup Complete ===");
  console.log("The sensor service can now file insurance claims on behalf of farms.");
  console.log("\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });