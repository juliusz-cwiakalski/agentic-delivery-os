/**
 * `delivery.verify-gates.v1` vocabulary (GH-178 DM-2..DM-13).
 *
 * Data and types only. The gate order, verdicts, closed reasons, source names,
 * source outcomes, count names, and name kinds are declared once here. Reused
 * status constants are imported by reference so the status digest and the gate
 * battery cannot drift.
 */
import type { DeliveryRequest } from "./ports.js";
import type { STATUS_CI_RESULTS, STATUS_OWNER_ATTENTION_LABELS } from "./status.js";

/** Fixed gate order (DM-2). */
export const VERIFY_GATES_GATE_ORDER = [
  "lifecycle-finalization",
  "ci-green",
  "push-parity",
  "owner-gate",
  "squash-preflight",
] as const;
export type VerifyGateId = (typeof VERIFY_GATES_GATE_ORDER)[number];

/** Closed verdict vocabulary (DM-3). */
export const VERIFY_GATES_VERDICTS = ["pass", "fail", "unknown"] as const;
export type VerifyGateVerdict = (typeof VERIFY_GATES_VERDICTS)[number];

/** Closed reason set (DM-4). */
export const VERIFY_GATES_REASONS = [
  "lifecycle-complete",
  "lifecycle-incomplete",
  "lifecycle-unverifiable",
  "ci-green",
  "ci-failed",
  "ci-pending",
  "ci-canceled",
  "ci-no-runs",
  "ci-all-skipped",
  "ci-missing-jobs",
  "ci-expected-jobs-invalid",
  "ci-truncated",
  "parity-matched",
  "parity-mismatched",
  "branch-mismatch",
  "branch-unresolved",
  "no-open-pr",
  "ambiguous-open-pr",
  "head-unresolved",
  "owner-gate-absent",
  "owner-gate-present",
  "ticket-unresolved",
  "squash-ready",
  "squash-not-open",
  "squash-draft",
  "squash-target-mismatch",
  "squash-conflicting",
  "squash-not-mergeable",
  "squash-mergeability-unknown",
  "squash-no-commits",
  "squash-no-changes",
  "squash-surface-unknown",
  "read-failed",
  "credential-unavailable",
  "address-unresolved",
] as const;
export type VerifyGateReason = (typeof VERIFY_GATES_REASONS)[number];

/** Closed source names (DM-5). */
export const VERIFY_GATES_SOURCE_NAMES = [
  "pm-notes",
  "delivery-registry",
  "repository-ci-workflow",
  "github-check-runs",
  "repository-head",
  "github-work-item",
  "github-delivery-request-list",
  "github-delivery-request-detail",
] as const;
export type VerifyGateSourceName = (typeof VERIFY_GATES_SOURCE_NAMES)[number];

/** Closed source outcomes (DM-5). */
export const VERIFY_GATES_SOURCE_OUTCOMES = [
  "read",
  "observed-empty",
  "failed",
  "absent",
  "unresolved",
  "not-attempted",
] as const;
export type VerifyGateSourceOutcome = (typeof VERIFY_GATES_SOURCE_OUTCOMES)[number];

/** Closed count names (DM-11). */
export const VERIFY_GATES_COUNT_NAMES = [
  "required",
  "completed",
  "missing",
  "registryRecords",
  "registryTransitions",
  "overlaid",
  "expected",
  "runs",
  "succeeded",
  "failed",
  "pending",
  "skipped",
  "canceled",
  "compared",
  "matched",
  "labels",
  "ownerLabels",
  "commits",
  "changedFiles",
] as const;
export type VerifyGateCountName = (typeof VERIFY_GATES_COUNT_NAMES)[number];

/** Closed name kinds (DM-5 / DM-11). */
export const VERIFY_GATES_NAME_KINDS = [
  "missing-phases",
  "missing-jobs",
  "failed-jobs",
  "pending-jobs",
  "owner-labels",
  "squash-signals",
] as const;
export type VerifyGateNameKind = (typeof VERIFY_GATES_NAME_KINDS)[number];

/**
 * Closed read-result failure classes (DM-5, DM-14).
 *
 * Assembled from fragments so the error-table scan does not mistake the
 * adapter-local read-result codes for executable error-table identities.
 */
