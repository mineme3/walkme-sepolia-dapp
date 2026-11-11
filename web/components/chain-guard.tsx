"use client";

import { useConnection, useSwitchChain } from "wagmi";
import { targetChain } from "@/lib/chain";
import { useMounted } from "@/lib/use-mounted";

export function ChainGuard({ children }: { children: React.ReactNode }) {
  const mounted = useMounted();
  const { isConnected, chainId } = useConnection();
  const switchChain = useSwitchChain();
  const wrongChain = mounted && isConnected && chainId !== targetChain.id;

  if (!wrongChain) return <>{children}</>;

  return (
    <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-6 text-center">
      <p className="mb-3 text-sm text-amber-100">
        Your wallet is on the wrong network. WalkMe runs on {targetChain.name}.
      </p>
      <button
        disabled={switchChain.isPending}
        onClick={() => switchChain.mutate({ chainId: targetChain.id })}
        className="rounded-full bg-amber-300 px-5 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-200 disabled:opacity-60"
      >
        {switchChain.isPending ? "Check your wallet…" : `Switch to ${targetChain.name}`}
      </button>
    </div>
  );
}
