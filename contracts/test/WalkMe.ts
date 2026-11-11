import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import type { Address, Hex } from "viem";

const { viem } = await network.create();
const publicClient = await viem.getPublicClient();

const STEP_PROOF_TYPES = {
  StepProof: [
    { name: "user", type: "address" },
    { name: "day", type: "uint256" },
    { name: "steps", type: "uint256" },
  ],
} as const;

async function today(): Promise<bigint> {
  return (await publicClient.getBlock()).timestamp / 86_400n;
}

async function signProof(
  wallet: Awaited<ReturnType<typeof viem.getWalletClients>>[number],
  verifyingContract: Address,
  user: Address,
  day: bigint,
  steps: bigint,
): Promise<Hex> {
  return wallet.signTypedData({
    domain: {
      name: "WalkMe",
      version: "1",
      chainId: await publicClient.getChainId(),
      verifyingContract,
    },
    types: STEP_PROOF_TYPES,
    primaryType: "StepProof",
    message: { user, day, steps },
  });
}

describe("WalkMe", async function () {
  it("deploys with the right token, owner and verifier", async function () {
    const [deployer, verifier] = await viem.getWalletClients();
    const walkMe = await viem.deployContract("WalkMe", [verifier.account.address]);

    assert.equal(await walkMe.read.name(), "WalkMe");
    assert.equal(await walkMe.read.symbol(), "WALK");
    assert.equal((await walkMe.read.owner()).toLowerCase(), deployer.account.address.toLowerCase());
    assert.equal((await walkMe.read.verifier()).toLowerCase(), verifier.account.address.toLowerCase());
    assert.equal(await walkMe.read.totalSupply(), 0n);
  });

  it("mints 10 WALK per 1,000 verified steps and emits StepsRecorded", async function () {
    const [deployer, verifier] = await viem.getWalletClients();
    const walkMe = await viem.deployContract("WalkMe", [verifier.account.address]);
    const day = await today();
    const signature = await signProof(verifier, walkMe.address, deployer.account.address, day, 5_000n);

    await viem.assertions.emitWithArgs(
      walkMe.write.submitSteps([5_000n, day, signature]),
      walkMe,
      "StepsRecorded",
      [deployer.account.address, day, 5_000n, 50n * 10n ** 18n],
    );

    assert.equal(await walkMe.read.balanceOf([deployer.account.address]), 50n * 10n ** 18n);
    assert.equal(await walkMe.read.stepsByDay([deployer.account.address, day]), 5_000n);
    assert.equal(await walkMe.read.totalSteps([deployer.account.address]), 5_000n);
    assert.equal(await walkMe.read.totalGlobalSteps(), 5_000n);
  });

  it("rejects a signature from anyone other than the verifier", async function () {
    const [deployer, verifier] = await viem.getWalletClients();
    const walkMe = await viem.deployContract("WalkMe", [verifier.account.address]);
    const day = await today();
    const badSignature = await signProof(deployer, walkMe.address, deployer.account.address, day, 5_000n);

    await viem.assertions.revertWithCustomError(
      walkMe.write.submitSteps([5_000n, day, badSignature]),
      walkMe,
      "InvalidSignature",
    );
  });

  it("allows only one submission per user per day", async function () {
    const [deployer, verifier] = await viem.getWalletClients();
    const walkMe = await viem.deployContract("WalkMe", [verifier.account.address]);
    const day = await today();

    const first = await signProof(verifier, walkMe.address, deployer.account.address, day, 4_000n);
    await walkMe.write.submitSteps([4_000n, day, first]);

    const second = await signProof(verifier, walkMe.address, deployer.account.address, day, 6_000n);
    await viem.assertions.revertWithCustomError(
      walkMe.write.submitSteps([6_000n, day, second]),
      walkMe,
      "AlreadySubmitted",
    );
  });

  it("rejects a proof for a past day", async function () {
    const [deployer, verifier] = await viem.getWalletClients();
    const walkMe = await viem.deployContract("WalkMe", [verifier.account.address]);
    const day = (await today()) - 1n;
    const signature = await signProof(verifier, walkMe.address, deployer.account.address, day, 5_000n);

    await viem.assertions.revertWithCustomError(
      walkMe.write.submitSteps([5_000n, day, signature]),
      walkMe,
      "DayNotToday",
    );
  });

  it("rejects zero steps", async function () {
    const [deployer, verifier] = await viem.getWalletClients();
    const walkMe = await viem.deployContract("WalkMe", [verifier.account.address]);
    const day = await today();
    const signature = await signProof(verifier, walkMe.address, deployer.account.address, day, 0n);

    await viem.assertions.revertWithCustomError(
      walkMe.write.submitSteps([0n, day, signature]),
      walkMe,
      "ZeroSteps",
    );
  });

  it("caps the rewarded steps but still records the real count", async function () {
    const [deployer, verifier] = await viem.getWalletClients();
    const walkMe = await viem.deployContract("WalkMe", [verifier.account.address]);
    const day = await today();
    const signature = await signProof(verifier, walkMe.address, deployer.account.address, day, 50_000n);

    await walkMe.write.submitSteps([50_000n, day, signature]);

    assert.equal(await walkMe.read.stepsByDay([deployer.account.address, day]), 50_000n);
    assert.equal(await walkMe.read.balanceOf([deployer.account.address]), 200n * 10n ** 18n);
  });

  it("never mints past MAX_SUPPLY", async function () {
    const [deployer, verifier, other] = await viem.getWalletClients();
    const walkMe = await viem.deployContract("WalkMe", [verifier.account.address]);
    const day = await today();
    const maxSupply = await walkMe.read.MAX_SUPPLY();

    await walkMe.write.setRewardRate([2_000_000_000n * 10n ** 18n]);

    const first = await signProof(verifier, walkMe.address, deployer.account.address, day, 20_000n);
    await walkMe.write.submitSteps([20_000n, day, first]);
    assert.equal(await walkMe.read.totalSupply(), maxSupply);

    const second = await signProof(verifier, walkMe.address, other.account.address, day, 20_000n);
    await walkMe.write.submitSteps([20_000n, day, second], { account: other.account });
    assert.equal(await walkMe.read.balanceOf([other.account.address]), 0n);
    assert.equal(await walkMe.read.totalSupply(), maxSupply);
  });

  it("only lets the owner change config", async function () {
    const [, verifier, other] = await viem.getWalletClients();
    const walkMe = await viem.deployContract("WalkMe", [verifier.account.address]);

    await viem.assertions.revertWithCustomError(
      walkMe.write.setVerifier([other.account.address], { account: other.account }),
      walkMe,
      "OwnableUnauthorizedAccount",
      [other.account.address],
    );

    await walkMe.write.setVerifier([other.account.address]);
    assert.equal((await walkMe.read.verifier()).toLowerCase(), other.account.address.toLowerCase());
  });

  it("accepts proofs only from the current verifier", async function () {
    const [deployer, verifier, newVerifier] = await viem.getWalletClients();
    const walkMe = await viem.deployContract("WalkMe", [verifier.account.address]);
    const day = await today();

    await walkMe.write.setVerifier([newVerifier.account.address]);

    const oldSignature = await signProof(verifier, walkMe.address, deployer.account.address, day, 3_000n);
    await viem.assertions.revertWithCustomError(
      walkMe.write.submitSteps([3_000n, day, oldSignature]),
      walkMe,
      "InvalidSignature",
    );

    const newSignature = await signProof(newVerifier, walkMe.address, deployer.account.address, day, 3_000n);
    await walkMe.write.submitSteps([3_000n, day, newSignature]);
    assert.equal(await walkMe.read.balanceOf([deployer.account.address]), 30n * 10n ** 18n);
  });
});
