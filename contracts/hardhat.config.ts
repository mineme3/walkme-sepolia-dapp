import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    version: "0.8.28",
  },
  networks: {
    // `npx hardhat node` serves this chain at http://127.0.0.1:8545 (chain id 31337)
    localhost: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:8545",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
    // Optional: Ritual Chain (chain id 784). Same contract, no changes needed.
    ritual: {
      type: "http",
      chainType: "l1",
      url: configVariable("RITUAL_RPC_URL"),
      accounts: [configVariable("RITUAL_PRIVATE_KEY")],
    },
  },
});
