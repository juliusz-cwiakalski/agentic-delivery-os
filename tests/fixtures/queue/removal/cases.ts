/**
 * Removal case data (GH-292 TC-QLC-001..011): typed case arrays, not test
 * bodies. A case carries its inputs, the expected identity or result, and the
 * expected payload shape, so a new case is a data addition.
 */
import { QUEUE_REMOVAL_REASONS } from "../../../../packages/core/src/contracts/index";

/** The work-item ref the removal suites seed and remove. */
export const REMOVAL_REF = "GH-241";
/** A ref that never entered the queue. */
export const UNKNOWN_REF = "GH-999";
/** The invoking repository's constant from the cli harness. */
export { REPO_A, NOW_ISO, NOW_MS } from "../cli/harness";

/** One accepted-reason case: the four closed vocabulary values. */
export type AcceptedReasonCase = {
  readonly reason: (typeof QUEUE_REMOVAL_REASONS)[number];
};

/** Every accepted reason, in declared vocabulary order. */
export const ACCEPTED_REASONS: readonly AcceptedReasonCase[] = QUEUE_REMOVAL_REASONS.map(
  (reason) => ({ reason }),
);

/** One malformed-reason case: the delivered input identity names the value. */
export type MalformedReasonCase = {
  readonly label: string;
  /** The literal value passed after `--reason`; `undefined` sends no value. */
  readonly value: string | undefined;
  /** The summary's offending-value token (`value-missing` for an empty value). */
  readonly offending: string;
};

/** Every malformed reason form the grammar refuses before the seam (TC-QLC-003). */
export const MALFORMED_REASONS: readonly MalformedReasonCase[] = [
  { label: "out-of-vocabulary", value: "done", offending: "reason-done" },
  { label: "empty-value", value: "", offending: "reason-value-missing" },
];

/**
 * The refusal matrix (TC-QLC-011): every refusal is inert. `identity` is the
 * error code; `prefence` marks a refusal decided before any fence acquisition.
 */
export type RemovalRefusalCase = {
  readonly label: string;
  readonly identity: string;
  readonly preface: boolean;
};

export const REMOVAL_REFUSAL_IDENTITIES: readonly RemovalRefusalCase[] = [
  { label: "missing-reason", identity: "queue.reason-missing", preface: true },
  { label: "bad-reason", identity: "input.value.rejected", preface: true },
  { label: "unknown-ref", identity: "queue.entry.unobserved", preface: true },
  { label: "already-removed", identity: "queue.entry.unobserved", preface: true },
  { label: "live-lease", identity: "queue.precondition.unmet", preface: false },
];

/** The exact `queue remove` payload key set (DM-5, TC-QLC-010). */
export const REMOVAL_PAYLOAD_KEYS = ["ref", "result", "reason", "readySet", "event", "degraded"];

/** The exact dependency-removal payload key set (DM-5, TC-QLC-035). */
export const DEPENDENCY_REMOVAL_PAYLOAD_KEYS = [
  "ref",
  "entry",
  "edges",
  "result",
  "readySet",
  "event",
  "degraded",
];

/** The delivered add payload key set, unchanged (TC-QLC-035). */
export const MUTATION_PAYLOAD_KEYS = ["ref", "entry", "edges", "result", "degraded"];
