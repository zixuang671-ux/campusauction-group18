import { defineConfig, configVariable } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import "dotenv/config";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  solidity: "0.8.28",
  networks: {
    hardhat: {
      type: "edr-simulated",
      mining: { auto: true, interval: 1000 },
    },
    localhost: {
      type: "http",
      url: "http://127.0.0.1:8545",
    },
    sepolia: {
      type: "http",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("PRIVATE_KEY")],
      chainId: 11155111,
    },
  },
});
