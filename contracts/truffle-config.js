// Truffle config for AcademicCertification deployment.
// Supports Polygon Amoy using either PRIVATE_KEY or MNEMONIC from .env.
require("dotenv").config();

const HDWalletProvider = require("@truffle/hdwallet-provider");

const {
  MNEMONIC = "",
  PRIVATE_KEY = "",
  RPC_URL = "",
  POLYGONSCAN_API_KEY = ""
} = process.env;

const buildAmoyProvider = () => {
  if (!RPC_URL) {
    throw new Error("Set RPC_URL in contracts/.env");
  }

  if (PRIVATE_KEY) {
    const normalizedPrivateKey = PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;

    return new HDWalletProvider({
      privateKeys: [normalizedPrivateKey],
      providerOrUrl: RPC_URL
    });
  }

  if (MNEMONIC) {
    return new HDWalletProvider({
      mnemonic: {
        phrase: MNEMONIC
      },
      providerOrUrl: RPC_URL
    });
  }

  throw new Error("Set PRIVATE_KEY or MNEMONIC in contracts/.env");
};

module.exports = {
  networks: {
    // Local network (commonly used by Truffle/Ganache CLI)
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*"
    },
    // Local Ganache UI default port
    development7545: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*"
    },
    //Polygon Amoy testnet
    polygonAmoy: {
      provider: () => buildAmoyProvider(),
      network_id: 80002,
      confirmations: 2,
      timeoutBlocks: 500,
      networkCheckTimeout: 100000,
      skipDryRun: true,
      maxPriorityFeePerGas: 25000000000,
      maxFeePerGas: 26000000000,
      gas: 6000000
    }
  },
  compilers: {
    solc: {
      version: "0.8.21",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  },
  api_keys: {
    polygonscan: POLYGONSCAN_API_KEY
  }
};
