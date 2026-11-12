/**
 * The named streaming cases (GH-275 test plan §6.1, DEC-4/DEC-5/Appendix C).
 *
 * Every case declares the queued stdout lines, the process completion facts, the
 * expected identity or failure, and the expected evidence. The real-shape cases
 * read the committed pinned captures; the derived cases are data only.
 */
import { readFileSync } from "node:fs";
import type {
  DeliveryResultToken,
  HarnessEvidence,
  HarnessFailureCode,
  HarnessOutcome,
} from "../../../../packages/core/src/contracts/index";

const pinnedLines = (name: string): readonly string[] =>
  readFileSync(new URL(`../stream/${name}`, import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0);

const pinnedSessionId = (lines: readonly string[]): string | undefined => {
  const first = lines[0];
  if (first === undefined) return undefined;
  const parsed: unknown = JSON.parse(first);
  return typeof parsed === "object" && parsed !== null && "sessionID" in parsed
    ? String((parsed as { readonly sessionID: unknown }).sessionID)
    : undefined;
};

export const HAPPY_PATH_LINES = pinnedLines("opencode-v2.2.5.jsonl");
export const TOOL_ERROR_LINES = pinnedLines("opencode-v2.2.5-tool-error.jsonl");
export const STREAM_ERROR_LINES = pinnedLines("opencode-v2.2.5-stream-error.jsonl");

export const HAPPY_PATH_SESSION_ID = pinnedSessionId(HAPPY_PATH_LINES);
export const TOOL_ERROR_SESSION_ID = pinnedSessionId(TOOL_ERROR_LINES);
export const STREAM_ERROR_SESSION_ID = pinnedSessionId(STREAM_ERROR_LINES);

const stepStart = (sessionID: string): string =>
  JSON.stringify({
    type: "step_start",
    timestamp: 1,
    sessionID,
    part: { type: "step-start" },
  });

const text = (sessionID: string): string =>
  JSON.stringify({ type: "text", timestamp: 2, sessionID, part: { type: "text", text: "ok" } });

const stepFinish = (sessionID: string, reason: string): string =>
  JSON.stringify({
    type: "step_finish",
    timestamp: 3,
    sessionID,
    part: { type: "step-finish", reason },
  });

// ---------------------------------------------------------------------------
// Telemetry v2 token-bearing builders (GH-291 GAP-2; ingest matrices
// I-01..I-05). Shape-preserving over the committed v2.2.5 capture: every
// synthetic frame keeps the framing the pinned captures pin (top-level
// `sessionID`, `part.type` completion marker) while varying only the token,
// cost, and call payload. Later matrices build through these builders, never
// through ad-hoc JSON literals scattered through suites.
// ---------------------------------------------------------------------------

/** The token-bearing capture committed per the stream README (GAP-2). */
export const TOKEN_BEARING_LINES = pinnedLines("opencode-v2.2.5-tokens.jsonl");
export const TOKEN_SESSION_ID = pinnedSessionId(TOKEN_BEARING_LINES);

export type TelemetryTokenCounts = {
  readonly input?: number;
  readonly output?: number;
  readonly reasoning?: number;
  readonly cacheRead?: number;
  readonly cacheWrite?: number;
};

export type TokenFrameOptions = {
  /** Present keys are counted; omitted keys degrade through I-02. */
  readonly tokens?: TelemetryTokenCounts;
  /** `undefined` omits cost (I-03); a number counts in harness-reported units. */
  readonly cost?: number;
  /** `undefined` omits the explicit call count (I-04). */
  readonly calls?: number;
  readonly reason?: string;
  /** Drift (I-05): unexpected extra part fields beside the known shape. */
  readonly extraPartFields?: Readonly<Record<string, unknown>>;
  /** Drift (I-05): a renamed token-class key inside the tokens shape. */
  readonly renamedTokenClass?: { readonly from: keyof TelemetryTokenCounts; readonly to: string };
  /** Drift (I-05): an unknown top-level frame type. */
  readonly frameType?: string;
  readonly timestamp?: number;
};

/** Build one shape-preserving token-bearing completion frame. */
export const tokenStepFinish = (sessionID: string, options: TokenFrameOptions = {}): string => {
  const { renamedTokenClass, ...rest } = options;
  const source: TelemetryTokenCounts = rest.tokens ?? {};
  const tokens: Record<string, number> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    if (renamedTokenClass !== undefined && key === renamedTokenClass.from) {
      tokens[renamedTokenClass.to] = value;
      continue;
    }
    tokens[key] = value;
  }
  const part: Record<string, unknown> = {
    type: "step-finish",
    id: "prt_tok",
    messageID: "msg_tok",
    reason: rest.reason ?? "stop",
    ...(Object.keys(tokens).length > 0 ? { tokens } : {}),
    ...(rest.cost === undefined ? {} : { cost: rest.cost }),
    ...(rest.calls === undefined ? {} : { calls: rest.calls }),
    ...(rest.extraPartFields ?? {}),
  };
  return JSON.stringify({
    type: rest.frameType ?? "step_finish",
    timestamp: rest.timestamp ?? 3,
    sessionID,
    part,
  });
};

