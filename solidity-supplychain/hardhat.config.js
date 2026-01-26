import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";

dotenv.config();

/** @type import('hardhat/config').HardhatUserConfig */
export default {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { // <-- ADD THIS WHOLE BLOCK
        enabled: true,
        runs: 200,
      },
      viaIR: true, 
    },
  },
  networks: {
    besu_private_net: {
      url: "http://localhost:8545",
      accounts: [process.env.PRIVATE_KEY_OWNER],
      chainId: 1337,
    },
  },
};