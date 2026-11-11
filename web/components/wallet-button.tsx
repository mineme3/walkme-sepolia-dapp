"use client";

import { useConnect, useConnection, useConnectors, useDisconnect } from "wagmi";
import { explainError } from "@/lib/errors";
import { useMounted } from "@/lib/use-mounted";

export function WalletButton() {
  const mounted = useMounted();
  const { address, isConnected } = useConnection();
  const connectors = useConnectors();
  const connect = useConnect();
  const disconnect = useDisconnect();

  if (!mounted) {
    return <span className="h-10 w-36 animate-pulse rounded-full bg-white/5" />;
  }

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect.mutate()}
        className="rounded-full border border-white/15 bg-white/5 px-4 py-2 font-mono text-sm text-zinc-200 transition hover:bg-white/10"
      >
        {address.slice(0, 6)}…{address.slice(-4)} · Disconnect
      </button>
    );
  }

  const injected = connectors[0];

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        disabled={connect.isPending || !injected}
        onClick={() => injected && connect.mutate({ connector: injected })}
        className="rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-300 disabled:opacity-60"
      >
        {connect.isPending ? "Check your wallet…" : "Connect wallet"}
      </button>
      {connect.error && (
        <p role="alert" className="max-w-64 text-right text-xs text-red-300">
          {/no provider|not found/i.test(connect.error.message)
            ? "No browser wallet found. Install MetaMask."
            : explainError(connect.error)}
        </p>
      )}
    </div>
  );
}
