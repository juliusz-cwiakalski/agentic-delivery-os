/**
 * Type-contract cases for TC-HARN-001, TC-HARN-005, TC-HARN-012, TC-HARN-015.
 *
 * This file is compiled by `pnpm typecheck` (`tests/types/tsconfig.json`), not
 * run by Bun; the `@ts-expect-error` comments are the assertions.
 */
import type {
  HarnessCapabilityDeclaration,
  HarnessEvidence,
  HarnessExecutionKind,
  HarnessKind,
  HarnessLivenessKind,
} from "../../packages/core/src/contracts/index";
import type { HarnessCapabilityInspection } from "../../packages/core/src/domain/harness-capability";

const kind: HarnessKind = "opencode";
const execution: HarnessExecutionKind = "host";
const liveness: HarnessLivenessKind = "session-traffic";

// @ts-expect-error — a harness literal outside the closed set is rejected.
const unknownKind: HarnessKind = "pi-dev";

const widened: string = "opencode";
// @ts-expect-error — a widened string is not assignable to the closed kind.
const widenedKind: HarnessKind = widened;

// @ts-expect-error — a second execution kind is absent from the contract.
const containerExecution: HarnessExecutionKind = "container";

// @ts-expect-error — liveness kinds are exactly the closed three.
const cpuKind: HarnessLivenessKind = "cpu";

const declaration: HarnessCapabilityDeclaration = {
  supportedOperations: ["spawn"],
  lifecycleCapabilities: [],
  livenessSources: [],
  declaredGaps: [],
};

const inspection: HarnessCapabilityInspection = { supported: true };
if (!inspection.supported) {
  // @ts-expect-error — a declared gap never projects a parity claim.
  const parity: true = inspection.gap;
  void parity;
}

// @ts-expect-error — a raw harness fact shape is not the neutral evidence type.
const rawEvidence: HarnessEvidence = { status: 0, stdout: "" };

export {
  containerExecution,
  cpuKind,
  declaration,
  execution,
  kind,
  liveness,
  rawEvidence,
  unknownKind,
  widenedKind,
};
