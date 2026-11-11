# WalkMe — move-to-earn, kept simple

WalkMe pays you in `WALK` for verified steps. A verifier signs a daily step
proof, the contract checks it on-chain, and the reward is minted with a per-day
cap and a hard supply ceiling.

```
contracts/   Hardhat 3 + Solidity 0.8.28 + Ignition
web/         Next.js (App Router) + wagmi + viem
```

## How it works

1. The web app asks the attestation route for today's proof.
2. `/api/attest` signs an EIP-712 `StepProof(user, day, steps)` with the verifier key.
3. The user submits the proof to `WalkMe.submitSteps(steps, day, signature)`.
4. The contract verifies the signature, records the steps, and mints `WALK`:
   `reward = min(steps, 20 000) * 10 WALK / 1 000`.
5. One claim per wallet per UTC day; supply is capped at 21,000,000 WALK.

No database, no indexer, no wearable OAuth in v1. The demo sync button stands in
for a real activity source; swapping in Strava/Google Fit only changes
`web/app/api/attest/route.ts`, never the contract.

## Live deployment (Sepolia)

- **Contract:** [`0x407A4b2eD56034c57b0473e450FEf88cbF6e9da3`](https://sepolia.etherscan.io/address/0x407A4b2eD56034c57b0473e450FEf88cbF6e9da3)
- **Chain:** Sepolia (11155111)
- **RPC:** `https://ethereum-sepolia-rpc.publicnode.com`
- **Web config:** already set in `web/.env.local`

Run the app:

```bash
cd web && npm run dev
```

Connect MetaMask on Sepolia. The deployer account has already claimed for today, so use
a different account to demo a fresh claim (it only needs a little Sepolia ETH for gas).

## Deploy the frontend to Vercel

The Next.js app lives in `web/`. When importing the repo into Vercel, set
**Root Directory** to `web` (Project → Settings → General). No other build
settings are needed — Vercel detects Next.js automatically.

Add these environment variables (Project → Settings → Environment Variables),
for **Production**, **Preview**, and **Development**:

| Variable | Value | Exposed to browser? |
|---|---|---|
| `NEXT_PUBLIC_CHAIN_ID` | `11155111` | Yes |
| `NEXT_PUBLIC_CHAIN_NAME` | `Sepolia` | Yes |
| `NEXT_PUBLIC_RPC_URL` | a Sepolia RPC URL | Yes |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | `0x407A4b2eD56034c57b0473e450FEf88cbF6e9da3` | Yes |
| `VERIFIER_PRIVATE_KEY` | the verifier key | **No — server-only** |

```bash
# CLI alternative
npx vercel --cwd web          # preview
npx vercel --prod --cwd web   # production
```

Two things to remember:

- `NEXT_PUBLIC_*` values are inlined at build time. Changing one requires a
  **redeploy**, not just an env edit.
- `VERIFIER_PRIVATE_KEY` must match the contract's `verifier`, or every claim
  reverts with `InvalidSignature`. If it is missing, `POST /api/attest` returns
  a config error instead of signing.

The public RPC is fine for a demo. For anything real, use a dedicated provider
(Alchemy/Infura) so `/api/attest` and wallet reads do not get rate-limited.

## Run it locally

Terminal 1 — local chain:

```bash
cd contracts
npm install
npm run node
```

Terminal 2 — deploy + export ABI:

```bash
cd contracts
npm run deploy:local
npm run export-abi
```

Copy the printed address into `web/.env.local`:

```bash
cd web
cp .env.local.example .env.local
# set NEXT_PUBLIC_CONTRACT_ADDRESS to the deployed address
# set VERIFIER_PRIVATE_KEY to Hardhat account #0's private key (printed by `npm run node`)
npm run dev
```

Open http://localhost:3000, add the local network in MetaMask
(`http://127.0.0.1:8545`, chain ID `31337`), import a test account, connect.

## Deploy to Sepolia

```bash
cd contracts
npx hardhat keystore set SEPOLIA_RPC_URL
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
npm test
npm run deploy:sepolia
npm run export-abi
```

Then update `web/.env.local` (chain `11155111`, the new address and RPC URL).
The deployer is also the verifier, so `VERIFIER_PRIVATE_KEY` must be the
deployer key for the demo. For a real launch, deploy with a dedicated verifier
address and keep that key only on the server.

## Tests

```bash
cd contracts && npm test
cd web && npm run build
```

## Trust model

Steps are only as trustworthy as the attestation. v1 uses a server-held verifier
key (fine for a demo, and the contract does not care where the signature came
from). Production would verify a real activity API or device attestation before
signing. The on-chain guarantees — one claim per day, caps, supply ceiling,
signature check — stay the same either way.

## Ritual Chain

The contract is plain EVM and deploys unchanged to Ritual (chain 784):

```bash
npx hardhat keystore set RITUAL_RPC_URL
npx hardhat keystore set RITUAL_PRIVATE_KEY
npm pkg set scripts.deploy:ritual="hardhat ignition deploy ignition/modules/WalkMe.ts --network ritual"
npm run deploy:ritual
```

Set `NEXT_PUBLIC_CHAIN_ID=784`, `NEXT_PUBLIC_RPC_URL=https://rpc.ritualfoundation.org`
and `NEXT_PUBLIC_CHAIN_NAME=Ritual` in `web/.env.local`. No code changes.
