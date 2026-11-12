/**
 * The telemetry v2 contract (GH-291 F-1..F-8; DM-1..DM-6; DEC-2..DEC-6).
 *
 * Runtime-neutral by construction: types and `as const` data only. Per-step
 * stream ingest counts the five token classes, calls, and per-model cost in
 * harness-reported units; attribution joins the delivered economics and audit
 * substrates into the five dimensions; storage is schema-versioned with
 * re-read migration; the spend v2 read side extends the delivered payload
 * additively under the kept `delivery.spend.v1` identity. This module is the
 * single home of the token-bearing frame vocabulary, the step and baseline
 * record shapes, the reconciliation verdict and reading-basis vocabularies,
 * the breakdown-field set, the v2 warning-reason additions, the declared
 * tolerance, the combination arithmetic, and the storage schema version. No
 * runtime API, clock, randomness, or I/O lives here.
 */

import type { HarnessKind } from "./harness.js";
import {
  HARNESS_WARNING_REASONS,
  type HarnessTelemetryWarning,
  type HarnessTokenClass,
} from "./harness-telemetry.js";

// ---------------------------------------------------------------------------
// Storage identity (DM-5, GAP-7): brand-neutral, versioned, single home.
// ---------------------------------------------------------------------------

/** The telemetry storage's declared schema version (DM-5, GAP-7). */
export const TELEMETRY_STORAGE_SCHEMA_VERSION = "delivery.telemetry.storage.v1" as const;

/** The migration rule a version bump follows (F-4, AC-F4-1): re-read, never mutate. */
export const TELEMETRY_MIGRATION_RULE =
  "a storage version bump migrates by re-reading the versioned source; stored records are never mutated in place and no record is dropped" as const;

/** The additive state-ledger record kind carrying one captured step (DM-1). */
export const TELEMETRY_STEP_RECORD_KIND = "harness.telemetry.step" as const;

/** The step payload's self-describing schema identifier. */
export const TELEMETRY_STEP_SCHEMA_ID = "delivery.harness.telemetry.step.v1" as const;

/** The store-scoped key prefix carrying one delivery's step records. */
export const TELEMETRY_STEP_KEY_PREFIX = "harness.telemetry.step:" as const;

/** The additive state-ledger record kind carrying one session baseline (OQ-T2 §1). */
export const TELEMETRY_BASELINE_RECORD_KIND = "harness.telemetry.baseline" as const;

/** The baseline payload's self-describing schema identifier (OQ-T2 §1). */
export const TELEMETRY_BASELINE_SCHEMA_ID = "delivery.harness.telemetry.baseline.v1" as const;

/** The store-scoped key prefix carrying one delivery's session baseline records. */
export const TELEMETRY_BASELINE_KEY_PREFIX = "harness.telemetry.baseline:" as const;

// ---------------------------------------------------------------------------
// Closed vocabularies (DEC-2, DEC-4, DEC-5, GAP-4, GAP-5).
// ---------------------------------------------------------------------------

/** The declared reconciliation tolerance: 2% of harness-reported totals (DEC-2). */
export const TELEMETRY_RECONCILIATION_TOLERANCE = 0.02 as const;

/** The within-tolerance verdict; the value SC-M2-S14-01 pins verbatim. */
export const TELEMETRY_VERDICT_WITHIN = "within" as const;

/** The declared outside verdict (GAP-5): a stated outcome, never a hidden error. */
export const TELEMETRY_VERDICT_OUTSIDE = "outside" as const;

/**
 * The classified reconciliation unavailability (DEC-5): telemetry present but
 * no harness-reported baseline at all — never rendered as `within`.
 */
export const TELEMETRY_VERDICT_UNAVAILABLE = "unavailable" as const;

/** The closed reconciliation-verdict vocabulary. */
export const TELEMETRY_RECONCILIATION_VERDICTS = [
  TELEMETRY_VERDICT_WITHIN,
  TELEMETRY_VERDICT_OUTSIDE,
  TELEMETRY_VERDICT_UNAVAILABLE,
] as const;

export type TelemetryReconciliationVerdict = (typeof TELEMETRY_RECONCILIATION_VERDICTS)[number];

/** The reading basis naming which capture plane a report's figures come from (DM-3). */
export const TELEMETRY_READING_BASES = ["stream-ingest", "closeout-capture", "combined"] as const;

export type TelemetryReadingBasis = (typeof TELEMETRY_READING_BASES)[number];

/** The telemetry-state disclosure value for a report over present records (DM-4). */
export const TELEMETRY_STATE_PRESENT = "present" as const;

export type TelemetryState = typeof TELEMETRY_STATE_PRESENT | "absent";

/**
 * The closed v2 warning-reason vocabulary (GAP-4): the delivered harness
 * vocabulary extended additively, never forked. The five degradation classes
 * map onto it as: omission → `optional-field-absent`, drift → `version-drift`,
 * unattributable → `unattributable-step`, baseline exclusion →
 * `baseline-session-excluded`, truncation → `truncated`.
 */
export const TELEMETRY_WARNING_REASONS = [
  ...HARNESS_WARNING_REASONS,
  "unattributable-step",
  "baseline-session-excluded",
] as const;

export type TelemetryWarningReason = (typeof TELEMETRY_WARNING_REASONS)[number];

/** One warning: the closed reason plus the affected field or dimension. */
export type TelemetryWarning = {
  readonly reason: TelemetryWarningReason;
  readonly field: string;
};

// ---------------------------------------------------------------------------
// Frame vocabulary (F-1, OQ-T1): resolved by the committed token-bearing
// v2.x.y capture, declared once here so ingest never hardcodes wire literals.
// ---------------------------------------------------------------------------

