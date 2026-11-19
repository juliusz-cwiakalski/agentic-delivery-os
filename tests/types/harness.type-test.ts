/**
 * Type-contract cases for TC-HARN-001, TC-HARN-005, TC-HARN-012, TC-HARN-015.
 *
 * This file is compiled by `pnpm typecheck` (`tests/types/tsconfig.json`), not
 * run by Bun; the `@ts-expect-error` comments are the assertions.
 */
import type {
  HARNESS_OBSERVED_ABSENCE_PLACEHOLDER,
  HarnessCapabilityDeclaration,
  HarnessEvidence,
  HarnessExecutionKind,
  HarnessKind,
  HarnessLivenessKind,
  HarnessResumeInput,
  HarnessSeatBinding,
  HarnessSessionPort,
  HarnessSpawnInput,
  HarnessTelemetryRecord,
  HarnessTerminateInput,
  HarnessTerminateResult,
} from "../../packages/core/src/contracts/index";
import type { HarnessCapabilityInspection } from "../../packages/core/src/domain/harness-capability";
import { spawnTitleFor } from "../../packages/core/src/domain/dispatch-identity";

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

/* GH-335: the two additive optional input members, the single-seat binding, and
 * the delivered non-null telemetry identity fields that are NOT widened. */

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Expect<T extends true> = T;

type SpawnAgentIsOptional = Expect<Equal<HarnessSpawnInput["agent"], string | undefined>>;
type SpawnBindingIsOptional = Expect<
  Equal<HarnessSpawnInput["binding"], HarnessSeatBinding | undefined>
>;
type ResumeAgentIsOptional = Expect<Equal<HarnessResumeInput["agent"], string | undefined>>;
type ResumeBindingIsOptional = Expect<
  Equal<HarnessResumeInput["binding"], HarnessSeatBinding | undefined>
>;
type TelemetryAgentIsNonNull = Expect<Equal<HarnessTelemetryRecord["agent"], string>>;
type TelemetryModelIsNonNull = Expect<Equal<HarnessTelemetryRecord["model"], string>>;
type PlaceholderIsTheEmptyString = Expect<Equal<typeof HARNESS_OBSERVED_ABSENCE_PLACEHOLDER, "">>;

const descriptor = { kind: "host", workDirectory: "/synthetic", environment: [] } as const;

/** A spawn input that omits both additive members stays assignable. */
const spawnWithoutMembers: HarnessSpawnInput = {
  workItemRef: "GH-335",
  prompt: "synthetic",
  descriptor,
};

/** A supplied agent identity is a plain string, and the binding is one seat. */
const spawnWithAgent: HarnessSpawnInput = {
  workItemRef: "GH-335",
  prompt: "synthetic",
  descriptor,
  agent: "coder",
  binding: { agent: "coder", seat: "seat-judgment", resolvedModel: "zai/glm-5#judgment" },
};

const rejectedSeatMap: HarnessSeatBinding = {
  agent: "coder",
  seat: "seat-judgment",
  resolvedModel: "zai/glm-5#judgment",
  // @ts-expect-error — a binding carries exactly one seat, never a seat map.
  seats: { other: "other-model" },
};

export type HarnessProbes = [
  SpawnAgentIsOptional,
  SpawnBindingIsOptional,
  ResumeAgentIsOptional,
  ResumeBindingIsOptional,
  TelemetryAgentIsNonNull,
  TelemetryModelIsNonNull,
  PlaceholderIsTheEmptyString,
];

export { rejectedSeatMap, spawnWithAgent, spawnWithoutMembers };

/* GH-347: the ADDITIVE optional members — a port double without `terminate`
 * and a spawn without `title` stay valid; a terminate-capable port is the same
 * type, and the title helper yields a token (or the declared absence). */

const phaseOneEvidence: HarnessEvidence = {
  completionMarker: true,
  exitStatus: 0,
  timedOut: false,
  spawnRefused: false,
  failureReported: false,
  toolFailure: false,
};

/** A port double that declares no terminate member: still a full port. */
const portWithoutTerminate: HarnessSessionPort = {
  spawn: async () => ({ ok: false, error: { kind: "harness", code: "harness.spawn.refused" } }),
  deliver: async () => ({ ok: false, error: { kind: "harness", code: "harness.spawn.refused" } }),
  resume: async () => ({ ok: false, error: { kind: "harness", code: "harness.spawn.refused" } }),
  collect: async () => ({ ok: true, value: phaseOneEvidence }),
  classify: () => ({ outcome: "completed", token: "finished", derivationClass: "verify" }),
  liveness: async () => ({ ok: true, value: { readings: [] } }),
  listSessions: async () => ({ ok: true, value: { handles: [] } }),
};

/** A port double that declares and implements terminate: the same type. */
const portWithTerminate: HarnessSessionPort = {
  ...portWithoutTerminate,
  terminate: async (input: HarnessTerminateInput) => ({
    ok: true,
    value: {
      terminated: true,
      escalated: input.graceMs >= 0,
      reaped: false,
    },
  }),
};

type SpawnTitleIsOptional = Expect<Equal<HarnessSpawnInput["title"], string | undefined>>;
type TerminateResultIsThreeBooleans = Expect<
  Equal<
    HarnessTerminateResult,
    { readonly terminated: boolean; readonly escalated: boolean; readonly reaped: boolean }
  >
>;
type TitleHelperYieldsAStringOrNothing = Expect<
  Equal<ReturnType<typeof spawnTitleFor>, string | undefined>
>;

/** A spawn without a title stays assignable; one with a title carries a plain token. */
const spawnWithoutTitle: HarnessSpawnInput = {
  workItemRef: "GH-347",
  prompt: "synthetic",
  descriptor,
};
const spawnWithTitle: HarnessSpawnInput = {
  workItemRef: "GH-347",
  prompt: "synthetic",
  descriptor,
  title: "ticket-GH-347",
};

/** A terminate report carries exactly the three declared booleans. */
const terminateReport: HarnessTerminateResult = {
  terminated: true,
  escalated: true,
  reaped: false,
  // @ts-expect-error — no fourth member and no identity is carried.
  code: "harness.terminate.failed",
};

/** A member that does not match the optional terminate signature is refused. */
const portWithWrongTerminate: HarnessSessionPort = {
  ...portWithoutTerminate,
  // @ts-expect-error — terminate resolves a report, never a bare boolean.
  terminate: async () => true,
};

/** A title is a string when present: never a structured object. */
const titleAsString: string | undefined = spawnWithTitle.title;

export type HarnessPhaseOneProbes = [
  SpawnTitleIsOptional,
  TerminateResultIsThreeBooleans,
  TitleHelperYieldsAStringOrNothing,
];

export {
  portWithoutTerminate,
  portWithTerminate,
  portWithWrongTerminate,
  spawnWithTitle,
  spawnWithoutTitle,
  terminateReport,
  titleAsString,
};
