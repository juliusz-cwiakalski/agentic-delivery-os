/**
 * The one answer-matrix registry for the operator surface (GH-354 §5.1
 * `TC-MATRIX-002`, §7.1).
 *
 * Every row declares its argv, the lifecycle state it needs, the output mode,
 * the projection class that produces its exit (never a literal digit), and the
 * payload facts it asserts. No suite re-declares an expectation: they import
 * these rows, so a lifecycle state or a mode can never silently disappear.
 */

import { rmSync } from "node:fs";
import { join } from "node:path";
import { projectExitCode } from "../../../../packages/cli/src/projection";
import type { ProjectionClass } from "../../../../packages/core/src/contracts/index";
import { createOperatorHarness, type OperatorHarness } from "./harness";
import { materializeFamily, segmentName } from "./logs";
import { createTranscriptDouble } from "./transcript";

export type OperatorMatrixState = "live" | "terminal" | "absent";
export type OperatorMatrixMode = "human" | "json";
export type OperatorMatrixGroup = "STATUS" | "LOG" | "ISDEL" | "MSG";

export type OperatorMatrixEntry = {
  readonly id: string;
  readonly group: OperatorMatrixGroup;
  readonly query: string;
  readonly state: OperatorMatrixState;
  readonly mode: OperatorMatrixMode;
  readonly precondition: string;
  /** The delivered projection class the answer projects through (API-11). */
  readonly projection: ProjectionClass;
  /** The closed reason the row expects, when the row is a negative answer. */
  readonly reason?: string;
  /** The lane's declared harness kind, when the row needs a specific one. */
  readonly harnessKind?: "opencode" | "claude-code";
  /** The payload facts the row asserts; each entry is a failure message. */
  readonly expected: (data: unknown) => readonly string[];
};

/** Read one declared payload key without widening the payload type. */
export const at = (data: unknown, key: string): unknown =>
  typeof data === "object" && data !== null ? (data as Record<string, unknown>)[key] : undefined;

/** A field comparison that reports the row id and the field by name. */
export const mismatch = (label: string, actual: unknown, expected: unknown): string[] =>
  JSON.stringify(actual) === JSON.stringify(expected)
    ? []
    : [`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`];

const status = (
  id: string,
  state: OperatorMatrixState,
  mode: OperatorMatrixMode,
  expected: OperatorMatrixEntry["expected"],
): OperatorMatrixEntry => ({
  id,
  group: "STATUS",
  query: "status GH-354",
  state,
  mode,
  precondition: `${state} lane for GH-354 in the resolved repository`,
  projection: "success",
  expected,
});

const delivering = (
  id: string,
  state: OperatorMatrixState,
  mode: OperatorMatrixMode,
  projection: ProjectionClass,
  query: string,
  expected: OperatorMatrixEntry["expected"],
): OperatorMatrixEntry => ({
  id,
  group: "ISDEL",
  query,
  state,
  mode,
  precondition: `${state} lane for GH-354 in the resolved repository`,
  projection,
  expected,
});

const log = (
  id: string,
  state: OperatorMatrixState,
  projection: ProjectionClass,
  expected: OperatorMatrixEntry["expected"],
): OperatorMatrixEntry => ({
  id,
  group: "LOG",
  query: "log GH-354",
  state,
  mode: "json",
  precondition: `${state} lane for GH-354 with the declared artifact family state`,
  projection,
  expected,
});

const message = (
  id: string,
  reason: string | undefined,
  projection: ProjectionClass,
): OperatorMatrixEntry => ({
  id,
  group: "MSG",
  query: "last-message GH-354",
  state: "terminal",
  mode: "json",
  precondition:
    reason === undefined
      ? "a terminal opencode lane with a readable transcript"
      : `a lane whose answer is ${reason}`,
  projection,
  ...(reason === undefined ? {} : { reason }),
  ...(reason === "capability-gap" ? { harnessKind: "claude-code" as const } : {}),
  expected: (data) => [
    ...mismatch("query", at(data, "query"), "last-message"),
    ...mismatch("reason", at(data, "reason"), reason),
    ...mismatch("available", at(data, "available"), reason === undefined),
  ],
});