/** I-01 — the complete control: all five classes, cost, and calls counted. */
export const completeTokenFrame = (sessionID: string): string =>
  tokenStepFinish(sessionID, {
    tokens: { input: 10, output: 20, reasoning: 3, cacheRead: 40, cacheWrite: 5 },
    cost: 0.0125,
    calls: 1,
  });

/** I-02 — one token class omitted; the others counted, the class never zeroed. */
export const omittedClassFrame = (sessionID: string): string =>
  tokenStepFinish(sessionID, {
    tokens: { input: 10, output: 20, cacheRead: 40, cacheWrite: 5 },
    cost: 0.01,
    calls: 1,
  });

/** I-03 — cost omitted; token sums intact, cost never synthesized. */
export const omittedCostFrame = (sessionID: string): string =>
  tokenStepFinish(sessionID, {
    tokens: { input: 10, output: 20, reasoning: 3, cacheRead: 40, cacheWrite: 5 },
    calls: 1,
  });

/** I-04 — calls omitted; calls excluded from totals, never defaulted. */
export const omittedCallsFrame = (sessionID: string): string =>
  tokenStepFinish(sessionID, {
    tokens: { input: 10, output: 20, reasoning: 3, cacheRead: 40, cacheWrite: 5 },
    cost: 0.01,
  });

/** I-05 — known completion shape with unexpected extra fields; known fields count. */
export const driftedExtraFieldFrame = (sessionID: string): string =>
  tokenStepFinish(sessionID, {
    tokens: { input: 10, output: 20, reasoning: 3, cacheRead: 40, cacheWrite: 5 },
    cost: 0.01,
    calls: 1,
    extraPartFields: { providerTokens: { total: 99 } },
  });

/** I-05 — a renamed token-class key; the drifted class excludes, the rest count. */
export const driftedRenamedClassFrame = (sessionID: string): string =>
  tokenStepFinish(sessionID, {
    tokens: { input: 10, output: 20, reasoning: 3, cacheRead: 40, cacheWrite: 5 },
    renamedTokenClass: { from: "cacheRead", to: "cache_read" },
    cost: 0.01,
    calls: 1,
  });

/** I-05 — an unknown top-level frame type beside known frames; ingest continues. */
export const driftedUnknownTypeFrame = (sessionID: string): string =>
  tokenStepFinish(sessionID, { frameType: "step_flush" });

export type StreamCaseId =
  | "real-three-line"
  | "leading-noise"
  | "no-id-exit-0"
  | "no-id-non-zero"
  | "no-id-bound"
  | "id-then-non-zero"
  | "truncated"
  | "single-session-id"
  | "single-sessionId"
  | "single-id"
  | "precedence"
  | "legacy-precedence"
  | "legacy-completion-under-timeout"
  | "tool-error"
  | "stream-error"
  | "no-terminal-event"
  | "abnormal-timeout";

export type StreamCase = {
  readonly id: StreamCaseId;
  readonly lines: readonly string[];
  readonly completion: { readonly status: number; readonly timedOut: boolean };
  readonly expectedSessionId?: string;
  readonly expectedFailure?: HarnessFailureCode;
  readonly expectedEvidence?: Partial<HarnessEvidence>;
  readonly expectedOutcome?: HarnessOutcome;
  readonly expectedToken?: DeliveryResultToken;
};

