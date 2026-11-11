# WalkMe — Full Project Report

**WalkMe pays people in `WALK` tokens for verified daily steps.**

One claim per wallet per day, a per-day reward cap, and a hard supply ceiling — enforced by a smart contract, not by a database.

**Live on Sepolia:** [`0x407A4b2eD56034c57b0473e450FEf88cbF6e9da3`](https://sepolia.etherscan.io/address/0x407A4b2eD56034c57b0473e450FEf88cbF6e9da3)

---

## Table of contents

1. [The problem](#1-the-problem)
2. [Tech stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [The smart contract](#4-the-smart-contract)
5. [The frontend](#5-the-frontend)
6. [Reward economics](#6-reward-economics)
7. [How step verification works](#7-how-step-verification-works)
8. [Security and trust model](#8-security-and-trust-model)
9. [Testing](#9-testing)
10. [Deployment](#10-deployment)
11. [Live proof on Sepolia](#11-live-proof-on-sepolia)
12. [Running the app](#12-running-the-app)
13. [Demo script for judges](#13-demo-script-for-judges)
14. [Limitations and roadmap](#14-limitations-and-roadmap)
15. [Judge Q&A](#15-judge-qa)
16. [Glossary](#16-glossary)

---

## 1. The problem

### 1.1 Fitness apps take the value, users create it

Step trackers, running apps, and wearables collect the most personal data a person produces — activity, heart rate, location, habits — and monetize it through subscriptions, ads, and data deals. The person doing the walking gets a dashboard.

### 1.2 Move-to-earn had the right idea and the wrong economics

STEPN proved people will walk for tokens, then collapsed for three reasons:

| Failure | What happened | WalkMe's answer |
|---|---|---|
| **Purely inflationary rewards** | Tokens were minted without a cap, so emissions outran demand and the price spiraled down. | Fixed rate, per-user daily cap, hard `MAX_SUPPLY`. |
| **Weak activity verification** | Fake GPS, spoofed step data, and bot farms drained the reward pool. | Steps require a verifier signature; one claim per wallet per day; replay-proof. |
| **Pay-to-earn, not move-to-earn** | You had to buy an NFT shoe first, so it became a pyramid with extra steps. | No NFT, no deposit, no staking. Connect a wallet and walk. |

### 1.3 The workable core

> **Pay for verified real-world activity, in a currency whose emission is capped.**

WalkMe implements exactly that, and nothing else.

---

## 2. Tech stack

### 2.1 Contracts

| Piece | Choice | Why |
|---|---|---|
| Language | **Solidity 0.8.28** | Current stable, built-in overflow checks. |
| Framework | **Hardhat 3** | Fast builds, TypeScript config, `node:test` runner. |
| Deployment | **Hardhat Ignition** | Declarative modules, idempotent deployments, saved deployment artifacts per chain. |
| Libraries | **OpenZeppelin Contracts 5** | Audited `ERC20`, `EIP712`, `ECDSA`, `Ownable` instead of hand-rolled crypto. |
| Testing | **Hardhat 3 + viem** | Real signatures, real reverts, no mocks. |

### 2.2 Frontend

| Piece | Choice | Why |
|---|---|---|
| Framework | **Next.js 16 (App Router)** | One repo for UI and the attestation API route. |
| UI | **React 19 + Tailwind 4** | Fast to build, no component library overhead. |
| Wallet | **wagmi 3** | Standard React hooks for connect, chain switching, contract writes. |
| Chain client | **viem 2** | Typed contract reads/writes and EIP-712 signing. |
| Data fetching | **TanStack Query 5** | Caching and refetching for on-chain reads. |

### 2.3 Networks

| Network | Chain ID | Purpose |
|---|---|---|
| Hardhat local | `31337` | Development and tests |
| **Sepolia** | `11155111` | **Public demo (current deployment)** |
| Ritual | `784` | Supported by config; same contract, no changes |

Chain, RPC, and contract address are environment variables. Switching networks is a config change, not a code change.

---

## 3. Architecture

### 3.1 The big picture

```
┌──────────────────────────────┐
│  Browser (Next.js + wagmi)   │
│                              │
│  Connect wallet              │
│  Click "Sync & claim"        │
└───────────┬──────────────────┘
            │ 1. POST /api/attest { address, steps }
            ▼
┌──────────────────────────────┐
│  Next.js API route (server)  │
│                              │
│  Holds VERIFIER_PRIVATE_KEY  │
│  Signs EIP-712 StepProof     │
└───────────┬──────────────────┘
            │ 2. { day, steps, signature }
            ▼
┌──────────────────────────────┐
│  Browser                     │
│  wallet writes transaction   │
└───────────┬──────────────────┘
            │ 3. submitSteps(steps, day, signature)
            ▼
┌──────────────────────────────┐
│  WalkMe contract (Sepolia)   │
│                              │
│  verify signature            │
│  verify day == today         │
│  verify first claim today    │
│  record steps                │
│  mint WALK                   │
└───────────┬──────────────────┘
            │ 4. StepsRecorded event + WALK balance
            ▼
        User's wallet
```

### 3.2 The three layers

| Layer | Responsibility | Trusted? |
|---|---|---|
| **Frontend** | Wallet connection, display, building the transaction | Not trusted — anyone can call the contract directly |
| **Attestation service** | Decides how many steps to sign | Trusted in v1; replaced by real data sources in production |
| **Contract** | Enforces the rules and owns the token | Fully trusted — it is the source of truth |

The key design decision: **the contract does not care where the number came from.** It only checks that the verifier signed it. That means the verification source can be upgraded (manual demo → Strava → HealthKit → zkTLS) without redeploying the token.

### 3.3 On-chain vs off-chain

| On-chain | Off-chain |
|---|---|
| WALK balances and transfers (ERC-20) | The UI |
| Steps per user per UTC day | The activity data source |
| Reward rate, daily cap, supply ceiling | The attestation service and its key |
| Signature verification and replay protection | Leaderboards/analytics, if added later |
| `StepsRecorded` events | Images, copy, metadata |

No database. No indexer. The frontend reads the contract directly over RPC.

### 3.4 One claim, step by step

Using the real on-chain test claim:

1. User has wallet `0x71D7…B4cf` and clicks **Sync & claim WALK** with `8500`.
2. Browser sends `POST /api/attest` with `{ address, steps: 8500 }`.
3. Server clamps to 25,000 (no-op here), computes `day = floor(Date.now() / 86_400_000) = 20768`.
4. Server signs the EIP-712 struct `StepProof(user, 20768, 8500)` with the verifier key.
5. Browser calls `submitSteps(8500, 20768, signature)`.
6. Contract checks:
   - `steps != 0` ✅
   - `day == block.timestamp / 1 days` ✅
   - `stepsByDay[user][20768] == 0` ✅
   - recovered signer == `verifier` ✅
7. Contract stores `stepsByDay[user][20768] = 8500`, adds to `totalSteps` and `totalGlobalSteps`.
8. `counted = min(8500, 20000) = 8500`, `reward = 8500 × 10e18 / 1000 = 85e18`.
9. Contract mints **85 WALK** to the user and emits `StepsRecorded`.
10. A second call the same day reverts with `AlreadySubmitted`.

---

## 4. The smart contract

`contracts/contracts/WalkMe.sol` — one contract. It is simultaneously the ERC-20 token, the step registry, and the payout engine.

```solidity
contract WalkMe is ERC20, EIP712, Ownable
```

| Inherited | Gives us |
|---|---|
| `ERC20` | `balanceOf`, `transfer`, `totalSupply`, 18 decimals, symbol `WALK` |
| `EIP712` | Domain-separated typed-data hashing |
| `Ownable` | Owner-only config functions |

### 4.1 State

| Variable | Type | Default | Meaning |
|---|---|---|---|
| `verifier` | `address` | constructor arg | Only address allowed to sign step proofs |
| `rewardPerKilo` | `uint256` | `10e18` | WALK per 1,000 steps |
| `dailyStepCap` | `uint256` | `20_000` | Counted steps per user per day |
| `MAX_SUPPLY` | `constant` | `21_000_000e18` | Hard token ceiling |
| `stepsByDay` | mapping | — | `user → day → steps` |
| `totalSteps` | mapping | — | Lifetime steps per user |
| `totalGlobalSteps` | `uint256` | `0` | Lifetime steps across all users |

### 4.2 Functions

**Reads**

| Function | Meaning |
|---|---|
| `balanceOf(address)` | WALK balance |
| `stepsByDay(address, uint256)` | Steps recorded for a wallet on a day |
| `totalSteps(address)` | Lifetime steps for a wallet |
| `totalGlobalSteps()` | Lifetime steps across all users |
| `verifier()` | Address allowed to sign proofs |
| `rewardPerKilo()` | WALK per 1,000 steps |
| `dailyStepCap()` | Counted steps per user per day |
| `MAX_SUPPLY()` | Hard cap |
| `today()` | Current UTC day number, exactly what `submitSteps` expects |

**Writes**

| Function | Who | Effect |
|---|---|---|
| `submitSteps(steps, day, signature)` | Anyone | Verifies the proof, records steps, mints WALK |
| `setVerifier(address)` | Owner | Rotates the attestation key |
| `setRewardRate(uint256)` | Owner | Changes the reward rate |

### 4.3 Rules and errors

| Rule | Error |
|---|---|
| `steps > 0` | `ZeroSteps` |
| `day == block.timestamp / 1 days` | `DayNotToday` |
| One submission per user per day | `AlreadySubmitted` |
| Signature must recover to `verifier` | `InvalidSignature` |
| Verifier cannot be zero address | `ZeroAddress` |
| Only owner can change config | `OwnableUnauthorizedAccount` |

### 4.4 The EIP-712 proof

```
Domain:  { name: "WalkMe", version: "1", chainId, verifyingContract }
Type:    StepProof(address user, uint256 day, uint256 steps)
```

Why each field matters:

| Field | Stops |
|---|---|
| `user` | Using someone else's proof to claim for yourself |
| `day` | Reusing yesterday's proof today |
| `steps` | Editing the number after signing |
| `chainId` | Replaying on another chain |
| `verifyingContract` | Replaying against a different contract |

Because the contract also enforces one claim per day, replaying even a valid same-day proof is pointless.

### 4.5 Events

```solidity
event StepsRecorded(address indexed user, uint256 indexed day, uint256 steps, uint256 reward);
event VerifierUpdated(address indexed verifier);
event RewardRateUpdated(uint256 rewardPerKilo);
```

`StepsRecorded` is the only event a future indexer or leaderboard needs.

---

## 5. The frontend

```
web/
  app/page.tsx                   Landing page + dashboard layout
  app/api/attest/route.ts        Server-side EIP-712 signer
  components/dashboard.tsx       Stats, sync form, transaction states, errors
  components/wallet-button.tsx   Connect / disconnect
  components/chain-guard.tsx     Wrong-network prompt
  lib/contract.ts                Contract address + ABI
  lib/chain.ts                   Chain definition from env
  lib/wagmi.ts                   wagmi config
  lib/errors.ts                  Human-readable revert messages
  lib/walkMeAbi.ts               Generated ABI
```

### 5.1 Wallet and network guard

- `wagmi` connects any injected wallet (MetaMask, Brave, Rabby…).
- `chain.ts` builds the target chain from `NEXT_PUBLIC_*` env vars, with presets for 31337, 11155111, and 784.
- If the wallet is on the wrong network, the UI blocks the claim and offers **Switch to Sepolia**.

### 5.2 Dashboard reads

All reads go straight to the contract over RPC:

| Display | Contract call |
|---|---|
| WALK balance | `balanceOf(user)` |
| Today's steps | `stepsByDay(user, today())` |
| Lifetime steps | `totalSteps(user)` |
| Global steps | `totalGlobalSteps()` |
| Reward rate / cap | `rewardPerKilo()` / `dailyStepCap()` |

### 5.3 The attestation route

`web/app/api/attest/route.ts`:

```ts
POST /api/attest  { address, steps }
  → clamps steps to 25_000
  → day = floor(Date.now() / 86_400_000)
  → signs StepProof(address, day, steps)
  → 200 { day, steps, signature }
```

- The key comes from `VERIFIER_PRIVATE_KEY` — server-only, never `NEXT_PUBLIC_`.
- Returns 500 with a clear message if the key or contract address is missing.
- Returns 400 for bad JSON, invalid address, or non-positive steps.

### 5.4 Error handling

`lib/errors.ts` maps both revert reasons and wallet/RPC errors to plain English:

| Raw error | Shown to user |
|---|---|
| `AlreadySubmitted` | "You already claimed today." |
| `DayNotToday` | "The day changed. Sync again." |
| `InvalidSignature` | "The step proof was rejected." |
| Code `4100` | "Your wallet hasn't authorized this site. Disconnect, reload, reconnect." |
| User rejection | "Transaction cancelled." |

That last one matters in practice — MetaMask code `4100` is a site-permission problem, not a contract problem, and on Brave it is often the wrong wallet extension answering.

---

## 6. Reward economics

### 6.1 The formula

```
reward = min(steps, 20_000) / 1_000 × 10 WALK
```

### 6.2 Worked examples

| Steps submitted | Counted | WALK minted |
|---|---|---|
| 1,000 | 1,000 | 10 |
| 8,500 | 8,500 | **85** |
| 20,000 | 20,000 | 200 |
| 25,000 | 20,000 | 200 (all 25,000 recorded) |
| 100,000 | 20,000 | 200 |

### 6.3 Parameters

| Parameter | Value | Why |
|---|---|---|
| Reward rate | 10 WALK / 1,000 steps | Simple, readable, adjustable by owner |
| Counted steps | `min(steps, 20,000)` per day | Stops one whale day from draining the pool |
| Max daily reward | 200 WALK per wallet | Bounded upside per user |
| Max supply | 21,000,000 WALK | Emissions cannot grow forever |
| Extra steps | Recorded, not rewarded | Keeps the on-chain record honest |

Exhausting supply takes roughly **105,000 fully-capped user-days**. Supply is a ceiling, not a promise of infinite yield.

There is **no staking, no lock-up, no NFT, and no mechanism that requires new users' money to pay old users.**

### 6.4 What WALK is — and is not

**Is:** an ERC-20 token, capped, minted only as a reward for verified steps, fully owned by the user's wallet.

**Is not:** an investment, a yield product, or a claim on revenue. In this demo it has no market price and no liquidity pool. The honest pitch is: *WALK proves the payout rails; the value layer is a sponsor-funded pool or stablecoin payout, added later.*

Why the "wait for market cap, then sell" model fails: selling needs **buyers**, not a market cap. If the only reason to buy is that earners will sell, you need endless new buyers — that is the STEPN death spiral. WalkMe deliberately does not depend on it.

---

## 7. How step verification works

### 7.1 Today (demo)

The contract cannot count steps. It verifies a **signature**, and the attestation route signs whatever number the browser sends (capped at 25,000).

**Be explicit about this before a judge asks:** in the demo, typing `20,000` genuinely mints 200 WALK. The demo proves the payout logic, not the biometric truth of the steps.

### 7.2 What the contract *can* enforce

- Only the verifier's signature counts.
- The claim must be for today (UTC).
- One claim per wallet per day.
- The daily cap and supply ceiling always apply.

### 7.3 Production: where the number really comes from

| Source | How steps are counted |
|---|---|
| iPhone | **HealthKit** — daily total from phone/watch sensors |
| Android | **Health Connect** (or Google Fit) |
| Strava | OAuth API — recorded activities and distance |
| Garmin / Fitbit | Vendor APIs |

Two architectures:

**A. Native app reads the sensor (best UX)**

```
HealthKit / Health Connect
      │ daily total + device attestation
      ▼
WalkMe mobile app ──► attestation server ──► submitSteps()
```

The phone reads steps locally and sends the daily total plus **App Attest** (iOS) or **Play Integrity** (Android), which proves the request came from a genuine app on a genuine device.

**B. OAuth API (fastest to ship)**

```
User connects Strava ──► server stores OAuth token
Server calls Strava daily ──► validates ──► signs
```

No app store needed. Downside: Strava only sees recorded workouts, not passive walking.

**C. Ritual (fully on-chain verification)**

Ritual's HTTP precompile (`0x0801`) can fetch a public activity API inside a transaction, and the LLM precompile (`0x0802`) can run anomaly checks. The token contract needs no changes.

### 7.4 What changes in the UI

| | Demo | Production |
|---|---|---|
| User action | Types a number | Connects Strava once, clicks Sync |
| Client sends | `{ address, steps }` | `{ address }` — server fetches steps |
| Step field | Visible | **Removed** |
| Server | Signs whatever it is told | Verifies OAuth, dedupes, checks plausibility, then signs |

The security shift is simple and essential: **the number must never be client-supplied.**

Keep the manual field behind a `DEMO_MODE` flag for judging and local testing; default it off in production.

### 7.5 Anti-cheat, layer by layer

| Attack | Defense |
|---|---|
| User types a fake number | Server reads the number itself from the source API |
| Modified app / rooted phone | App Attest / Play Integrity |
| Replaying an old day | Day bound into the signature; contract requires today |
| Same person, many wallets | Device fingerprint, account binding, clustering by device/IP/timing, per-device reward decay |
| Impossible data | Cadence limits (~250 steps/min), GPS route, heart-rate correlation, time-window checks |
| Fake API response | zkTLS / TEE attestation, or Ritual's HTTP precompile |

The contract stays the same through all of this — only the attester gets stronger.

---

## 8. Security and trust model

### 8.1 What is trusted

| Component | Trust assumption | Mitigation |
|---|---|---|
| Verifier key | It only signs real step data | Server-only key, rotatable via `setVerifier` |
| Owner | Does not arbitrarily change economics | Cannot mint outside `submitSteps`; cannot exceed `MAX_SUPPLY`; timelock/renounce later |
| RPC provider | Returns honest chain data | User can point at any RPC |
| Frontend | Could be malicious | Contract enforces everything; users can interact directly |

### 8.2 Guarantees the contract provides

1. **No self-minting** — only `submitSteps` mints, and only with a valid verifier signature.
2. **No double claim** — one submission per wallet per UTC day.
3. **No stale claims** — the day must equal the current day.
4. **No cross-chain replay** — `chainId` is in the domain.
5. **No cross-contract replay** — `verifyingContract` is in the domain.
6. **No infinite inflation** — `MAX_SUPPLY` clamps the mint.
7. **No per-user runaway** — `dailyStepCap` clamps the reward.

### 8.3 What the contract does *not* guarantee

- That the steps physically happened.
- That one human owns one wallet.
- That the verifier key is uncompromised (that is an ops problem).
- That WALK has monetary value.

Being clear about these is the difference between an honest prototype and a misleading pitch.

### 8.4 Key handling

| Key | Where | Exposure |
|---|---|---|
| `SEPOLIA_PRIVATE_KEY` | `contracts/.env` (gitignored) | Deployer only |
| `VERIFIER_PRIVATE_KEY` | `web/.env.local` (gitignored) | **Server only** — never `NEXT_PUBLIC_` |
| Wallet keys | User's wallet | Never touches the app |

In this demo the deployer and verifier are the same key for simplicity. In production they are separate: the deployer is cold storage, the verifier is a hot server key with limited blast radius (it can only sign step proofs).

---

## 9. Testing

`contracts/test/WalkMe.ts` — **10 / 10 passing**, using real EIP-712 signatures.

| # | Test | Verifies |
|---|---|---|
| 1 | Token metadata and owner | Name `WalkMe`, symbol `WALK`, 18 decimals, deployer owns it |
| 2 | Valid claim mints and emits | 5,000 steps → 50 WALK, `StepsRecorded` event |
| 3 | Wrong signer rejected | A signature from another key reverts `InvalidSignature` |
| 4 | Duplicate day rejected | Second claim same day reverts `AlreadySubmitted` |
| 5 | Wrong day rejected | Yesterday/tomorrow reverts `DayNotToday` |
| 6 | Zero steps rejected | Reverts `ZeroSteps` |
| 7 | Daily cap clamps reward | 50,000 steps → 200 WALK, but 50,000 recorded |
| 8 | Supply ceiling clamps | Mint never exceeds `MAX_SUPPLY` |
| 9 | Owner-only config | Non-owner `setVerifier` / `setRewardRate` reverts |
| 10 | Verifier rotation | Owner can rotate; old signatures stop working |

Also verified:

| Check | Result |
|---|---|
| `npm run build` (web) | Passes |
| `npx tsc --noEmit` | Passes |
| Landing page | HTTP 200 |
| `POST /api/attest` | HTTP 200, returns `{ day, steps, signature }` |

---

## 10. Deployment

### 10.1 Layout

```
contracts/
  contracts/WalkMe.sol           The entire protocol
  test/WalkMe.ts                 10 tests
  ignition/modules/WalkMe.ts     Deployment module
  scripts/export-abi.mjs         Writes the ABI into the frontend
  hardhat.config.ts              localhost / Sepolia / Ritual
  .env                           Deployer credentials (gitignored)
```

### 10.2 Configuration

`hardhat.config.ts` reads secrets through Hardhat config variables:

| Network | Chain ID | Env vars |
|---|---|---|
| `localhost` | 31337 | none (fixed URL) |
| `sepolia` | 11155111 | `SEPOLIA_RPC_URL`, `SEPOLIA_PRIVATE_KEY` |
| `ritual` | 784 | `RITUAL_RPC_URL`, `RITUAL_PRIVATE_KEY` |

`contracts/.env`:

```bash
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
SEPOLIA_PRIVATE_KEY=0x...      # testnet-only, never commit
```

### 10.3 Deploy to local

```bash
cd contracts
npm install
npm run node                    # terminal 1: chain at 127.0.0.1:8545

npm run deploy:local            # terminal 2
npm run export-abi              # copies ABI into web/lib/walkMeAbi.ts
```

### 10.4 Deploy to Sepolia

```bash
cd contracts
set -a; . ./.env; set +a
npm test
npm run deploy:sepolia          # confirms with "y"
npm run export-abi
```

Ignition stores the deployment under `ignition/deployments/chain-11155111/`, so re-running is idempotent and the address is recoverable.

### 10.5 Point the frontend at the deployment

`web/.env.local`:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_CHAIN_ID` | `11155111` |
| `NEXT_PUBLIC_CHAIN_NAME` | `Sepolia` |
| `NEXT_PUBLIC_RPC_URL` | `https://ethereum-sepolia-rpc.publicnode.com` |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | `0x407A4b2eD56034c57b0473e450FEf88cbF6e9da3` |
| `VERIFIER_PRIVATE_KEY` | Verifier key matching the contract's `verifier` |

Then:

```bash
cd web
npm run dev
```

### 10.6 Deployment artifacts

| Artifact | Purpose |
|---|---|
| `artifacts/contracts/WalkMe.sol/WalkMe.json` | ABI + bytecode (used by scripts and tests) |
| `ignition/deployments/chain-11155111/` | Address, transaction hashes, receipt state |
| `web/lib/walkMeAbi.ts` | ABI generated for the frontend |

### 10.7 Verification status

| Item | Status |
|---|---|
| Contract deployed on Sepolia | ✅ |
| End-to-end claim on Sepolia | ✅ |
| Frontend wired to Sepolia | ✅ |
| Source verified on Etherscan | ⬜ Not yet — requires a free Etherscan API key; `ETHERSCAN_API_KEY` in `contracts/.env` then `npx hardhat verify --network sepolia <address>` |

---

## 11. Live proof on Sepolia

| Item | Value |
|---|---|
| Contract | [`0x407A4b2eD56034c57b0473e450FEf88cbF6e9da3`](https://sepolia.etherscan.io/address/0x407A4b2eD56034c57b0473e450FEf88cbF6e9da3) |
| Chain | Sepolia (11155111) |
| Deployer / verifier | `0x71D7Ff2dBd0bff274858eE5846685EEC3B9aB4cf` |
| Claim transaction | [`0x270c4a8d…f1f65`](https://sepolia.etherscan.io/tx/0x270c4a8dcbf6bffe8b27b206cc5f78686ff53184b89f11faa5bcf2ffb52f1f65) |
| Steps recorded | 8,500 on day 20768 |
| WALK minted | 85 |
| Result | `status: success` |

Day 20768 is the number of whole days since 1 January 1970 UTC — `floor(block.timestamp / 86400)`. Nov 11 2026 maps to 20768.

Read-back after the transaction confirmed:

```
chain today:          20768
stepsByDay[20768]:    8500
totalSteps:           8500
balanceOf:            85 WALK
```

A second claim on the same day reverts with `AlreadySubmitted`, as designed.

---

## 12. Running the app

```bash
# terminal 1 — contracts (only if using a local chain)
cd contracts && npm run node

# terminal 2 — deploy + ABI
cd contracts && npm run deploy:local && npm run export-abi

# terminal 3 — frontend
cd web && npm run dev
```

Open `http://localhost:3000`.

- **Sepolia (current config):** connect MetaMask, accept **Switch to Sepolia**, then click **Sync & claim WALK**.
- The deployer account has already claimed for today, so use a different funded account to demo a fresh claim. It needs only a few cents of Sepolia ETH for gas.

---

## 13. Demo script for judges

**60 seconds:**

1. **Open the contract** and show `submitSteps` — signature check, day check, one-claim check, cap, supply clamp. The rules are on-chain, not in the UI.
2. **Show the tests** — 10 passing, one per rule.
3. **Connect MetaMask** on Sepolia. The app prompts to switch if needed.
4. **Sync 8,500 steps.** The API signs the proof, MetaMask confirms, the receipt lands.
5. **Show the result:** +85 WALK, today's steps, lifetime steps, `StepsRecorded` on Etherscan.
6. **Click sync again** — `AlreadySubmitted`; UI says "You already claimed today."

**Closing line:**

> *"WalkMe keeps the one part of move-to-earn that works — paying for verified activity — and removes the parts that collapsed: uncapped inflation and pay-to-play."*

**If asked about fake steps:**

> *"Today the attester is a stand-in. The contract's job is to verify a signature and enforce the caps, and that part is real and tested. In production the same route reads HealthKit or Strava, validates device attestation and plausibility, and only then signs. The contract doesn't change."*

---

## 14. Limitations and roadmap

### Deliberately out of scope for v1

NFT sneakers, staking, marketplace, leaderboard, referrals, multi-token rewards, mobile app, wearable OAuth.

Every one of these adds surface area without proving the core loop.

### Highest-value next steps, in order

1. **Real attestation** — Strava OAuth first (fastest, no app store), then HealthKit/Health Connect plus device attestation. This is the actual moat.
2. **Remove the manual step field** — server fetches the number; ship it behind `DEMO_MODE` for testing.
3. **Etherscan verification** — source readable by judges and users.
4. **Anti-abuse layer** — per-IP rate limits, plausibility checks, per-device reward decay.
5. **Multi-day streaks** — reward consistency rather than volume; still fully on-chain.
6. **Ownerless mode** — timelock the rate and verifier, then renounce ownership.
7. **Payout layer** — sponsor-funded pool or USDC redemption, so "earning" has real value.

---

## 15. Judge Q&A

**"Isn't this just STEPN?"**
No. There is no NFT, no entry cost, no staking, and no uncapped mint. The token is a capped reward budget, not an appreciating asset. WalkMe is the payout rails, not a game economy.

**"How do you stop fake steps?"**
The contract stops self-reporting: a verifier must sign the number, for this wallet, for today, once. The demo attester is a stand-in; production backs it with HealthKit/Strava plus device attestation and plausibility checks. The on-chain guarantees are independent of the source.

**"Can a user edit the step count in the browser?"**
They can change what they send to `/api/attest`, but they cannot change what the contract receives: the signature covers `(user, day, steps)`. Editing any field invalidates it. And in production the client does not send the number at all.

**"What stops the owner from draining supply?"**
The owner can change the rate and verifier, but cannot mint outside `submitSteps`, cannot exceed `MAX_SUPPLY`, and cannot reward more than the daily cap per wallet. Production hardening: timelock, then renounce ownership.

**"Why on-chain at all?"**
Because the payout rules must be public and unfakeable, and the balance must be user-owned. Everything else stays off-chain to keep it simple.

**"What happens when supply runs out?"**
`reward` is clamped to the remaining supply, then minting stops. The step record still updates, so history stays intact.

**"Is WALK worth anything?"**
Not in this demo. It is a testnet token with no market or liquidity. The value model is a sponsor-funded reward pool or stablecoin payout — deliberately not a token that depends on new buyers.

**"Why one contract instead of a token + staking + marketplace?"**
Because those add failure modes without proving the loop. One contract, one rule set, auditable in ten minutes.

---

## 16. Glossary

| Term | Meaning |
|---|---|
| **WALK** | The ERC-20 reward token, 18 decimals, capped at 21M |
| **Move-to-earn** | Paying users for physical activity |
| **Attestation** | A trusted party signing a statement ("this wallet walked 8,500 steps today") |
| **Verifier** | The address whose signature the contract accepts |
| **EIP-712** | A standard for signing structured, human-readable data instead of opaque bytes |
| **Domain separator** | Hash binding a signature to a chain and contract |
| **Nonce / replay** | Reusing a valid signature twice; prevented here by day binding + one claim per day |
| **Mint** | Creating new tokens; only `submitSteps` can do it |
| **UTC day** | `floor(unixTime / 86400)`; day 20768 = 11 Nov 2026 |
| **Gas** | Network fee paid in ETH to execute a transaction |
| **Sepolia** | Ethereum testnet (chain ID 11155111) |
| **Ignition** | Hardhat's declarative deployment system |
| **wagmi / viem** | React hooks and TypeScript client for EVM chains |
| **HealthKit / Health Connect** | Apple / Android APIs for step and health data |
| **App Attest / Play Integrity** | Proof that a request came from a genuine app on a genuine device |
| **zkTLS** | Cryptographic proof that data came from a real HTTPS response |
| **Ritual** | EVM chain with precompiles for HTTP and LLM calls inside transactions |

---

**Bottom line:** WalkMe is a small, honest, working implementation of the only part of move-to-earn that survives scrutiny — paying a capped, verifiable reward for real activity — with the verification source isolated so it can be upgraded from a demo signer to real health data without touching the token.