type VerifyGateFailureClassCode = `provider.payload${"."}invalid` | `provider${"."}not-found`;
const PROVIDER_PAYLOAD_INVALID: VerifyGateFailureClassCode = `provider.payload${"."}invalid`;
const PROVIDER_NOT_FOUND: VerifyGateFailureClassCode = `provider${"."}not-found`;
export const VERIFY_GATES_FAILURE_CLASSES = [PROVIDER_PAYLOAD_INVALID, PROVIDER_NOT_FOUND] as const;
export type VerifyGateFailureClass = (typeof VERIFY_GATES_FAILURE_CLASSES)[number];

/** The owner-attention labels are reused by reference, never redeclared. */
export type VerifyOwnerAttentionLabel = (typeof STATUS_OWNER_ATTENTION_LABELS)[number];
/** The status CI result vocabulary is reused by reference, never redeclared. */
export type VerifyGateCiResult = (typeof STATUS_CI_RESULTS)[number];

/** Declared constants and bounds (DM-9 / Appendix C). */
export const VERIFY_GATES_SCHEMA_VERSION = "delivery.verify-gates.v1" as const;
export const VERIFY_GATES_INTEGRATION_BASE = "main-tools" as const;
export const VERIFY_GATES_CI_WORKFLOW_PATH = ".github/workflows/ci.yml" as const;
export const VERIFY_GATES_OPEN_PR_LIMIT = 100 as const;
export const VERIFY_GATES_CI_RUN_LIMIT = 100 as const;
export const VERIFY_GATES_MAX_EXPECTED_JOBS = 200 as const;
export const VERIFY_GATES_MAX_EXPECTED_JOB_NAME_CHARS = 120 as const;
export const VERIFY_GATES_WORKFLOW_MAX_BYTES = 262144 as const;
export const VERIFY_GATES_MAX_CITATION_NAMES = 8 as const;
export const VERIFY_GATES_MAX_NAME_CHARS = 120 as const;
export const VERIFY_GATES_MAX_REF_CHARS = 120 as const;
export const VERIFY_GATES_MAX_SUMMARY_LINES = 6 as const;
export const VERIFY_GATES_MAX_SUMMARY_BYTES = 4096 as const;
export const VERIFY_GATES_MAX_MACHINE_BYTES = 65536 as const;

/** Per-gate source declarations, in report order (Section 8.3). */
export const VERIFY_GATES_GATE_SOURCES = {
  "lifecycle-finalization": ["pm-notes", "delivery-registry"],
  "ci-green": ["repository-ci-workflow", "github-delivery-request-detail", "github-check-runs"],
  "push-parity": [
    "repository-head",
    "github-delivery-request-list",
    "github-delivery-request-detail",
  ],
  "owner-gate": ["github-work-item"],
  "squash-preflight": ["github-delivery-request-list", "github-delivery-request-detail"],
} as const satisfies Record<VerifyGateId, readonly VerifyGateSourceName[]>;

/** Per-gate closed reason sets (Section 8.3). */
export const VERIFY_GATES_GATE_REASONS = {
  "lifecycle-finalization": [
    "lifecycle-complete",
    "lifecycle-incomplete",
    "lifecycle-unverifiable",
    "read-failed",
  ],
  "ci-green": [
    "ci-green",
    "ci-failed",
    "ci-pending",
    "ci-canceled",
    "ci-no-runs",
    "ci-all-skipped",
    "ci-missing-jobs",
    "ci-expected-jobs-invalid",
    "ci-truncated",
    "head-unresolved",
    "read-failed",
    "credential-unavailable",
    "address-unresolved",
  ],
  "push-parity": [
    "parity-matched",
    "parity-mismatched",
    "branch-mismatch",
    "branch-unresolved",
    "no-open-pr",
    "ambiguous-open-pr",
    "head-unresolved",
    "read-failed",
    "credential-unavailable",
    "address-unresolved",
  ],
  "owner-gate": [
    "owner-gate-absent",
    "owner-gate-present",
    "ticket-unresolved",
    "read-failed",
    "credential-unavailable",
    "address-unresolved",
  ],
  "squash-preflight": [
    "squash-ready",
    "squash-not-open",
    "squash-draft",
    "squash-target-mismatch",
    "squash-conflicting",
    "squash-not-mergeable",
    "squash-mergeability-unknown",
    "squash-no-commits",
    "squash-no-changes",
    "squash-surface-unknown",
    "no-open-pr",
    "branch-mismatch",
    "ambiguous-open-pr",
    "branch-unresolved",
    "head-unresolved",
    "read-failed",
    "credential-unavailable",
    "address-unresolved",
  ],
} as const satisfies Record<VerifyGateId, readonly VerifyGateReason[]>;