/** The stream event type carrying one step's completion facts. */
export const TELEMETRY_STEP_FRAME_TYPE = "step_finish" as const;

/** The `part.type` value inside a completion frame. */
export const TELEMETRY_STEP_FINISH_PART_TYPE = "step-finish" as const;

/** The part field carrying the five token classes. */
export const TELEMETRY_FRAME_TOKENS_FIELD = "tokens" as const;

/** The part field carrying the step's cost in harness-reported units. */
export const TELEMETRY_FRAME_COST_FIELD = "cost" as const;

/** The optional part field carrying an explicit per-step call count. */
export const TELEMETRY_FRAME_CALLS_FIELD = "calls" as const;

// ---------------------------------------------------------------------------
// Attribution vocabulary (F-2, RSK-3).
// ---------------------------------------------------------------------------

/** How an unattributed dimension is folded: excluded and disclosed, never guessed. */
export const TELEMETRY_UNATTRIBUTED_DIMENSION_RULE = "exclude-and-disclose" as const;

// ---------------------------------------------------------------------------
// Reconciliation arithmetic (DEC-5, OQ-T4).
// ---------------------------------------------------------------------------

/**
 * The declared combination arithmetic (OQ-T4), pinned by the contract suite:
 * sessions are deduplicated by id; observed takes the stream step sums when a
 * session has steps, else its closeout group sums; a session present in both
 * planes contributes step sums to observed while its closeout sums corroborate
 * as baseline input. Summing both planes for one session inflates observed and
 * must surface as the declared outside verdict.
 */
export const TELEMETRY_SESSION_COMBINATION_RULE =
  "dedupe-by-sessionId: per session, observed takes stream step sums when steps exist, else closeout group sums; closeout sums corroborate as baseline input only" as const;

// ---------------------------------------------------------------------------
// Spend v2 additive keys (DEC-6): beside the delivered six, same identity.
// ---------------------------------------------------------------------------

/** The five declared breakdown selection fields (F-5), exactly five. */
export const SPEND_BREAKDOWN_FIELDS = ["ticket", "repository", "lane", "role", "model"] as const;

export type SpendBreakdownField = (typeof SPEND_BREAKDOWN_FIELDS)[number];

/** The v2 additive `data` keys, declared beside the delivered six (DM-6, DEC-6). */
export const SPEND_V2_DATA_KEYS = [
  "costTotals",
  "breakdowns",
  "phaseTiming",
  "telemetryState",
  "reconciliation",
] as const;

// ---------------------------------------------------------------------------
// Record shapes (DM-1, OQ-T2 §1).
// ---------------------------------------------------------------------------

/** The five token counts; an unreported class is `null` and carries a warning. */
export type TelemetryStepTokens = Readonly<Record<HarnessTokenClass, number | null>>;

/** The reconciliation block every summary carries (DM-3). */
export type TelemetryReconciliation = {
  readonly basis: TelemetryReadingBasis;
  readonly harnessTotals: TelemetryStepTokens | null;
  readonly observedTotals: TelemetryStepTokens;
  readonly tolerance: typeof TELEMETRY_RECONCILIATION_TOLERANCE;
  readonly verdict: TelemetryReconciliationVerdict;
  readonly excludedBaselineSessions: number;
};

/** One captured step's telemetry with its five-dimension attribution (DM-1). */
export type TelemetryStepRecord = {
  readonly schemaId: typeof TELEMETRY_STEP_SCHEMA_ID;
  readonly storageVersion: typeof TELEMETRY_STORAGE_SCHEMA_VERSION;
  readonly workItemRef: string;
  readonly runId: string;
  readonly sessionId: string;
  readonly harnessKind: HarnessKind;
  readonly harnessVersion: string | null;
  readonly treeRoot: string | null;
  readonly model: string | null;
  readonly ticket: string | null;
  readonly repository: string | null;
  readonly lane: string | null;
  readonly agentRole: string | null;
  readonly tokens: TelemetryStepTokens;
  readonly calls: number | null;
  readonly cost: number | null;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly warnings: readonly TelemetryWarning[];
  readonly capturedAt: string;
};

/** One session's captured harness-reported totals (OQ-T2 §1 baseline record). */
export type TelemetryBaselineRecord = {
  readonly schemaId: typeof TELEMETRY_BASELINE_SCHEMA_ID;
  readonly storageVersion: typeof TELEMETRY_STORAGE_SCHEMA_VERSION;
  readonly workItemRef: string;
  readonly runId: string;
  readonly sessionId: string;
  readonly tokens: TelemetryStepTokens;
  readonly calls: number | null;
  readonly cost: number | null;
  readonly capturedAt: string;
  readonly warnings: readonly HarnessTelemetryWarning[];
};

/** The ingest accounting counts every stream discloses (§10). */
export type TelemetryIngestCounts = {
  readonly captured: number;
  readonly degraded: number;
  readonly failed: number;
};

/**
 * The injected ingest sink (composition edge only).
 *
 * The adapter feeds each decoded frame beside the delivered drain; the sink
 * owns counting, attribution, storage, and the session-close baseline capture.
 * Per-frame work is bounded and constant-memory; an absent sink keeps the
 * delivered stream behavior exactly.
 */
export type TelemetryIngestSink = {
  readonly onFrame: (
    frame: Readonly<Record<string, unknown>>,
    context: { readonly sessionId: string | undefined },
  ) => void;
  readonly onSessionClose: (sessionId: string) => void;
};
