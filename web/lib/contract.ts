import type { Address } from "viem";
import { walkMeAbi } from "./walkMeAbi";

export { walkMeAbi };

const configured = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "";
const ZERO = "0x0000000000000000000000000000000000000000";

export const contractAddress = configured as Address;
export const isContractConfigured =
  /^0x[0-9a-fA-F]{40}$/.test(configured) && configured.toLowerCase() !== ZERO;