/**
 * The declared rows. Phase 2 declares the six `status` combinations, both
 * `is-delivering` forms, and both output modes of the per-ref negative answer;
 * phase 4 appends the three `log` combinations. Later phases append their own
 * rows and never rewrite these.
 */
export const OPERATOR_MATRIX: readonly OperatorMatrixEntry[] = [
  status("MATRIX-STATUS-LIVE-JSON", "live", "json", (data) => [
    ...mismatch("query", at(data, "query"), "status"),
    ...mismatch("marker", at(data, "marker"), "active"),
    ...mismatch("delivering", at(data, "delivering"), true),
    ...mismatch("stale", at(data, "stale"), false),
    ...mismatch("probe", at(data, "probe"), "live"),
  ]),
  status("MATRIX-STATUS-LIVE-HUMAN", "live", "human", () => []),
  status("MATRIX-STATUS-TERMINAL-JSON", "terminal", "json", (data) => [
    ...mismatch("marker", at(data, "marker"), "terminal"),
    ...mismatch("delivering", at(data, "delivering"), false),
    ...mismatch("stale", at(data, "stale"), false),
  ]),
  status("MATRIX-STATUS-TERMINAL-HUMAN", "terminal", "human", () => []),
  status("MATRIX-STATUS-ABSENT-JSON", "absent", "json", (data) => [
    ...mismatch("marker", at(data, "marker"), "absent"),
    ...mismatch("delivering", at(data, "delivering"), false),
    ...mismatch("probe", at(data, "probe"), "not-applicable"),
    ...mismatch("lane", at(data, "lane"), null),
  ]),
  status("MATRIX-STATUS-ABSENT-HUMAN", "absent", "human", () => []),
  delivering(
    "MATRIX-ISDEL-LIVE-JSON",
    "live",
    "json",
    "success",
    "is-delivering GH-354",
    (data) => [
      ...mismatch("query", at(data, "query"), "is-delivering"),
      ...mismatch("delivering", at(data, "delivering"), true),
      ...mismatch("refs", at(data, "refs"), undefined),
    ],
  ),
  delivering(
    "MATRIX-ISDEL-TERMINAL-JSON",
    "terminal",
    "json",
    "user-validation",
    "is-delivering GH-354",
    (data) => [
      ...mismatch("delivering", at(data, "delivering"), false),
      ...mismatch("error", at(data, "error"), undefined),
    ],
  ),
  delivering(
    "MATRIX-ISDEL-ABSENT-JSON",
    "absent",
    "json",
    "user-validation",
    "is-delivering GH-354",
    (data) => [...mismatch("delivering", at(data, "delivering"), false)],
  ),
  delivering(
    "MATRIX-ISDEL-REPOLESS-LIVE-JSON",
    "live",
    "json",
    "success",
    "is-delivering",
    (data) => [
      ...mismatch("ref", at(data, "ref"), null),
      ...mismatch("refs", at(data, "refs"), ["GH-354"]),
    ],
  ),
  log("MATRIX-LOG-LIVE-JSON", "live", "success", (data) => [
    ...mismatch("query", at(data, "query"), "log"),
    ...mismatch("available", at(data, "available"), true),
  ]),
  log("MATRIX-LOG-TERMINAL-JSON", "terminal", "success", (data) => [
    ...mismatch("query", at(data, "query"), "log"),
    ...mismatch("tail", at(data, "tail"), 50),
  ]),
  log("MATRIX-LOG-ABSENT-JSON", "absent", "success", (data) => [
    ...mismatch("available", at(data, "available"), false),
    ...mismatch("reason", at(data, "reason"), "no-log"),
    ...mismatch("lines", at(data, "lines"), []),
  ]),
  message("MATRIX-MSG-PRODUCED-JSON", undefined, "success"),
  message("MATRIX-MSG-NO-LANE-JSON", "no-lane", "user-validation"),
  message("MATRIX-MSG-CAPABILITY-GAP-JSON", "capability-gap", "user-validation"),
  message("MATRIX-MSG-SESSION-UNKNOWN-JSON", "session-unknown", "user-validation"),
  message("MATRIX-MSG-NO-MESSAGE-JSON", "no-message", "user-validation"),
  delivering(
    "MATRIX-ISDEL-REPOLESS-ABSENT-JSON",
    "absent",
    "json",
    "user-validation",
    "is-delivering",
    (data) => [
      ...mismatch("delivering", at(data, "delivering"), false),
      ...mismatch("refs", at(data, "refs"), []),
    ],
  ),
];

