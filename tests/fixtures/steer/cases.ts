/**
 * The steer record fixtures (GH-298 test plan §6): message, outcome, and
 * completion factories, the bound/unbound origin pair, the phase-fold routes,
 * the ask join states, and the value-refusal tables.
 *
 * No wall clock and no filesystem: every timestamp is stated by the fixture.
 */
import type {
  OwnerGateSlaDefault,
  SteerAskFact,
  SteerAskSource,
  SteerCompletionRecord,
  SteerExpiredOutcomeRecord,
  SteerMessageRecord,
  SteerOrigin,
  SteerOutcome,
  SteerOutcomeRecord,
  SteerPhaseFoldView,
  SteerReceipt,
} from "../../../packages/core/src/contracts/index";

export const CREATED = "2026-11-16T12:00:00.000Z";
export const CREATED_MS = Date.parse(CREATED);
export const TTL_24H = 86_400_000;

export const BOUND_ORIGIN: SteerOrigin = {
  change: "GH-298",
  repo: "example/product",
  agent: "owner",
};

export const UNBOUND_ORIGIN: SteerOrigin = {
  change: null,
  repo: "example/product",
  agent: "owner",
};

export const NO_PHASE: SteerPhaseFoldView = { present: false, entries: [] };

export const COMPLETE_PHASE: SteerPhaseFoldView = {
  present: true,
  entries: [
    {
      phaseId: "delivery",
      started: "2026-11-16T10:00:00.000Z",
      completed: "2026-11-16T11:00:00.000Z",
    },
  ],
};

export const IN_PROGRESS_PHASE: SteerPhaseFoldView = {
  present: true,
  entries: [
    {
      phaseId: "delivery",
      started: "2026-11-16T10:00:00.000Z",
      completed: "2026-11-16T11:00:00.000Z",
    },
    {
      phaseId: "review_fix",
      started: "2026-11-16T11:30:00.000Z",
      completed: null,
    },
  ],
};

export const EMPTY_ASKS: SteerAskSource = {
  facts: [],
  join: { defaultableRefs: {}, appliedRefs: [] },
};

export const makeMessage = (overrides: Partial<SteerMessageRecord> = {}): SteerMessageRecord => ({
  id: "msg-1",
  from: "owner",
  to: "delivery",
  scope: "repo",
  kind: "request",
  subject: "prefer smaller diffs; split the refactor",
  ref: null,
  origin: BOUND_ORIGIN,
  priority: "normal",
  created: CREATED,
  ttl: TTL_24H,
  ...overrides,
});

export const receiptOf = (
  message: SteerMessageRecord,
  at: string,
  boundary: string,
): SteerReceipt => ({
  origin: message.origin,
  readReceipt: { at, boundary },
  ttl: message.ttl,
  expiresAt: new Date(Date.parse(message.created) + message.ttl).toISOString(),
});

export const makeAppliedOutcome = (
  message: SteerMessageRecord,
  at = CREATED,
  boundary = "delivery",
): SteerOutcomeRecord => ({
  schemaId: "delivery.steering.outcome.v1",
  id: message.id,
  outcome: "applied",
  recordedAt: at,
  receipt: receiptOf(message, at, boundary),
});

export const makeExpiredOutcome = (
  message: SteerMessageRecord,
  at = CREATED,
): SteerExpiredOutcomeRecord => ({
  schemaId: "delivery.steering.outcome.v1",
  id: message.id,
  outcome: "expired",
  recordedAt: at,
  reason: "ttl-elapsed",
});

export const makeCompletion = (
  id: string,
  artifact = "doc/changes/2026-11/2026-11-16--GH-298--steer/chg-GH-298-plan.yaml",
  completedAt = CREATED,
): SteerCompletionRecord => ({
  schemaId: "delivery.steering.completion.v1",
  id,
  completedAt,
  artifact,
});

/** A lifecycle matrix: one queued, one landed, one completed, one expired. */
export const lifecycleMatrix = (): {
  readonly messages: readonly SteerMessageRecord[];
  readonly outcomes: readonly SteerOutcome[];
  readonly completions: readonly SteerCompletionRecord[];
} => {
  const queued = makeMessage({ id: "msg-queued", created: "2026-11-16T09:00:00.000Z" });
  const landed = makeMessage({ id: "msg-landed", created: "2026-11-16T09:10:00.000Z" });
  const completed = makeMessage({ id: "msg-completed", created: "2026-11-16T09:20:00.000Z" });
  const expired = makeMessage({ id: "msg-expired", created: "2026-11-16T09:30:00.000Z" });
  return {
    messages: [queued, landed, completed, expired],
    outcomes: [
      makeAppliedOutcome(landed),
      makeAppliedOutcome(completed),
      makeExpiredOutcome(expired),
    ],
    completions: [makeCompletion(completed.id)],
  };
};

