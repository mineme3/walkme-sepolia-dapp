import { NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const MAX_STEPS = 25_000;

const STEP_PROOF_TYPES = {
  StepProof: [
    { name: "user", type: "address" },
    { name: "day", type: "uint256" },
    { name: "steps", type: "uint256" },
  ],
} as const;

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export async function POST(request: Request) {
  const key = process.env.VERIFIER_PRIVATE_KEY as `0x${string}` | undefined;
  const contract = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Address | undefined;
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 31337);

  if (!key || !key.startsWith("0x") || key.length !== 66 || !contract) {
    return NextResponse.json(
      {
        error:
          "Attestation is not configured. Set VERIFIER_PRIVATE_KEY and NEXT_PUBLIC_CONTRACT_ADDRESS in web/.env.local.",
      },
      { status: 500 },
    );
  }

  let body: { address?: string; steps?: number };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  if (!body.address || !isAddress(body.address)) return badRequest("A valid wallet address is required.");

  const steps = Math.floor(Number(body.steps));
  if (!Number.isFinite(steps) || steps < 1) return badRequest("Steps must be a positive number.");

  const clamped = Math.min(steps, MAX_STEPS);
  const day = Math.floor(Date.now() / 86_400_000);

  try {
    const account = privateKeyToAccount(key);
    const signature = await account.signTypedData({
      domain: { name: "WalkMe", version: "1", chainId, verifyingContract: contract },
      types: STEP_PROOF_TYPES,
      primaryType: "StepProof",
      message: { user: body.address, day: BigInt(day), steps: BigInt(clamped) },
    });

    return NextResponse.json({ day, steps: clamped, signature });
  } catch {
    return NextResponse.json(
      { error: "Could not sign the step proof. Check the verifier key." },
      { status: 500 },
    );
  }
}
