/**
 * The harness-neutral telemetry vocabulary (GH-233 EVT-1, DM-1, DEC-3, DEC-7).
 *
 * One statistics shape serves both harness extractors so aggregation never
 * branches per harness. Records carry numeric statistics and identity
 * references only: no prompt, message body, transcript, diff, tool output, or
 * credential material. Cost degrades to an explicit null with a warning; no
 * figure is fabricated.
 */
import type { HarnessKind } from "./harness.js";

/** The only home of the per-session telemetry payload schema identifier. */
export const HARNESS_TELEMETRY_SCHEMA_ID = "delivery.harness.telemetry.v1" as const;

/** The additive state-ledger record kind shared by session and capture records. */
export const HARNESS_TELEMETRY_RECORD_KIND = "harness.telemetry" as const;

/** The store-scoped key prefix carrying one session record per session. */
export const HARNESS_TELEMETRY_RECORD_KEY_PREFIX = "harness.telemetry:" as const;

/** The capture-outcome payload schema identifier (same record kind). */
export const HARNESS_TELEMETRY_CAPTURE_SCHEMA_ID = "delivery.harness.telemetry.capture.v1" as const;

/** The store-scoped key prefix carrying one capture outcome per delivery run. */
export const HARNESS_TELEMETRY_CAPTURE_KEY_PREFIX = "harness-telemetry-capture:" as const;

/** The five token classes (EVT-1). */
export const HARNESS_TOKEN_CLASSES = [
  "input",
  "output",
  "reasoning",
  "cacheRead",
  "cacheWrite",
] as const;

export type HarnessTokenClass = (typeof HARNESS_TOKEN_CLASSES)[number];

/** The closed degradation-warning vocabulary (NFR-6, DEC-6). */
export const HARNESS_WARNING_REASONS = [
  "optional-field-absent",
  "non-numeric-value",
  "cost-missing",
  "version-drift",
  "malformed-line",
  "truncated",
  "session-capture-failed",
  "unattributable-session",
  "invalid-session-identity",
] as const;

export type HarnessWarningReason = (typeof HARNESS_WARNING_REASONS)[number];

/** One warning: the closed reason plus the affected field or file. */
export type HarnessTelemetryWarning = {
  readonly reason: HarnessWarningReason;
  readonly field: string;
};

/** The five token counts; an absent source is `null` and carries a warning. */
export type HarnessTokenCounts = {
  readonly input: number | null;
  readonly output: number | null;
  readonly reasoning: number | null;
  readonly cacheRead: number | null;
  readonly cacheWrite: number | null;
};

/** One bounded per-tool call count (DEC-7). */
export type HarnessToolCount = {
  readonly tool: string;
  readonly calls: number;
};

/** An explicit truncation mark with the omitted count. */
export type HarnessTruncation = {
  readonly truncated: true;
  readonly omitted: number;
  readonly cap: number;
};

/** One session's neutral telemetry record (EVT-1, DM-1). */
export type HarnessTelemetryRecord = {
  readonly schemaId: typeof HARNESS_TELEMETRY_SCHEMA_ID;
  readonly workItemRef: string;
  readonly runId: string;
  readonly sessionId: string;
  readonly harnessKind: HarnessKind;
  readonly harnessVersion: string | null;
  readonly agent: string;
  readonly model: string;
  readonly treeRoot: string;
  readonly parentChain: readonly string[];
  readonly tokens: HarnessTokenCounts;
  readonly calls: number;
  readonly toolCounts: readonly HarnessToolCount[];
  readonly toolTruncation?: HarnessTruncation;
  readonly cost: number | null;
  readonly capturedAt: string;
  readonly warnings: readonly HarnessTelemetryWarning[];
};

/** One agent roll-up with its call count. */
export type HarnessAgentCount = {
  readonly agent: string;
  readonly calls: number;
};

/** One model roll-up with its call count. */
export type HarnessModelCount = {
  readonly model: string;
  readonly calls: number;
};

/** One session that could not be captured, with a closed reason. */
export type HarnessFailedSession = {
  readonly sessionId: string | null;
  readonly reason: HarnessWarningReason;
};

/** The extraction result: records plus explicit failure and truncation marks. */
export type HarnessTelemetryCapture = {
  readonly workItemRef: string;
  readonly runId: string;
  readonly capturedAt: string;
  readonly records: readonly HarnessTelemetryRecord[];
  readonly agents: readonly HarnessAgentCount[];
  readonly models: readonly HarnessModelCount[];
  readonly failedSessions: readonly HarnessFailedSession[];
  readonly warnings: readonly HarnessTelemetryWarning[];
  readonly sessionTruncation?: HarnessTruncation;
  readonly agentTruncation?: HarnessTruncation;
  readonly modelTruncation?: HarnessTruncation;
};

/** The append result: how many records landed and how many already existed. */
export type HarnessTelemetryAppendReport = {
  readonly appended: number;
  readonly skipped: number;
};

/** The capture-outcome record appended once per delivery run (OQ-T8). */
export type HarnessCaptureOutcomeRecord = {
  readonly schemaId: typeof HARNESS_TELEMETRY_CAPTURE_SCHEMA_ID;
  readonly workItemRef: string;
  readonly runId: string;
  readonly captured: number;
  readonly degraded: number;
  readonly failed: number;
  readonly warnings: readonly HarnessTelemetryWarning[];
  readonly capturedAt: string;
};

/** The machine-payload byte bound shared with the result contract (NFR-4). */
export const HARNESS_TELEMETRY_MAX_MACHINE_BYTES = 65_536 as const;

/** The human-summary byte bound (NFR-4). */
export const HARNESS_TELEMETRY_MAX_HUMAN_BYTES = 4_096 as const;

/** The human-summary line bound (NFR-4). */
export const HARNESS_TELEMETRY_MAX_HUMAN_LINES = 24 as const;

/** The bounded session cap per delivery (NFR-2, OQ-T7). */
export const HARNESS_MAX_SESSIONS = 64 as const;

/** The bounded per-agent tool-name cap (DEC-7, OQ-T7). */
export const HARNESS_MAX_TOOLS_PER_AGENT = 24 as const;

/** The bounded agent-list cap (NFR-4, OQ-T7). */
export const HARNESS_MAX_AGENTS = 16 as const;

/** The bounded model-list cap (NFR-4, OQ-T7). */
export const HARNESS_MAX_MODELS = 16 as const;

/** The declared per-file byte cap for Claude Code transcript reads. */
export const HARNESS_MAX_FILE_BYTES = 8_388_608 as const;

/** The declared per-file line cap for Claude Code transcript reads. */
export const HARNESS_MAX_FILE_LINES = 50_000 as const;
