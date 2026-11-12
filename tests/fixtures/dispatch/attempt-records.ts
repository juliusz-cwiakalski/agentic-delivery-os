/**
 * Deterministic attempt and divergence builders for the GH-289 read-side suites.
 *
 * The delivered `makeAttempt`/`makeDivergence` fixtures cover the shapes the
 * ledger suites need; these add the shapes the read side's bounds, ordering, and
 * fold cells need (maximal evidence, an ascending ledger, real fold history, and
 * an over-long note). Records are test data only: every durable append goes
 * through the delivered ledger helpers.
 */
import {
  DISPATCH_ATTEMPT_PAYLOAD_SCHEMA,
  type DispatchAttemptRecord,
  type DispatchDivergenceRecord,
} from "../../../packages/core/src/contracts/index";
import { DISPATCH_NOW } from "./harness";
import { comparisonForToken, corroborationFor, makeDivergence, REPOSITORY } from "./ledger";

/** The reference every read-side fixture is scoped to. */
export const ATTEMPTS_REF = "GH-289" as const;

/** A 64-character evidence identifier (the projection's per-entry ceiling). */
const EVIDENCE_ID = `evid:${"e".repeat(58)}`;

/** Sixteen maximal evidence identifiers (the projection's per-record ceiling). */
export const maximalEvidenceRefs = (): readonly string[] =>
  Array.from({ length: 16 }, () => EVIDENCE_ID);

/** A 40-character attempt identifier. */
const MAXIMAL_ATTEMPT_ID = `A-${"a".repeat(38)}`;

const instant = (offsetMs: number): string =>
  new Date(Date.parse(DISPATCH_NOW) + offsetMs).toISOString();

/** One attempt carrying the maximal bounded values the projection may receive. */
export const maximalAttempt = (
  overrides: Partial<DispatchAttemptRecord> = {},
): DispatchAttemptRecord => ({
  schema: DISPATCH_ATTEMPT_PAYLOAD_SCHEMA,
  attemptId: MAXIMAL_ATTEMPT_ID,
  repository: REPOSITORY,
  ref: ATTEMPTS_REF,
  harness: "claude-code",
  evidenceClass: "controlled-proof",
  startedAt: DISPATCH_NOW,
  finishedAt: instant(60_000),
  handoverState: "dual-run",
  outcome: "completed",
  token: "merged",
  comparison: comparisonForToken("merged"),
  divergenceRef: "DIV-maximal",
  falseSuccess: false,
  corroboration: corroborationFor("merged"),
  resumeMode: "attach-continue",
  evidenceRefs: Array.from({ length: 16 }, () => EVIDENCE_ID),
  recordedAt: DISPATCH_NOW,
  ...overrides,
});

/**
 * A ledger of `count` attempts for one reference, appended in ascending
 * `startedAt` order (so the newest is last) with distinct identities.
 */
export const ledgerOf = (
  count: number,
  overrides: Partial<DispatchAttemptRecord> = {},
): readonly DispatchAttemptRecord[] =>
  Object.freeze(
    Array.from({ length: count }, (_unused, index) =>
      Object.freeze(
        maximalAttempt({
          attemptId: `A-${String(index + 1).padStart(5, "0")}`,
          startedAt: instant(index * 60_000),
          finishedAt: instant(index * 60_000 + 30_000),
          recordedAt: instant(index * 60_000),
          divergenceRef: `DIV-${String(index + 1)}`,
          evidenceRefs: ["evid:one"],
          ...overrides,
        }),
      ),
    ),
  );

/** `count` open divergences for one repository, identifiers `DIV-OPEN-<n>`. */
export const openDivergences = (
  count: number,
  repository: string = REPOSITORY,
): readonly DispatchDivergenceRecord[] =>
  Array.from({ length: count }, (_unused, index) =>
    makeDivergence({
      divergenceId: `DIV-OPEN-${String(index + 1).padStart(3, "0")}`,
      repository,
      recordedAt: instant(index * 60_000),
    }),
  );

/** `count` resolved divergences for one repository, identifiers `DIV-DONE-<n>`. */
export const resolvedDivergences = (
  count: number,
  repository: string = REPOSITORY,
): readonly DispatchDivergenceRecord[] =>
  Array.from({ length: count }, (_unused, index) =>
    makeDivergence({
      divergenceId: `DIV-DONE-${String(index + 1).padStart(3, "0")}`,
      repository,
      state: "resolved",
      note: "resolved by the fixture",
      principal: "coder@local",
      resolvedAt: instant(index * 60_000),
      recordedAt: instant(index * 60_000),
    }),
  );

/**
 * One identifier's real fold history: an earlier `resolved` record followed by
 * a later `open` record, so latest-per-identifier must report it open.
 */
export const withHistory = (divergenceId: string): readonly DispatchDivergenceRecord[] => [
  makeDivergence({
    divergenceId,
    state: "resolved",
    note: "resolved once",
    principal: "coder@local",
    resolvedAt: instant(0),
    recordedAt: instant(0),
  }),
  makeDivergence({ divergenceId, state: "open", recordedAt: instant(60_000) }),
];

/** An over-long resolution note (the delivered bound is 240 characters). */
export const longNote = (length = 400): string => "x".repeat(length);
