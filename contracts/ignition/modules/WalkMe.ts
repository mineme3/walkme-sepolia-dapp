import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("WalkMeModule", (m) => {
  // The deployer also acts as the step verifier for the demo.
  // In production this would be a dedicated attestation service key.
  const walkMe = m.contract("WalkMe", [m.getAccount(0)]);
  return { walkMe };
});
