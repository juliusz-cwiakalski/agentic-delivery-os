/**
 * The `delivery.spend.v1` read-side vocabulary (GH-236 F-1..F-8, DM-1..DM-6).
 *
 * Runtime-neutral by construction: types and `as const` data only. The spend
 * read side folds closeout-captured `harness.telemetry` records plus the
 * change's `phase.transition` history; it never re-queries a harness store and
 * never writes. Every declared bound, ordering key, disclosure statement and
 * closed vocabulary lives here so the engine, the command surface and the
 * status digest assert through one declaration.
 */
import type {
  HarnessCaptureOutcomeRecord,
  HarnessTelemetryRecord,
  HarnessTokenClass,
  HarnessWarningReason,
} from "./harness-telemetry.js";
import type { PmNotesPhaseId } from "./pm-notes.js";
import type { PhaseTransitionRecord } from "./registry.js";
import type { StateFailure, StateSafeLocation } from "./state.js";

/** The only home of the spend report data schema identifier (PIN-1, TP-DEC-9). */
export const SPEND_DATA_SCHEMA_ID = "delivery.spend.v1" as const;

/** The selection's phase fallback for a ref without transition history (DM-2). */
export const SPEND_PHASE_UNKNOWN = "unknown" as const;

/** A selected phase: one canonical delivery phase or the named `unknown` window. */
export type SpendPhaseId = PmNotesPhaseId | typeof SPEND_PHASE_UNKNOWN;

/** The exactly-six `data` keys, in their declared order (DM-1 exactness). */
export const SPEND_DATA_KEYS = [
  "tokensByClass",
  "perPhase",
  "perAgent",
  "restarts",
  "amplification",
  "degradation",
] as const;

/** The exactly-three `amplification` keys (DM-1, DEC-11). */
export const SPEND_AMPLIFICATION_KEYS = ["ratio", "progressRun", "events"] as const;

/** The closed single-entry v0 amplification cause vocabulary (DM-3). */
export const SPEND_AMPLIFICATION_CAUSES = ["restart-loop prefill re-pay"] as const;
export type SpendAmplificationCause = (typeof SPEND_AMPLIFICATION_CAUSES)[number];

/** The machine-payload byte bound (NFR-1, PIN-2). */
export const SPEND_MAX_MACHINE_BYTES = 65_536 as const;

/** The human-digest byte bound (NFR-1, PIN-2). */
export const SPEND_MAX_HUMAN_BYTES = 16_384 as const;

/** The human-digest line bound (NFR-1, PIN-2). */
export const SPEND_MAX_HUMAN_LINES = 200 as const;

/** The truncation marker label carried in the truncated channel (PIN-3). */
export const SPEND_TRUNCATION_MARKER = "truncated" as const;

/** The declared truncation tail order: `perAgent[]` first, then `perPhase[]`. */
export const SPEND_TRUNCATION_TARGETS = ["perAgent", "perPhase"] as const;

/** The declared `perAgent[]` total order (PIN-3, TP-DEC-5). */
export const SPEND_AGENT_ORDER = ["tokens-desc", "agent-asc", "model-asc"] as const;

/** The declared `perPhase[]` total order; the `unknown` window sorts last. */
export const SPEND_PHASE_ORDER = ["window-start-asc", "phase-id-asc"] as const;

/**
 * The honesty-limit disclosures, declared once and rendered verbatim (PIN-9).
 *
 * A reviewed rewording updates this constant and its golden together; the
 * human amplification section never invents a stronger claim than the formula
 * supports.
 */
export const SPEND_DISCLOSURES = [
  "run duplication is proven; semantic duplication is not",
  "runs that never reached closeout capture are invisible to this report",
  "restart counts share that capture-reached evidence basis",
  "a zero-token progress run reports no ratio and is named in amplification.progressRun (paid > 0 or paid = 0)",
] as const;

/** The canonical work-item ref grammar, case-sensitive with no folding (DEC-6). */
export const SPEND_WORK_ITEM_REF_PATTERN = "^[A-Z][A-Z0-9]*-[0-9]+$" as const;

/** The one declared spend failure identity (DM-5, DEC-7). */
export const SPEND_TELEMETRY_ABSENT_CODE = "spend.telemetry-absent" as const;

/** The five-class token totals; a class absent at capture never fabricates zero. */
export type SpendTokenTotals = Readonly<Record<HarnessTokenClass, number>>;

/** One per-phase entry: one entry per phase id, aggregating its windows (PIN-5). */
export type SpendPhaseEntry = {
  readonly phase: SpendPhaseId;
  readonly calls: number;
  readonly tokens: number;
  readonly share: number;
};

/** One per-(agent, model) roll-up across every captured run (F-4). */
export type SpendAgentEntry = {
  readonly agent: string;
  readonly model: string;
  readonly calls: number;
  readonly tokens: number;
};

