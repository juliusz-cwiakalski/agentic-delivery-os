/**
 * The `delivery.brief.v1` vocabulary (GH-228 F-2..F-4, DM-1..DM-5).
 *
 * Runtime-neutral by construction: types and `as const` data only. The closed
 * surface set, the closed three-entry placeholder catalog, and the anchor model
 * are declared once here; the pure projection and renderer consume them. Every
 * digest section state, count, truncation, and evidence reference is imported
 * from `./status.js`; no parallel vocabulary or numeric bound is declared.
 */

import type { DeliveryRequestReviewState } from "./ports.js";
import type * as statusVocabulary from "./status.js";
import type {
  StatusCounts,
  StatusEvidenceReason,
  StatusItemSignalState,
  StatusRepositoryBinding,
} from "./status.js";

/** The brief payload schema (DM-1). */
export const BRIEF_SCHEMA_VERSION = "delivery.brief.v1" as const;

/** The closed two-entry placeholder catalog (DM-3, DEC-5, DEC-6). */
export const BRIEF_PLACEHOLDER_CATALOG = [
  { capability: "gate-sla-states", owningStory: "M1-S5", state: "not-delivered" },
  { capability: "lane-queue-engine", owningStory: "M1-S17", state: "not-delivered" },
] as const;

/** One closed-catalog placeholder record: capability, owning story, evidence state. */
export type BriefPlaceholderEntry = (typeof BRIEF_PLACEHOLDER_CATALOG)[number];

/** The closed placeholder capability ids (DM-3, DEC-6). */
export type BriefPlaceholderId = BriefPlaceholderEntry["capability"];

/** The digest's closed five-value section-state vocabulary, reused by reference (DM-4). */
export type BriefSurfaceState = (typeof statusVocabulary.STATUS_SECTION_STATES)[number];

/** The two placeholder surface ids (the catalog capabilities are surfaces, DM-5). */
export const BRIEF_PLACEHOLDER_SURFACE_IDS = ["gate-sla-states", "lane-queue-engine"] as const;

/** One placeholder surface id. */
export type BriefPlaceholderSurfaceId = (typeof BRIEF_PLACEHOLDER_SURFACE_IDS)[number];

/** The closed nine-id render-surface set (DM-5): seven digest surfaces plus two placeholders. */
export const BRIEF_SURFACE_ORDER = [
  "tracker",
  "changes-and-prs",
  "ci",
  "lanes-or-queue",
  "providers",
  "parked-work",
  "typed-questions",
  "gate-sla-states",
  "lane-queue-engine",
] as const;

/** One closed render-surface id. */
export type BriefSurfaceId = (typeof BRIEF_SURFACE_ORDER)[number];

/** The three decision-first anchored-action groups (D4). */
export const BRIEF_ANCHOR_GROUPS = [
  "ready-to-merge",
  "blocker-questions",
  "owner-gate-ages",
] as const;

/** One anchored-action group id. */
export type BriefAnchorGroupId = (typeof BRIEF_ANCHOR_GROUPS)[number];

/** Human titles for the two placeholder surfaces (never part of the closed catalog). */
export const BRIEF_PLACEHOLDER_TITLES = {
  "gate-sla-states": "Gate SLA states",
  "lane-queue-engine": "Lane/queue engine",
} as const;

/** One brief surface: exactly one digest section state or one placeholder state (DM-1, DM-5). */
export type BriefSurface = {
  readonly id: BriefSurfaceId;
  readonly title: string;
  readonly state: BriefSurfaceState;
  readonly counts: StatusCounts;
  readonly truncated: boolean;
  readonly reason?: StatusEvidenceReason;
};

/** The citing digest evidence of a ready-to-merge action (DM-2, D10). */
export type BriefPullRequestEvidence = {
  readonly kind: "pull-request";
  readonly deliveryState: DeliveryRequestReviewState;
  readonly draft: boolean;
  readonly reviewState: StatusItemSignalState;
};

/** The citing digest evidence of an owner-gate age (DM-2, §4.5). */
export type BriefOwnerGateEvidence = {
  readonly kind: "owner-hand-back";
  readonly ageState: "observed" | "unknown";
  readonly ageDays?: number;
};

/** The citing digest evidence of a ranked blocker question (DM-6). */
export type BriefBlockerQuestionEvidence = {
  readonly kind: "blocker-question";
  readonly type: string;
  readonly audience: string;
  readonly lane: string;
  readonly rank: number;
};

/** The bounded evidence an anchored action cites; never a verdict or authorization. */
export type BriefActionEvidence =
  | BriefPullRequestEvidence
  | BriefOwnerGateEvidence
  | BriefBlockerQuestionEvidence;

/** One ranked anchored action record (DM-2). */
export type BriefAction = {
  readonly identity: string;
  readonly state: BriefSurfaceState;
  readonly evidence: BriefActionEvidence;
};

/** One ranked anchored-action group: state plus its ranked items (DM-1, DM-2, D4). */
export type BriefAnchorGroup = {
  readonly group: BriefAnchorGroupId;
  readonly state: BriefSurfaceState;
  readonly items: readonly BriefAction[];
  readonly truncated: boolean;
  readonly omitted: number;
};

/** The target of an explicit truncation marker. */
export type BriefTruncationTarget = BriefSurfaceId | BriefAnchorGroupId;

/** One explicit truncation marker; never a silent drop (NFR-1). */
export type BriefTruncation = {
  readonly target: BriefTruncationTarget;
  readonly omitted: number;
};

/** The complete bounded `delivery.brief.v1` payload (DM-1). */
export type BriefPayload = {
  readonly schemaVersion: typeof BRIEF_SCHEMA_VERSION;
  readonly generatedAt: string;
  readonly repository: StatusRepositoryBinding;
  readonly surfaces: readonly BriefSurface[];
  readonly anchors: readonly BriefAnchorGroup[];
  readonly placeholders: readonly BriefPlaceholderEntry[];
  readonly truncation: readonly BriefTruncation[];
};