export type OperatorMatrixOutcome = {
  readonly id: string;
  readonly exit: number;
  readonly failures: readonly string[];
};

/** Drive one registry row through the composed program and compare. */
export const runMatrixCase = async (
  harness: OperatorHarness,
  entry: OperatorMatrixEntry,
): Promise<OperatorMatrixOutcome> => {
  const argv = [
    "dispatch",
    ...entry.query.split(" "),
    ...(entry.mode === "json" ? ["--json"] : []),
  ];
  const result = await harness.run(argv);
  const failures: string[] = [];
  const expectedExit = projectExitCode(entry.projection);
  if (result.exit !== expectedExit) {
    failures.push(`exit: expected ${expectedExit}, received ${result.exit}`);
  }
  if (entry.mode === "json") failures.push(...entry.expected(result.data));
  return { id: entry.id, exit: result.exit, failures };
};

/* ------------------------------------------------------------------------- */
/* The row driver: one prepared harness per row, so every row is independent. */
/* ------------------------------------------------------------------------- */

const ROW_FAMILY_ROOT = "gh354-matrix-family";

/** Build the fresh harness one registry row needs from its declared state. */
export const createRowHarness = (entry: OperatorMatrixEntry): OperatorHarness => {
  const familyRoot = join(process.cwd(), "tmp", "tmpdir", `${ROW_FAMILY_ROOT}-${entry.id}`);
  rmSync(familyRoot, { recursive: true, force: true });
  const transcript = createTranscriptDouble({
    messages: { "ses-matrix": "the final message of the session" },
    ...(entry.reason === "no-message" || entry.reason === "unreadable"
      ? { absence: entry.reason }
      : {}),
    ...(entry.reason === "session-unknown" ? { absence: "session-unknown" as const } : {}),
  });
  const harness = createOperatorHarness({
    label: entry.id.toLowerCase(),
    artifactRoot: familyRoot,
    transcriptRead: transcript.read,
  });
  if (entry.query.startsWith("last-message") && entry.reason === "capability-gap") {
    harness.seedLane({
      ref: harness.ref,
      state: "terminal",
      sessionId: "ses-matrix",
      harnessKind: "claude-code",
    });
    return harness;
  }
  if (entry.query.startsWith("last-message") && entry.reason === "no-lane") return harness;
  if (entry.state === "absent") {
    if (entry.query.startsWith("log")) {
      // No family directory at all: the absent-ref answer.
      return harness;
    }
    return harness;
  }
  if (entry.query.startsWith("log")) {
    materializeFamily({
      familyRoot,
      ref: harness.ref,
      files: [
        {
          name: segmentName({
            recordedAt: "2026-11-19T00:00:00.000Z",
            attemptId: "matrix",
            iterationOrdinal: 1,
            streamKind: "spawn",
            segmentOrdinal: 1,
          }),
          text: "M-1\nM-2\n",
        },
      ],
    });
    return harness;
  }
  harness.seedLane({
    ref: harness.ref,
    state: entry.state === "live" ? "active" : entry.state,
    sessionId: "ses-matrix",
    ...(entry.state === "terminal"
      ? { lastToken: "pr-open" as const, lastOutcome: "completed" as const }
      : {}),
  });
  return harness;
};

/** Run one row through its prepared harness and compare. */
export const runPreparedMatrixCase = async (
  entry: OperatorMatrixEntry,
): Promise<OperatorMatrixOutcome> => {
  const harness = createRowHarness(entry);
  try {
    return await runMatrixCase(harness, entry);
  } finally {
    harness.dispose();
    rmSync(join(process.cwd(), "tmp", "tmpdir", `${ROW_FAMILY_ROOT}-${entry.id}`), {
      recursive: true,
      force: true,
    });
  }
};
