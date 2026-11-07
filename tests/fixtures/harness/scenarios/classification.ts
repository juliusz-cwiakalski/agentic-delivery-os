/**
 * The classification conformance scenarios (test-plan §4.2).
 *
 * Each case declares the raw harness I/O for both adapters, the expected
 * neutral evidence semantics, and the expected delivery-result token. The two
 * raw shapes are deliberately different, so a passing token cannot come from
 * identity of input.
 */
import type {
  DeliveryResultToken,
  HarnessEvidence,
} from "../../../../packages/core/src/contracts/index";
import type {
  HarnessConformanceIo,
  HarnessConformanceScenarioId,
} from "../../../../packages/testkit/src/conformance/harness";

export type HarnessScenario = {
  readonly id: HarnessConformanceScenarioId;
  readonly expectedEvidence: Omit<HarnessEvidence, "warnings">;
  readonly expectedToken: DeliveryResultToken;
  readonly opencode: HarnessConformanceIo;
  readonly claude: HarnessConformanceIo;
};

const base = {
  exitStatus: 0,
  timedOut: false,
  spawnRefused: false,
  failureReported: false,
  toolFailure: false,
} as const;

export const CLASSIFICATION_SCENARIOS: readonly HarnessScenario[] = [
  {
    id: "completed",
    expectedEvidence: { ...base, completionMarker: true },
    expectedToken: "finished",
    opencode: {
      spawnStdout: JSON.stringify({
        session: { id: "ses_completed" },
        result: { completion: "complete" },
      }),
      spawnStatus: 0,
      spawnTimedOut: false,
    },
    claude: {
      spawnStdout: JSON.stringify({
        type: "result",
        subtype: "success",
        session_id: "cc_completed",
        is_error: false,
        usage: {},
      }),
      spawnStatus: 0,
      spawnTimedOut: false,
    },
  },
  {
    id: "tool-failure",
    expectedEvidence: { ...base, completionMarker: true, toolFailure: true },
    expectedToken: "partial",
    opencode: {
      spawnStdout: JSON.stringify({
        session: { id: "ses_tool" },
        result: { completion: "complete", toolFailure: true },
      }),
      spawnStatus: 0,
      spawnTimedOut: false,
    },
    claude: {
      spawnStdout: JSON.stringify({
        type: "result",
        subtype: "success",
        session_id: "cc_tool",
        is_error: false,
        tool_failure: true,
        usage: {},
      }),
      spawnStatus: 0,
      spawnTimedOut: false,
    },
  },
  {
    id: "premature-end",
    expectedEvidence: { ...base, completionMarker: false },
    expectedToken: "partial",
    opencode: {
      spawnStdout: JSON.stringify({
        session: { id: "ses_premature" },
        result: { completion: "incomplete" },
      }),
      spawnStatus: 0,
      spawnTimedOut: false,
    },
    claude: {
      spawnStdout: JSON.stringify({ type: "assistant", session_id: "cc_premature", usage: {} }),
      spawnStatus: 0,
      spawnTimedOut: false,
    },
  },
  {
    id: "harness-failure",
    expectedEvidence: { ...base, completionMarker: false, failureReported: true },
    expectedToken: "failed",
    opencode: {
      spawnStdout: JSON.stringify({
        session: { id: "ses_failed" },
        result: { completion: "failed", status: "failed" },
      }),
      spawnStatus: 0,
      spawnTimedOut: false,
    },
    claude: {
      spawnStdout: JSON.stringify({
        type: "result",
        subtype: "error",
        is_error: true,
        session_id: "cc_failed",
        usage: {},
      }),
      spawnStatus: 0,
      spawnTimedOut: false,
    },
  },
  {
    id: "spawn-refusal",
    expectedEvidence: { ...base, completionMarker: false, spawnRefused: true },
    expectedToken: "noop-lane-permission",
    opencode: {
      spawnStdout: JSON.stringify({
        session: { id: "ses_refused" },
        result: { completion: "incomplete", refused: true },
      }),
      spawnStatus: 126,
      spawnTimedOut: false,
    },
    claude: {
      spawnStdout: JSON.stringify({ refused: true, session_id: "cc_refused", usage: {} }),
      spawnStatus: 126,
      spawnTimedOut: false,
    },
  },
  {
    id: "timeout",
    expectedEvidence: { ...base, completionMarker: true, timedOut: true },
    expectedToken: "max-restarts",
    opencode: {
      spawnStdout: JSON.stringify({
        session: { id: "ses_timeout" },
        result: { completion: "complete" },
      }),
      spawnStatus: 0,
      spawnTimedOut: true,
    },
    claude: {
      spawnStdout: JSON.stringify({
        type: "result",
        subtype: "success",
        session_id: "cc_timeout",
        is_error: false,
        usage: {},
      }),
      spawnStatus: 0,
      spawnTimedOut: true,
    },
  },
];

export const LIVENESS_FACTS = [
  { kind: "session-traffic", status: "sourced", value: 11, observedAt: "2026-11-06T00:00:09Z" },
  { kind: "process", status: "sourced", value: 1, observedAt: "2026-11-06T00:00:09Z" },
] as const;