/** The 12-note rank matrix: 4 priorities x 3 creation times plus an id tie. */
export const rankMatrix = (): readonly SteerMessageRecord[] => {
  const priorities = ["urgent", "high", "normal", "low"] as const;
  const times = [
    "2026-11-16T08:00:00.000Z",
    "2026-11-16T09:00:00.000Z",
    "2026-11-16T10:00:00.000Z",
  ];
  const messages: SteerMessageRecord[] = [];
  for (const priority of priorities) {
    for (const [index, created] of times.entries()) {
      messages.push(
        makeMessage({
          id: `msg-${priority}-${String(index)}`,
          priority,
          created,
        }),
      );
    }
  }
  messages.push(
    makeMessage({ id: "msg-tie-a", priority: "normal", created: times[1] }),
    makeMessage({ id: "msg-tie-b", priority: "normal", created: times[1] }),
  );
  return messages;
};

/** One ask fact from the delivered open-question view. */
export const makeAskFact = (overrides: Partial<SteerAskFact> = {}): SteerAskFact => ({
  id: "q-1",
  type: "decision-needed",
  audience: "owner",
  lane: "L5",
  ref: "GH-298",
  question: "which gate applies?",
  askedAt: "2026-11-16T09:00:00.000Z",
  age: 3 * 3_600_000,
  rank: 1,
  ...overrides,
});

export const asksWithJoin = (input: {
  readonly facts: readonly SteerAskFact[];
  readonly defaultableRefs?: Readonly<Record<string, OwnerGateSlaDefault>>;
  readonly appliedRefs?: readonly string[];
}): SteerAskSource => ({
  facts: input.facts,
  join: {
    defaultableRefs: input.defaultableRefs ?? {},
    appliedRefs: input.appliedRefs ?? [],
  },
});

/** The value-refusal table: every class, with its accepting twin. */
export const valueRefusalCells = (): readonly {
  readonly label: string;
  readonly argv: readonly string[];
  readonly field: string;
}[] => [
  { label: "empty text", argv: ["send", ""], field: "text" },
  { label: "whitespace text", argv: ["send", "   "], field: "text" },
  { label: "over-cap text", argv: ["send", "x".repeat(161)], field: "text" },
  { label: "ttl zero s", argv: ["send", "note", "--ttl", "0s"], field: "ttl" },
  { label: "ttl zero m", argv: ["send", "note", "--ttl", "0m"], field: "ttl" },
  { label: "ttl zero h", argv: ["send", "note", "--ttl", "0h"], field: "ttl" },
  { label: "ttl zero d", argv: ["send", "note", "--ttl", "0d"], field: "ttl" },
  { label: "ttl negative", argv: ["send", "note", "--ttl", "-1h"], field: "ttl" },
  { label: "ttl oversized d", argv: ["send", "note", "--ttl", "31d"], field: "ttl" },
  { label: "ttl oversized h", argv: ["send", "note", "--ttl", "8761h"], field: "ttl" },
  { label: "ttl oversized s", argv: ["send", "note", "--ttl", "2592001s"], field: "ttl" },
  { label: "ttl bare integer", argv: ["send", "note", "--ttl", "24"], field: "ttl" },
  { label: "ttl bare unit", argv: ["send", "note", "--ttl", "h"], field: "ttl" },
  { label: "ttl fractional", argv: ["send", "note", "--ttl", "1.5h"], field: "ttl" },
  { label: "ttl spaced", argv: ["send", "note", "--ttl", "24 h"], field: "ttl" },
  { label: "ttl uppercase", argv: ["send", "note", "--ttl", "24H"], field: "ttl" },
  { label: "ttl unknown unit", argv: ["send", "note", "--ttl", "24y"], field: "ttl" },
  { label: "ttl signed", argv: ["send", "note", "--ttl", "+1h"], field: "ttl" },
  {
    label: "priority out of set",
    argv: ["send", "note", "--priority", "critical"],
    field: "priority",
  },
  { label: "kind notify", argv: ["send", "note", "--kind", "notify"], field: "kind" },
  { label: "kind ask", argv: ["send", "note", "--kind", "ask"], field: "kind" },
  { label: "ref over cap", argv: ["send", "note", "--ref", "x".repeat(161)], field: "ref" },
];

/** The accepting twins for every declared bound. */
export const valueAcceptingTwins = (): readonly (readonly string[])[] => [
  ["send", "x".repeat(160)],
  ["send", "note", "--ttl", "30d"],
  ["send", "note", "--ttl", "2592000s"],
  ["send", "note", "--ttl", "720h"],
  ["send", "note", "--ttl", "43200m"],
  ["send", "note", "--ref", "x".repeat(160)],
];

/** The grammar-refusal table (zero state reads, `fallback.invocation`). */
export const grammarRefusalCells = (): readonly (readonly string[])[] => [
  ["collect"],
  ["send", "x", "--urgent"],
  ["send"],
  ["send", "a", "b"],
  ["list", "extra"],
  ["read", "msg-1"],
  ["complete"],
  ["complete", "a", "b", "--ref", "r"],
  ["send", "x", "--ttl"],
  ["complete", "msg-1", "--ref"],
];
