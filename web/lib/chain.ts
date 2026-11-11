import { defineChain } from "viem";

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 31337);

const PRESETS: Record<number, { name: string; symbol: string; rpc: string; explorer?: string }> = {
  31337: {
    name: "Hardhat Local",
    symbol: "ETH",
    rpc: "http://127.0.0.1:8545",
  },
  11155111: {
    name: "Sepolia",
    symbol: "ETH",
    rpc: "https://ethereum-sepolia-rpc.publicnode.com",
    explorer: "https://sepolia.etherscan.io",
  },
  784: {
    name: "Ritual",
    symbol: "RITUAL",
    rpc: "https://rpc.ritualfoundation.org",
    explorer: "https://explorer.ritualfoundation.org",
  },
};

const preset = PRESETS[chainId] ?? {
  name: `Chain ${chainId}`,
  symbol: "ETH",
  rpc: "http://127.0.0.1:8545",
};

export const targetChain = defineChain({
  id: chainId,
  name: process.env.NEXT_PUBLIC_CHAIN_NAME || preset.name,
  nativeCurrency: { name: preset.symbol, symbol: preset.symbol, decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_RPC_URL || preset.rpc] },
  },
  blockExplorers: preset.explorer
    ? { default: { name: `${preset.name} Explorer`, url: preset.explorer } }
    : undefined,
  testnet: true,
});
