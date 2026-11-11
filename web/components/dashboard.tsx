"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatEther } from "viem";
import {
  useConnection,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { targetChain } from "@/lib/chain";
import { contractAddress, isContractConfigured, walkMeAbi } from "@/lib/contract";
import { explainError } from "@/lib/errors";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-zinc-50">{value}</p>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

function short(value: bigint) {
  const n = Number(formatEther(value));
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function Dashboard() {
  const { address, isConnected } = useConnection();
  const queryClient = useQueryClient();
  const [steps, setSteps] = useState("8500");
  const [attestError, setAttestError] = useState<string>();

  const enabled = isContractConfigured;
  const reads = { address: contractAddress, abi: walkMeAbi } as const;

  const todayRead = useReadContract({
    ...reads,
    functionName: "today",
    query: { enabled, refetchInterval: 15_000 },
  });

  const balanceRead = useReadContract({
    ...reads,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: enabled && !!address, refetchInterval: 5_000 },
  });

  const capRead = useReadContract({
    ...reads,
    functionName: "dailyStepCap",
    query: { enabled },
  });

  const rateRead = useReadContract({
    ...reads,
    functionName: "rewardPerKilo",
    query: { enabled },
  });

  const lifetimeRead = useReadContract({
    ...reads,
    functionName: "totalSteps",
    args: address ? [address] : undefined,
    query: { enabled: enabled && !!address, refetchInterval: 5_000 },
  });

  const todayStepsRead = useReadContract({
    ...reads,
    functionName: "stepsByDay",
    args: address && todayRead.data !== undefined ? [address, todayRead.data] : undefined,
    query: {
      enabled: enabled && !!address && todayRead.data !== undefined,
      refetchInterval: 4_000,
    },
  });

  const supplyRead = useReadContract({
    ...reads,
    functionName: "totalSupply",
    query: { enabled, refetchInterval: 15_000 },
  });

  const maxSupplyRead = useReadContract({
    ...reads,
    functionName: "MAX_SUPPLY",
    query: { enabled },
  });

  const write = useWriteContract();
  const receipt = useWaitForTransactionReceipt({
    hash: write.data,
    chainId: targetChain.id,
  });

  useEffect(() => {
    if (receipt.isSuccess) void queryClient.invalidateQueries();
  }, [receipt.isSuccess, queryClient]);

  const cap = capRead.data ?? 20_000n;
  const rate = rateRead.data ?? 10n * 10n ** 18n;
  const claimedSteps = todayStepsRead.data ?? 0n;
  const claimedToday = claimedSteps > 0n;

  const rewardFor = (s: bigint) => (s > cap ? cap : s) * rate / 1000n;

  const parsedSteps = useMemo(() => {
    const n = Number(steps);
    if (!Number.isFinite(n) || n <= 0) return 0n;
    return BigInt(Math.floor(n));
  }, [steps]);

  const previewReward = rewardFor(parsedSteps);
  const busy = write.isPending || receipt.isLoading;
  const syncing = busy;
  const error = write.error ?? receipt.error;

  async function onSync(event: React.FormEvent) {
    event.preventDefault();
    if (!address || parsedSteps <= 0n) return;

    write.reset();
    setAttestError(undefined);

    try {
      const response = await fetch("/api/attest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, steps: Number(parsedSteps) }),
      });
      const proof = await response.json();
      if (!response.ok) throw new Error(proof.error ?? "Could not get a step proof");

      write.mutate({
        address: contractAddress,
        abi: walkMeAbi,
        functionName: "submitSteps",
        args: [BigInt(proof.steps), BigInt(proof.day), proof.signature],
      });
    } catch (err) {
      setAttestError(err instanceof Error ? err.message : "Could not sync steps");
    }
  }

  if (!enabled) {
    return (
      <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-6 text-sm text-amber-100">
        <p className="font-semibold">Contract address not configured.</p>
        <p className="mt-1 text-amber-100/80">
          Deploy the contract, then set <code className="font-mono">NEXT_PUBLIC_CONTRACT_ADDRESS</code> in{" "}
          <code className="font-mono">web/.env.local</code> and restart the dev server.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Your WALK"
          value={isConnected && balanceRead.data !== undefined ? short(balanceRead.data) : "—"}
          hint="Reward token balance"
        />
        <Stat
          label="Steps today"
          value={isConnected && claimedToday ? Number(claimedSteps).toLocaleString() : isConnected ? "Not synced" : "—"}
          hint={isConnected && claimedToday ? `${short(rewardFor(claimedSteps))} WALK earned` : "One claim per UTC day"}
        />
        <Stat
          label="Lifetime steps"
          value={isConnected && lifetimeRead.data !== undefined ? Number(lifetimeRead.data).toLocaleString() : "—"}
          hint="Across all synced days"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <form
          onSubmit={onSync}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-50">Sync today&apos;s steps</h2>
              <p className="mt-1 text-sm text-zinc-400">
                The attestation service signs your step count, then the contract mints your reward.
              </p>
            </div>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
              {targetChain.name}
            </span>
          </div>

          <label htmlFor="steps" className="mt-6 block text-xs uppercase tracking-widest text-zinc-500">
            Steps to claim
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="steps"
              type="number"
              min={1}
              max={50_000}
              value={steps}
              onChange={(event) => setSteps(event.target.value)}
              disabled={!isConnected || syncing || claimedToday}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-lg text-zinc-50 outline-none transition focus:border-emerald-400/60 disabled:opacity-50"
            />
            {[5_000, 8_500, 15_000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setSteps(String(preset))}
                disabled={!isConnected || syncing || claimedToday}
                className="hidden rounded-xl border border-white/10 px-3 text-xs text-zinc-400 transition hover:bg-white/5 disabled:opacity-40 sm:block"
              >
                {preset / 1000}k
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-zinc-500">Reward</span>
            <span className="font-mono text-emerald-300">{short(previewReward)} WALK</span>
          </div>

          <button
            type="submit"
            disabled={!isConnected || syncing || claimedToday || parsedSteps <= 0n}
            className="mt-5 w-full rounded-xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {!isConnected
              ? "Connect your wallet first"
              : claimedToday
                ? "Already claimed today"
                : write.isPending
                  ? "Confirm in wallet…"
                  : receipt.isLoading
                    ? "Waiting for block…"
                    : "Sync & claim WALK"}
          </button>

          <div className="mt-3 min-h-5 text-xs">
            {attestError && (
              <p role="alert" className="text-red-300">
                {attestError}
              </p>
            )}
            {!attestError && isConnected && error && (
              <p role="alert" className="text-red-300">
                {explainError(error)}
              </p>
            )}
            {!attestError && !error && receipt.isSuccess && (
              <p className="text-emerald-300">Claimed. WALK was minted to your wallet.</p>
            )}
            {!attestError && !error && !receipt.isSuccess && isConnected && !claimedToday && (
              <p className="text-zinc-500">Dates and rewards are recorded on-chain. No backend database.</p>
            )}
          </div>
        </form>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Reward rules</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-400">Rate</dt>
                <dd className="font-mono text-zinc-100">{short(rate)} WALK / 1k steps</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-400">Daily counted cap</dt>
                <dd className="font-mono text-zinc-100">{Number(cap).toLocaleString()} steps</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-400">Emitted</dt>
                <dd className="font-mono text-zinc-100">
                  {supplyRead.data !== undefined ? short(supplyRead.data) : "—"}
                  {maxSupplyRead.data !== undefined ? ` / ${short(maxSupplyRead.data)}` : ""}
                </dd>
              </div>
            </dl>
            <p className="mt-4 border-t border-white/10 pt-4 text-xs leading-relaxed text-zinc-500">
              Extra steps are recorded but not rewarded past the daily cap. Supply is hard-capped, so
              emissions cannot grow forever.
            </p>
          </div>

          {claimedToday && (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5 text-sm text-emerald-100">
              Today&apos;s claim is in: <span className="font-semibold">{Number(claimedSteps).toLocaleString()} steps</span>{" "}
              → <span className="font-semibold">{short(rewardFor(claimedSteps))} WALK</span>.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
