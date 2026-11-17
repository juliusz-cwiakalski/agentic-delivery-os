/**
 * `delivery.supervision.v1` — the operator-facing supervisor battery contract
 * (GH-295 DM-1..DM-4, F-1..F-8).
 *
 * Runtime-neutral by construction: types and `as const` data only. No I/O,
 * clock, randomness, process, or environment access; the pure classification
 * lives in the domain tier, the fold in the app tier, and the rendering in the
 * surface tier. Every bound is imported from its delivered home rather than
 * declared a second time.
 */
import {
  DAEMON_DEFAULT_LOCK_STALENESS_MS,
  DAEMON_MAX_EVIDENCE_BYTES,
  type DaemonLaneLivenessClassification,
} from "./daemon.js";
import { QUEUE_MAX_LANES } from "./queue.js";
import { WATCHDOG_STALL_HEARTBEAT_MS, type WatchdogVerdict } from "./watchdog.js";

/* ------------------------------- identity -------------------------------- */

/** The only home of the supervision report schema identifier. */
export const SUPERVISION_SCHEMA_VERSION = "delivery.supervision.v1" as const;

export type SupervisionSchemaVersion = typeof SUPERVISION_SCHEMA_VERSION;

/**
 * The closed tri-state set (DEC-5): exactly `progressing`, `stalled`, or
 * `unknown`, in this order. No fourth value and no synonym exists.
 */
export const SUPERVISION_STATES = ["progressing", "stalled", "unknown"] as const;

export type SupervisionState = (typeof SUPERVISION_STATES)[number];

/**
 * The declared agreement with the delivered vocabularies (DEC-1, DEC-5): the
 * tri-state is a mapping of the delivered daemon liveness classification and
 * the delivered watchdog verdict family, never a renamed copy of either.
 */
export const SUPERVISION_STATE_FROM_DAEMON_LIVENESS = {
  progressing: "progressing",
  stalled: "stalled",
  unknown: "unknown",
} as const satisfies Readonly<Record<DaemonLaneLivenessClassification, SupervisionState>>;

export const SUPERVISION_STATE_FROM_WATCHDOG_VERDICT = {
  ok: "progressing",
  progressing: "progressing",
  stalled: "stalled",
  refused: "unknown",
} as const satisfies Readonly<Record<WatchdogVerdict, SupervisionState>>;

/** The closed supervision-claim kinds (F-6, DEC-3). */
export const SUPERVISION_CLAIM_KINDS = [
  "daemon-instance",
  "coordinator-lease",
  "per-ref-lease",
] as const;

export type SupervisionClaimKind = (typeof SUPERVISION_CLAIM_KINDS)[number];

/** The closed action-kind set a battery run may report (F-5, F-7, DEC-8). */
export const SUPERVISION_ACTION_KINDS = [
  "supervised-stall-park",
  "safe-boundary-park-intent",
  "restart-admission",
  "exhaustion-record",
  "unavailable-outcome",
] as const;

export type SupervisionActionKind = (typeof SUPERVISION_ACTION_KINDS)[number];

/** The closed degradation-marker vocabulary (F-1, NFR-3). */
export const SUPERVISION_DEGRADATION_MARKERS = [
  "daemon-absent",
  "artifact-source-absent",
  "partial-read",
] as const;

export type SupervisionDegradationMarker = (typeof SUPERVISION_DEGRADATION_MARKERS)[number];

/** The closed truncation-reason vocabulary; `lane-cap` is the only v1 member. */
export const SUPERVISION_TRUNCATION_REASONS = ["lane-cap"] as const;

export type SupervisionTruncationReason = (typeof SUPERVISION_TRUNCATION_REASONS)[number];

/**
 * The closed artifact classes the fold observes (DEC-4). Process-derived
 * readings are deliberately absent: no process identifier, start-time, or CPU
 * class exists,
 * so a process-only reading can never satisfy the classification shape.
 */
export const SUPERVISION_ARTIFACT_CLASSES = [
  "daemon-lane",
  "dispatch-attempt",
  "commit-record",
  "effect-record",
  "restart-record",
  "reconciliation-record",
  "ledger-position",
] as const;

export type SupervisionArtifactClass = (typeof SUPERVISION_ARTIFACT_CLASSES)[number];

/** The closed evidence-code vocabulary every evidence entry names. */
export const SUPERVISION_EVIDENCE_CODES = [
  "artifact-heartbeat-fresh",
  "artifact-heartbeat-aged",
  "artifact-progress",
  "artifact-flat",
  "artifact-source-absent",
  "claim-live",
  "claim-not-live",
  "holder-recorded",
  "scope-bound",
  "observation-span",
  "bound-applied",
  "park-applied",
  "park-intent-recorded",
  "restart-admitted",
  "restart-exhausted",
  "restart-unavailable",
  "acting-authority-refused",
  "single-flight-refused",
  "evidence-truncated",
] as const;

export type SupervisionEvidenceCode = (typeof SUPERVISION_EVIDENCE_CODES)[number];

/**
 * The exact artifact-only member list of the classification input (NFR-2,
 * DEC-4). The structure suite asserts equality, so adding a process-shaped
 * member fails with the offending field named.
 */
export const SUPERVISION_CLASSIFICATION_INPUT_FIELDS = [
  "repository",
  "ref",
  "claimKind",
  "identity",
  "sourcePresent",
  "lastHeartbeatAt",
  "firstHeartbeatAt",
  "heartbeatOrdinal",
  "artifactClasses",
  "artifactInstants",
  "artifactAdvancing",
] as const;