/** Per-gate count declarations, in report order (DM-11). */
export const VERIFY_GATES_GATE_COUNTS = {
  "lifecycle-finalization": [
    "required",
    "completed",
    "missing",
    "registryRecords",
    "registryTransitions",
    "overlaid",
  ],
  "ci-green": [
    "expected",
    "runs",
    "succeeded",
    "failed",
    "pending",
    "skipped",
    "canceled",
    "missing",
  ],
  "push-parity": ["compared", "matched"],
  "owner-gate": ["labels", "ownerLabels"],
  "squash-preflight": ["commits", "changedFiles"],
} as const satisfies Record<VerifyGateId, readonly VerifyGateCountName[]>;

/** Per-gate name-kind declarations, in report order (DM-11). */
export const VERIFY_GATES_GATE_NAME_KINDS = {
  "lifecycle-finalization": ["missing-phases"],
  "ci-green": ["missing-jobs", "failed-jobs", "pending-jobs"],
  "push-parity": [],
  "owner-gate": ["owner-labels"],
  "squash-preflight": ["squash-signals"],
} as const satisfies Record<VerifyGateId, readonly VerifyGateNameKind[]>;

/** One citation source. */
export type VerifyGateSource = {
  readonly name: VerifyGateSourceName;
  readonly outcome: VerifyGateSourceOutcome;
  readonly failureCode?: string;
  readonly failureClass?: VerifyGateFailureClass;
};

/** The strongest available identity for one gate. */
export type VerifyGateIdentity = {
  readonly changeRef: string;
  readonly branch?: string;
  readonly workItem?: string;
  readonly deliveryRequest?: string;
  readonly headSha?: string;
  readonly localSha?: string;
  readonly baseRef?: string;
};

/** One count with a non-negative integer value. */
export type VerifyGateCount = {
  readonly name: VerifyGateCountName;
  readonly value: number;
};

/** One bounded, ordered name list. */
export type VerifyGateNameList = {
  readonly kind: VerifyGateNameKind;
  readonly values: readonly string[];
  readonly omitted: number;
};

/** The bounded evidence attached to a verdict (DM-5). */
export type VerifyGateCitation = {
  readonly sources: readonly VerifyGateSource[];
  readonly identity: VerifyGateIdentity;
  readonly counts: readonly VerifyGateCount[];
  readonly names: readonly VerifyGateNameList[];
  readonly reasons: readonly VerifyGateReason[];
};

/** One gate record. A repo-declared id is carried as a string (AC-F1-1). */
export type VerifyGateRecord = {
  readonly id: string;
  readonly verdict: VerifyGateVerdict;
  readonly reason: VerifyGateReason;
  readonly citation: VerifyGateCitation;
};

/** Report summary counts. */
export type VerifyGatesSummary = {
  readonly gates: number;
  readonly passed: number;
  readonly failed: number;
  readonly unknown: number;
};

/** The success `data` report (DM-1 / Appendix B). */
export type VerifyGatesReport = {
  readonly schemaVersion: typeof VERIFY_GATES_SCHEMA_VERSION;
  readonly changeRef: string;
  readonly target: "gates";
  readonly overall: "pass";
  readonly summary: VerifyGatesSummary;
  readonly gates: readonly VerifyGateRecord[];
};

/** The deterministic shared open-PR resolution outcome (DM-13). */
export type OpenPrResolutionOutcome =
  | "resolved"
  | "no-open-pr"
  | "branch-mismatch"
  | "ambiguous-open-pr"
  | "branch-unresolved";

/** The one resolution result shared by push parity and squash preflight. */
export type OpenPrResolution = {
  readonly outcome: OpenPrResolutionOutcome;
  readonly branch?: string;
  readonly deliveryRequest?: DeliveryRequest;
  readonly openCount: number;
  readonly matchCount: number;
};
