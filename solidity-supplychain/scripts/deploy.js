import hre from "hardhat";

async function main() {
  console.log("Deploying SupplyChain contract...");

  const supplyChain = await hre.ethers.deployContract("SupplyChain");

  await supplyChain.waitForDeployment();

  console.log(`
    ----------------------------------------------------------------------------------
    SupplyChain Contract deployed successfully!
    Address: ${supplyChain.target}
    
    You can now use this address in your frontend application.
    ----------------------------------------------------------------------------------
  `);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});