export const STREAM_CASES: readonly StreamCase[] = [
  {
    id: "real-three-line",
    lines: HAPPY_PATH_LINES,
    completion: { status: 0, timedOut: false },
    ...(HAPPY_PATH_SESSION_ID === undefined ? {} : { expectedSessionId: HAPPY_PATH_SESSION_ID }),
    expectedEvidence: { completionMarker: true, exitStatus: 0, timedOut: false },
    expectedOutcome: "completed",
    expectedToken: "finished",
  },
  {
    id: "leading-noise",
    lines: ["", "\r", "not-json", JSON.stringify({ type: "text" }), stepStart("ses_noise")],
    completion: { status: 0, timedOut: false },
    expectedSessionId: "ses_noise",
  },
  {
    id: "no-id-exit-0",
    lines: [JSON.stringify({ type: "text", timestamp: 1 })],
    completion: { status: 0, timedOut: false },
    expectedFailure: "harness.spawn.invalid-output",
  },
  {
    id: "no-id-non-zero",
    lines: [JSON.stringify({ type: "text", timestamp: 1 })],
    completion: { status: 7, timedOut: false },
    expectedFailure: "harness.spawn.refused",
  },
  {
    id: "no-id-bound",
    lines: [],
    completion: { status: 1, timedOut: true },
    expectedFailure: "harness.spawn.refused",
  },
  {
    id: "id-then-non-zero",
    lines: [stepStart("ses_late")],
    completion: { status: 3, timedOut: false },
    expectedSessionId: "ses_late",
    expectedEvidence: {
      completionMarker: false,
      exitStatus: 3,
      failureReported: false,
      spawnRefused: false,
    },
    expectedOutcome: "failed",
    expectedToken: "failed",
  },
  {
    id: "truncated",
    lines: [stepStart("ses_trunc"), text("ses_trunc")],
    completion: { status: 0, timedOut: false },
    expectedSessionId: "ses_trunc",
    expectedEvidence: { completionMarker: false, exitStatus: 0, timedOut: false },
    expectedOutcome: "premature-end",
    expectedToken: "partial",
  },
  {
    id: "single-session-id",
    lines: [JSON.stringify({ session: { id: "ses_a" } })],
    completion: { status: 0, timedOut: false },
    expectedSessionId: "ses_a",
    expectedOutcome: "premature-end",
    expectedToken: "partial",
  },
  {
    id: "single-sessionId",
    lines: [JSON.stringify({ sessionId: "ses_b" })],
    completion: { status: 0, timedOut: false },
    expectedSessionId: "ses_b",
    expectedOutcome: "premature-end",
    expectedToken: "partial",
  },
  {
    id: "single-id",
    lines: [JSON.stringify({ id: "ses_c" })],
    completion: { status: 0, timedOut: false },
    expectedSessionId: "ses_c",
    expectedOutcome: "premature-end",
    expectedToken: "partial",
  },
  {
    id: "precedence",
    lines: [JSON.stringify({ sessionID: "ses_top", session: { id: "ses_nested" } })],
    completion: { status: 0, timedOut: false },
    expectedSessionId: "ses_top",
    expectedOutcome: "premature-end",
    expectedToken: "partial",
  },
  {
    id: "legacy-precedence",
    lines: [
      JSON.stringify({
        session: { id: "ses_legacy_precedence" },
        result: { completion: "incomplete" },
      }),
      stepFinish("ses_legacy_precedence", "stop"),
    ],
    completion: { status: 0, timedOut: false },
    expectedSessionId: "ses_legacy_precedence",
    expectedEvidence: { completionMarker: false },
    expectedOutcome: "premature-end",
    expectedToken: "partial",
  },
  {
    id: "legacy-completion-under-timeout",
    lines: [
      JSON.stringify({
        session: { id: "ses_legacy_timeout" },
        result: { completion: "complete" },
      }),
    ],
    completion: { status: 0, timedOut: true },
    expectedSessionId: "ses_legacy_timeout",
    expectedEvidence: { completionMarker: true, timedOut: true },
    expectedOutcome: "timed-out",
    expectedToken: "max-restarts",
  },
  {
    id: "tool-error",
    lines: TOOL_ERROR_LINES,
    completion: { status: 0, timedOut: false },
    ...(TOOL_ERROR_SESSION_ID === undefined ? {} : { expectedSessionId: TOOL_ERROR_SESSION_ID }),
    expectedEvidence: { completionMarker: true, toolFailure: true, failureReported: false },
    expectedOutcome: "completed",
    expectedToken: "partial",
  },
  {
    id: "stream-error",
    lines: STREAM_ERROR_LINES,
    completion: { status: 0, timedOut: false },
    ...(STREAM_ERROR_SESSION_ID === undefined
      ? {}
      : { expectedSessionId: STREAM_ERROR_SESSION_ID }),
    expectedEvidence: { completionMarker: false, failureReported: true, exitStatus: 0 },
    expectedOutcome: "failed",
    expectedToken: "failed",
  },
  {
    id: "no-terminal-event",
    lines: [stepStart("ses_premature"), text("ses_premature")],
    completion: { status: 0, timedOut: false },
    expectedSessionId: "ses_premature",
    expectedEvidence: { completionMarker: false, exitStatus: 0 },
    expectedOutcome: "premature-end",
    expectedToken: "partial",
  },
  {
    id: "abnormal-timeout",
    lines: [stepStart("ses_timeout")],
    completion: { status: 0, timedOut: true },
    expectedSessionId: "ses_timeout",
    expectedEvidence: { completionMarker: false, timedOut: true },
    expectedOutcome: "timed-out",
    expectedToken: "max-restarts",
  },
];

/** Look one case up by id; a missing case is a fixture defect. */
export const streamCase = (id: StreamCaseId): StreamCase => {
  const found = STREAM_CASES.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`missing stream case ${id}`);
  return found;
};
