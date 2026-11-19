/**
 * The declared-bound mirror and the permanent proof boundary (GH-354 §6.1,
 * TC-NFR-002, TC-FIXTURE-002).
 *
 * Each declared bound is listed once, with the one production home it must
 * resolve to, so "one home per bound" is a measurement rather than a claim. The
 * `OPERATOR_PROOF_BOUNDARY` constant is the permanent statement of what the
 * offline battery proves and what it does not (spec §25.3 Appendix C).
 */
import {
  DISPATCH_LOG_FAMILY_BYTES,
  DISPATCH_LOG_FILE_CAP_BYTES,
  DISPATCH_LOG_MAX_HUMAN_BYTES,
  DISPATCH_LOG_MAX_HUMAN_LINES,
  DISPATCH_LOG_RETAINED_FILES,
  DISPATCH_LOG_TAIL_DEFAULT,
  DISPATCH_LOG_TAIL_MAX,
  DISPATCH_LOG_TAIL_MIN,
  DISPATCH_MAX_DELIVERING_REFS,
  DISPATCH_MAX_EVIDENCE_REFS,
  DISPATCH_MAX_HUMAN_BYTES,
  DISPATCH_MAX_HUMAN_LINES,
  DISPATCH_MAX_LAST_MESSAGE_CHARS,
  DISPATCH_MAX_MACHINE_BYTES,
  DISPATCH_PROBE_TOLERANCE_MS,
} from "../../../../packages/core/src/contracts/index";

/** One declared bound, its value, and the single production home it lives in. */
export type BoundDeclaration = {
  readonly name: string;
  readonly value: number;
  readonly home: string;
};

export const DECLARED_BOUNDS: readonly BoundDeclaration[] = [
  { name: "perFileCap", value: DISPATCH_LOG_FILE_CAP_BYTES, home: "contracts/dispatch-operator" },
  {
    name: "retainedFiles",
    value: DISPATCH_LOG_RETAINED_FILES,
    home: "contracts/dispatch-operator",
  },
  { name: "familyBound", value: DISPATCH_LOG_FAMILY_BYTES, home: "contracts/dispatch-operator" },
  { name: "machineDataBytes", value: DISPATCH_MAX_MACHINE_BYTES, home: "contracts/dispatch" },
  {
    name: "humanLogLines",
    value: DISPATCH_LOG_MAX_HUMAN_LINES,
    home: "contracts/dispatch-operator",
  },
  {
    name: "humanLogBytes",
    value: DISPATCH_LOG_MAX_HUMAN_BYTES,
    home: "contracts/dispatch-operator",
  },
  { name: "messageChars", value: DISPATCH_MAX_LAST_MESSAGE_CHARS, home: "contracts/dispatch" },
  {
    name: "deliveringRefs",
    value: DISPATCH_MAX_DELIVERING_REFS,
    home: "contracts/dispatch-operator",
  },
  {
    name: "probeToleranceMs",
    value: DISPATCH_PROBE_TOLERANCE_MS,
    home: "contracts/dispatch-operator",
  },
  { name: "tailDefault", value: DISPATCH_LOG_TAIL_DEFAULT, home: "contracts/dispatch-operator" },
  { name: "tailMin", value: DISPATCH_LOG_TAIL_MIN, home: "contracts/dispatch-operator" },
  { name: "tailMax", value: DISPATCH_LOG_TAIL_MAX, home: "contracts/dispatch-operator" },
  { name: "attemptsHumanLines", value: DISPATCH_MAX_HUMAN_LINES, home: "contracts/dispatch" },
  { name: "attemptsHumanBytes", value: DISPATCH_MAX_HUMAN_BYTES, home: "contracts/dispatch" },
  { name: "evidenceRefs", value: DISPATCH_MAX_EVIDENCE_REFS, home: "contracts/dispatch" },
];

/** The declared values as one object, for the per-value assertions. */
export const BOUND_VALUES = Object.fromEntries(
  DECLARED_BOUNDS.map((bound) => [bound.name, bound.value]),
) as Readonly<Record<string, number>>;

/** The proven ids: what the offline battery observes through production code. */
export const OPERATOR_PROVEN = [
  "lane-view-fold",
  "probe-mapping-and-tolerance",
  "repository-scoping",
  "artifact-tail-and-bounds",
  "oversized-continuation-and-reconstruction",
  "retention-set-and-family-bound",
  "torn-tail-drop",
  "truncation-facts",
  "delivering-fold",
  "transcript-ladder-including-capability-gap",
  "message-composition-order",
  "exit-projections",
  "read-only-posture",
  "no-shell-invariant",
] as const;

/** The not-proven ids: the declared boundary, in declared order. */
export const OPERATOR_NOT_PROVEN = [
  "live-storage-layouts",
  "real-kernel-probe-semantics",
  "real-stdout-framing",
  "real-cross-process-append-interleaving-and-torn-writes",
  "real-snapshot-timing",
  "real-disk-full-and-0600-enforcement",
  "long-run-artifact-growth",
  "one-shot-invocation",
] as const;

/** The permanent statement of what this battery proves and does not prove. */
export const OPERATOR_PROOF_BOUNDARY = {
  proven: OPERATOR_PROVEN,
  notProven: OPERATOR_NOT_PROVEN,
} as const;

/** Every seam id a matrix row may declare; each must be a PROVEN id. */
export const OPERATOR_ROW_SEAMS = [
  "lane-view-fold",
  "delivering-fold",
  "artifact-tail-and-bounds",
  "transcript-ladder-including-capability-gap",
  "message-composition-order",
] as const;
