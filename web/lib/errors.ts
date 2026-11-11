import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from "viem";

/** Turns wallet/RPC/contract errors into one human sentence. */
export function explainError(error: unknown): string {
  if (!(error instanceof BaseError)) return "Something went wrong. Check the console.";

  if (error.walk((e) => e instanceof UserRejectedRequestError)) {
    return "You rejected the request in your wallet.";
  }

  const rpcError = error.walk((e) => typeof (e as { code?: unknown }).code === "number") as
    | { code?: number }
    | null;
  if (rpcError?.code === 4100) {
    return "Your wallet hasn't authorized this account. Disconnect, reconnect, and approve the connection.";
  }
  if (rpcError?.code === 4902) {
    return "Add the network to your wallet first, then try again.";
  }

  const revert = error.walk((e) => e instanceof ContractFunctionRevertedError);
  if (revert instanceof ContractFunctionRevertedError) {
    const messages: Record<string, string> = {
      InvalidSignature: "That step proof wasn't signed by WalkMe. Sync again.",
      DayNotToday: "That proof is for a different day — sync today's steps.",
      AlreadySubmitted: "You already claimed today. Come back tomorrow.",
      ZeroSteps: "Sync at least one step.",
      ZeroAddress: "That address is not valid.",
      OwnableUnauthorizedAccount: "Only the app owner can do that.",
    };
    const name = revert.data?.errorName;
    return (name && messages[name]) ?? `The contract reverted: ${name ?? revert.reason ?? revert.shortMessage}`;
  }

  if (/insufficient funds/i.test(error.message)) {
    return "Not enough ETH to pay for gas. Add test ETH to this account.";
  }
  return error.shortMessage;
}
