const fs = require('fs');

const abiJson = JSON.parse(fs.readFileSync('D:/amalsh/solidity-supplychain/artifacts/contracts/SupplyChain.sol/SupplyChain.json', 'utf8'));
const abiStr = JSON.stringify(abiJson.abi, null, 2);

let config = fs.readFileSync('D:/amalsh/supplychain-Internship-main/lib/contract-config.js', 'utf8');

// Replace the contract address
config = config.replace(/export const DEFAULT_CONTRACT_ADDRESS = ".*?";/, 'export const DEFAULT_CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";');

// Replace the ABI array
// We find "export const supplyChainAbi = [" and then we replace from there to the closing "];"
const startIdx = config.indexOf('export const supplyChainAbi = [');
if (startIdx !== -1) {
    const endStr = '];\n';
    let endIdx = config.indexOf(endStr, startIdx);

    // Fallback if formatting differs
    if (endIdx === -1) {
        endIdx = config.indexOf('];', startIdx);
    }

    if (endIdx !== -1) {
        const replacement = 'export const supplyChainAbi = ' + abiStr + ';';
        config = config.substring(0, startIdx) + replacement + config.substring(endIdx + 2);
    }
}

fs.writeFileSync('D:/amalsh/supplychain-Internship-main/lib/contract-config.js', config);
console.log('Contract config updated successfully.');
