/**
 * GH-290 contract fixtures: the M2 contract section's enumeration as data.
 *
 * TC-EVT-002 (kind sets), TC-EVT-016 (per-kind payload fields), TC-EVT-014 (the
 * error decision table), and TC-EVT-024..026 (per-topic emission) read these
 * tables instead of restating counts in prose. Transcribed from
 * `doc/planning/oss-tooling/milestones/m2/contracts.md` §Event taxonomy v1
 * (lines 62-88) and the specification's §5.1 F-3 table.
 */

/** The declared kind order per event topic (DEC-A). */
export const CONTRACT_KINDS = {
  "queue.graph": ["entry", "dependency-edge", "release", "remove"],
  "dispatch.attempt": ["started", "refused", "completed"],
  "phase.state": ["began", "completed", "reopened"],
  "blockers.state": ["published", "updated", "cleared"],
} as const;

/** The per-kind payload field list per topic, verbatim from §5.1 F-3. */
export const CONTRACT_PAYLOAD_FIELDS: Readonly<Record<string, Readonly<Record<string, string[]>>>> =
  {
    "queue.graph": {
      entry: ["ref", "repository?", "priority", "recordedAt"],
      "dependency-edge": ["ref", "edges[]", "added[]", "removed[]", "recordedAt"],
      release: [
        "leaseId",
        "repository",
        "ref",
        "holder",
        "runner",
        "weightClass",
        "operation",
        "recordedAt",
      ],
      remove: ["ref", "reason", "recordedAt"],
    },
    "dispatch.attempt": {
      started: ["ref", "spawnOrdinal", "sessionId?", "harnessKind?", "recordedAt"],
      refused: [
        "attemptId",
        "ref",
        "repository",
        "harness",
        "evidenceClass",
        "token",
        "startedAt",
        "finishedAt",
        "evidenceRefs[]",
      ],
      completed: [
        "attemptId",
        "ref",
        "token",
        "outcome",
        "handoverState",
        "comparisonClass",
        "falseSuccess",
        "divergenceRef?",
        "finishedAt",
      ],
    },
    "phase.state": {
      began: ["changeRef", "phaseId", "timestamp"],
      completed: [
        "changeRef",
        "phaseId",
        "commitIntent?",
        "commitIntentBasis?",
        "commitSha?",
        "timestamp",
      ],
      reopened: ["changeRef", "phaseId", "reason", "timestamp"],
    },
    "blockers.state": {
      published: ["id", "type", "audience", "question", "options[]", "askedAt"],
      updated: ["id", "answeringAudience", "choice?", "text?", "answeredAt", "resumeMode"],
      cleared: ["id", "lane", "resumeMode", "clearedAt"],
    },
  };

/** The four S17 shapes that must never be declared as v1 kinds (DEC-A, NG-2). */
export const S17_KIND_NAMES = ["stop", "parked", "resumed", "park-edge"] as const;

/** One surface invocation in the exit decision table (TC-EVT-014). */
export type ErrorCase = {
  readonly argv: readonly string[];
  readonly exit: number;
  readonly code: string | null;
  readonly names?: readonly string[];
};

/**
 * The Appendix D exit matrix as a decision table. `code: null` is the success
 * row (`0`); every other row resolves to exactly one `events` identity.
 */
export const ERROR_DECISION_TABLE: readonly ErrorCase[] = [
  { argv: ["events", "list"], exit: 0, code: null },
  { argv: ["events", "describe", "queue"], exit: 0, code: null },
  {
    argv: ["events", "describe", "status"],
    exit: 1,
    code: "events.topic-unknown",
    names: ["status"],
  },
  {
    argv: ["events", "describe", "nope"],
    exit: 1,
    code: "events.topic-unknown",
    names: ["nope"],
  },
  { argv: ["events", "describe"], exit: 1, code: "events.verb-unknown" },
  { argv: ["events", "list", "status"], exit: 1, code: "events.verb-unknown" },
  { argv: ["events", "frobnicate"], exit: 1, code: "events.verb-unknown" },
  { argv: ["events"], exit: 1, code: "events.verb-unknown" },
];

/** The six topic names, in declared order. */
export const TOPIC_NAMES = [
  "queue",
  "lanes",
  "queue.graph",
  "dispatch.attempt",
  "phase.state",
  "blockers.state",
] as const;
