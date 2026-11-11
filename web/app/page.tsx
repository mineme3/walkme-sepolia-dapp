import { ChainGuard } from "@/components/chain-guard";
import { Dashboard } from "@/components/dashboard";
import { WalletButton } from "@/components/wallet-button";
import { targetChain } from "@/lib/chain";
import { contractAddress } from "@/lib/contract";

export default function Home() {
  const explorer = targetChain.blockExplorers?.default.url;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8 sm:py-12">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-emerald-400 text-lg font-black text-emerald-950">
            W
          </span>
          <div>
            <p className="text-lg font-semibold tracking-tight text-zinc-50">WalkMe</p>
            <p className="text-xs text-zinc-500">walk. earn. on-chain.</p>
          </div>
        </div>
        <WalletButton />
      </header>

      <section className="py-12 sm:py-16">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-3 py-1 text-xs text-emerald-300">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          Verified steps, capped emissions
        </span>
        <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-zinc-50 sm:text-6xl">
          Walk. Get paid.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-400">
          Sync your steps, receive WALK. A verifier signs your daily count, the contract checks it,
          and every claim is recorded on {targetChain.name}.
        </p>
      </section>

      <ChainGuard>
        <Dashboard />
      </ChainGuard>

      <footer className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          WalkMe demo · rewards are test tokens, not an investment · no database, no indexer
        </p>
        {explorer ? (
          <a
            href={`${explorer}/address/${contractAddress}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-zinc-400 transition hover:text-emerald-300"
          >
            {contractAddress.slice(0, 6)}…{contractAddress.slice(-4)} ↗
          </a>
        ) : (
          <span className="font-mono text-zinc-600">
            {contractAddress.slice(0, 6)}…{contractAddress.slice(-4)}
          </span>
        )}
      </footer>
    </main>
  );
}
