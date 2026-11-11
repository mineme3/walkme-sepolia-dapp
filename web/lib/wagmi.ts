import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { targetChain } from "./chain";

export const wagmiConfig = createConfig({
  chains: [targetChain],
  connectors: [injected()],
  transports: {
    [targetChain.id]: http(),
  },
  ssr: true,
});