/** One amplification event window: `start` and `end` are captured-at stamps. */
export type SpendAmplificationWindow = {
  readonly start: string;
  readonly end: string;
};

/** One named amplification event (AC-F5-2, DM-3). */
export type SpendAmplificationEvent = {
  readonly cause: SpendAmplificationCause;
  readonly window: SpendAmplificationWindow;
  readonly tokensWasted: number;
};

/** The resume-amplification block (AC-F5-1..3, DM-3, DEC-11). */
export type SpendAmplification = {
  readonly ratio: number | null;
  /**
   * The progress run's identity exactly when it contributed zero-token spend
   * (the `ratio: null` case, covering paid > 0 and paid = 0); null whenever
   * the progress run carries positive spend and no record-bearing run exists.
   */
  readonly progressRun: string | null;
  readonly events: readonly SpendAmplificationEvent[];
};

/** The degradation disclosure keyed over the closed warning vocabulary (PIN-8). */
export type SpendDegradation = {
  readonly records: number;
  readonly byReason: Readonly<Record<HarnessWarningReason, number>>;
};

/** The `delivery.spend.v1` report data carried inside the result envelope. */
export type SpendReport = {
  readonly tokensByClass: SpendTokenTotals;
  readonly perPhase: readonly SpendPhaseEntry[];
  readonly perAgent: readonly SpendAgentEntry[];
  readonly restarts: number;
  readonly amplification: SpendAmplification;
  readonly degradation: SpendDegradation;
};

/** The counts dropped from each truncation tail (PIN-3). */
export type SpendTruncation = {
  readonly agents: number;
  readonly phases: number;
};

/** The verified-ledger evidence a spend read carries (store path and position). */
export type SpendLedgerEvidence = {
  readonly storePath: string;
  readonly recordCount: number;
};

/**
 * One classified spend read: both telemetry families for the exact ref plus
 * that ref's transition history (PIN-12). Every record-bearing field is
 * already verified; `verifiedEmpty` is the explicit absence evidence.
 */
export type SpendLedgerRead = {
  readonly workItemRef: string;
  readonly records: readonly HarnessTelemetryRecord[];
  readonly outcomes: readonly HarnessCaptureOutcomeRecord[];
  readonly transitions: readonly PhaseTransitionRecord[];
  readonly transitionsPresent: boolean;
  readonly verifiedEmpty: boolean;
  readonly evidence: SpendLedgerEvidence;
};

/** The resolved selection one fold consumes (PIN-6). */
export type SpendSelection = {
  readonly workItemRef: string;
  readonly phase?: SpendPhaseId;
};

/**
 * The status-digest projection of the same fold (DM-6, DEC-8).
 *
 * `captured: true` carries the summary figures; `captured: false` is the
 * verified-empty observation (never a zero-spend claim); `unknown` carries the
 * state failure code as digest data.
 */
export type SpendDigestSection =
  | {
      readonly state: "observed";
      readonly captured: true;
      readonly tokensByClass: SpendTokenTotals;
      readonly restarts: number;
      readonly ratio: number | null;
    }
  | { readonly state: "observed"; readonly captured: false }
  | {
      readonly state: "unknown";
      readonly reason: "state-unreadable" | "local-context-missing";
      readonly failureCode: string;
    };

/** One classified spend-command failure: absence or a delivered state identity. */
export type SpendCommandFailure =
  | {
      readonly kind: "spend";
      readonly code: typeof SPEND_TELEMETRY_ABSENT_CODE;
      readonly summary?: string;
    }
  | {
      readonly kind: "state";
      readonly code: StateFailure["code"];
      readonly consequence: "not_landed";
      readonly location: StateSafeLocation;
    };

/** The outcome the injected spend runtime returns to the command handler. */
export type SpendCommandOutcome =
  | {
      readonly ok: true;
      readonly data: SpendReport;
      readonly warnings?: readonly string[];
    }
  | { readonly ok: false; readonly error: SpendCommandFailure };

/**
 * The injected spend runtime (composition edge only).
 *
 * `resolveActiveRef` answers the omitted-`--ref` default from the local
 * delivery context without touching the state store; `report` performs the
 * verified read and the pure fold.
 */
export type SpendCommandRuntime = {
  readonly resolveActiveRef: () => { readonly ref: string } | { readonly ref: null };
  readonly report: (selection: SpendSelection) => SpendCommandOutcome;
};

/** The declared `--amplification` human-emphasis flag name. */
export const SPEND_HUMAN_AMPLIFICATION_FLAG = "--amplification" as const;

/** The declared spend flag set, in the locked grammar order (PIN-11). */
export const SPEND_FLAGS = ["--ref", "--phase", SPEND_HUMAN_AMPLIFICATION_FLAG] as const;