export type SupervisionClassificationField =
  (typeof SUPERVISION_CLASSIFICATION_INPUT_FIELDS)[number];

/** The exact report `data` member set (DM-1); `truncationReason` is conditional. */
export const SUPERVISION_REPORT_MEMBERS = [
  "schemaVersion",
  "repo",
  "lanes",
  "supervisors",
  "actions",
  "counts",
  "degraded",
  "truncated",
  "observedAt",
] as const;

/** The member present exactly when `truncated` is true (DM-1, OQ-TP-3). */
export const SUPERVISION_OPTIONAL_REPORT_MEMBERS = ["truncationReason"] as const;

/** The declared lane-entry member set (DM-1). */
export const SUPERVISION_LANE_ENTRY_FIELDS = [
  "ref",
  "classification",
  "heartbeat",
  "holder",
  "evidence",
] as const;

/** The declared supervision-claim entry member set (DM-1). */
export const SUPERVISION_SUPERVISOR_ENTRY_FIELDS = [
  "claimKind",
  "identity",
  "classification",
  "heartbeat",
  "holder",
  "evidence",
] as const;

/** The declared action member set (DM-1). */
export const SUPERVISION_ACTION_FIELDS = ["kind", "ref", "evidence"] as const;

/** The declared counts member set (DM-1). */
export const SUPERVISION_COUNT_FIELDS = [
  "lanes",
  "progressing",
  "stalled",
  "unknown",
  "supervisors",
  "actions",
  "parked",
] as const;

/* -------------------------------- bounds --------------------------------- */

/** The report's one declared numeric bound: the delivered lane cap (NFR-4). */
export const SUPERVISION_LANE_CAP = QUEUE_MAX_LANES;

/** Evidence respects the delivered evidence byte cap (NFR-4, NFR-6). */
export const SUPERVISION_MAX_EVIDENCE_BYTES = DAEMON_MAX_EVIDENCE_BYTES;

/** Claim liveness uses the delivered heartbeat-staleness bound (F-6). */
export const SUPERVISION_CLAIM_LIVENESS_BOUND_MS = DAEMON_DEFAULT_LOCK_STALENESS_MS;

/** Stall corroboration uses the delivered stall bound, never a literal (NFR-1). */
export const SUPERVISION_CORROBORATION_BOUND_MS = WATCHDOG_STALL_HEARTBEAT_MS;

/* -------------------------------- errors --------------------------------- */

/** The two exact `supervise` identities this change declares (F-8, DEC-6). */
export const SUPERVISE_ERROR_CODES = [
  "supervise.duplicate-supervision",
  "supervise.evidence-absent",
] as const;

export type SuperviseErrorCode = (typeof SUPERVISE_ERROR_CODES)[number];

/* --------------------------------- data ---------------------------------- */

/** One bounded evidence reference: a code plus the artifact facts it names. */
export type SupervisionEvidence = {
  readonly code: SupervisionEvidenceCode;
  readonly ref?: string;
  readonly recordKind?: string;
  readonly instant?: string;
};

/** One lane entry in the report (DM-1). */
export type SupervisionLaneEntry = {
  readonly ref: string;
  readonly classification: SupervisionState;
  /** The lane's last heartbeat observation; absent when none was observed. */
  readonly heartbeat?: string;
  /** The recorded live-lease holder, present exactly when a live lease exists. */
  readonly holder?: string;
  readonly evidence: readonly SupervisionEvidence[];
};

/** One supervision-claim entry in the report (DM-1, F-6). */
export type SupervisionSupervisorEntry = {
  readonly claimKind: SupervisionClaimKind;
  readonly identity: string;
  readonly classification: SupervisionState;
  readonly heartbeat?: string;
  readonly holder?: string;
  readonly evidence: readonly SupervisionEvidence[];
};

/** One action the run applied or declared unavailable (DM-1, F-5, F-7). */
export type SupervisionActionEntry = {
  readonly kind: SupervisionActionKind;
  readonly ref?: string;
  readonly evidence: readonly SupervisionEvidence[];
};

/** The report counts, always derived from the entries and records (DM-1). */
export type SupervisionCounts = {
  readonly lanes: number;
  readonly progressing: number;
  readonly stalled: number;
  readonly unknown: number;
  readonly supervisors: number;
  readonly actions: number;
  readonly parked: number;
};

/** The schema-versioned supervision report payload (DM-1). */
export type SupervisionReport = {
  readonly schemaVersion: SupervisionSchemaVersion;
  readonly repo: string;
  readonly lanes: readonly SupervisionLaneEntry[];
  readonly supervisors: readonly SupervisionSupervisorEntry[];
  readonly actions: readonly SupervisionActionEntry[];
  readonly counts: SupervisionCounts;
  readonly degraded: readonly SupervisionDegradationMarker[];
  readonly truncated: boolean;
  readonly observedAt: string;
  readonly truncationReason?: SupervisionTruncationReason;
};

/**
 * The artifact-only classification input (NFR-2, DEC-4). No process-derived
 * member exists, so a process-only reading cannot satisfy the shape.
 */
export type SupervisionClassificationInput = {
  readonly repository: string;
  readonly ref?: string;
  readonly claimKind: SupervisionClaimKind;
  readonly identity: string;
  readonly sourcePresent: boolean;
  readonly lastHeartbeatAt?: string;
  readonly firstHeartbeatAt?: string;
  readonly heartbeatOrdinal?: number;
  readonly artifactClasses: readonly SupervisionArtifactClass[];
  readonly artifactInstants: readonly string[];
  readonly artifactAdvancing: boolean;
};
