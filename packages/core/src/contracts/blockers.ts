/**
 * The typed blocker and question-channel vocabulary (GH-230 F-1..F-7,
 * DM-1..DM-6).
 *
 * Runtime-neutral by construction: types and `as const` data only. The closed
 * question-type set with its per-type answer channel, the audience set consumed
 * from the delivered owner-gate seam, the type-derived priority map, the
 * delegation policy-as-data map, the resume projection rules, the
 * variable-name shape, the content/render bounds, and the two additive record
 * kinds are declared once here. The pure domain and the command consume them.
 * No clock, randomness, environment, filesystem, or network access exists in
 * this module.
 */
import { OWNER_GATE_SLA_AUDIENCES } from "./owner-gate-sla.js";
import {
  STATUS_MAX_HUMAN_BYTES,
  STATUS_MAX_HUMAN_LINES,
  STATUS_MAX_ITEMS_PER_SECTION,
  STATUS_MAX_MACHINE_BYTES,
} from "./status.js";

/** The closed four-type question vocabulary in declared order (DEC-1, DM-5). */
export const BLOCKER_QUESTION_TYPES = [
  "decision-needed",
  "spec-ambiguity",
  "credential-missing",
  "external-wait",
] as const;
export type BlockerQuestionType = (typeof BLOCKER_QUESTION_TYPES)[number];

/** The two answer channels (DEC-1). */
export const BLOCKER_ANSWER_CHANNELS = ["choice", "text"] as const;
export type BlockerAnswerChannel = (typeof BLOCKER_ANSWER_CHANNELS)[number];

/** The pinned per-type answer channel: choice only for options-bearing questions. */
export const BLOCKER_ANSWER_CHANNEL_BY_TYPE: Readonly<
  Record<BlockerQuestionType, BlockerAnswerChannel>
> = {
  "decision-needed": "choice",
  "spec-ambiguity": "text",
  "credential-missing": "text",
  "external-wait": "text",
} as const;

/** The audience set, consumed from the delivered owner-gate seam (DEC-3). */
export const BLOCKER_AUDIENCES = OWNER_GATE_SLA_AUDIENCES;
export type BlockerAudience = (typeof BLOCKER_AUDIENCES)[number];

/** The safe publish default when `--audience` is absent (DEC-3). */
export const BLOCKER_DEFAULT_AUDIENCE = "coordinator" as const satisfies BlockerAudience;

/** The type-derived priority classes (DEC-7); lower sorts first. */
export const BLOCKER_PRIORITY_BY_TYPE: Readonly<Record<BlockerQuestionType, 1 | 2 | 3>> = {
  "decision-needed": 1,
  "credential-missing": 1,
  "spec-ambiguity": 2,
  "external-wait": 3,
} as const;

/** The closed priority classes in ascending order (DEC-7). */
export const BLOCKER_PRIORITY_CLASSES = [1, 2, 3] as const;
export type BlockerPriorityClass = (typeof BLOCKER_PRIORITY_CLASSES)[number];

/** The closed three-value resume-mode vocabulary in declared order (DM-3). */
export const BLOCKER_RESUME_MODES = [
  "boundary-note",
  "attach-continue",
  "resume-prompt-reentry",
] as const;
export type BlockerResumeMode = (typeof BLOCKER_RESUME_MODES)[number];

/** The closed two-value capability-source vocabulary (DM-3). */
export const BLOCKER_CAPABILITY_SOURCES = ["adapter-declared", "capability-absent"] as const;
export type BlockerCapabilitySource = (typeof BLOCKER_CAPABILITY_SOURCES)[number];

/** The non-re-entry modes a capability-declaring adapter may name (DEC-5). */
export const BLOCKER_DECLARED_RESUME_MODES = ["boundary-note", "attach-continue"] as const;
export type BlockerDeclaredResumeMode = (typeof BLOCKER_DECLARED_RESUME_MODES)[number];

/** The stable default when the capability declares injection without a mode (GAP-8). */
export const BLOCKER_DEFAULT_RESUME_MODE = "boundary-note" as const satisfies BlockerResumeMode;

/** The acknowledged fallback when resume injection is absent (DEC-5). */
export const BLOCKER_FALLBACK_RESUME_MODE =
  "resume-prompt-reentry" as const satisfies BlockerResumeMode;

/** The pinned re-entry posture: true only for the fallback (DM-3). */
export const BLOCKER_SESSION_REENTRY_BY_MODE: Readonly<Record<BlockerResumeMode, boolean>> = {
  "boundary-note": false,
  "attach-continue": false,
  "resume-prompt-reentry": true,
} as const;

/** The visible prefill-cost marker present only on the fallback (GAP-9). */
export const BLOCKER_PREFILL_COST = "full-context-reprefill" as const;

/** The declared variable-name shape a `credential-missing` question must match (DEC-2). */
export const BLOCKER_VARIABLE_NAME_PATTERN = "^[A-Z][A-Z0-9_]*$" as const;

/** Question-text content cap in characters (NFR-4). */
export const BLOCKER_MAX_QUESTION_CHARS = 120 as const;
/** Ordered-options cap per question (NFR-4). */
export const BLOCKER_MAX_OPTIONS = 4 as const;
/** One option-value cap in characters (NFR-4). */
export const BLOCKER_MAX_OPTION_CHARS = 60 as const;
/** Free-text answer cap in characters (NFR-4). */
export const BLOCKER_MAX_ANSWER_CHARS = 160 as const;

/** Rendered questions per surface, reused by reference from the digest (NFR-4). */
export const BLOCKERS_MAX_QUESTIONS = STATUS_MAX_ITEMS_PER_SECTION;
/** Machine `data` byte cap, reused by reference from the digest (NFR-4). */
export const BLOCKERS_MAX_MACHINE_BYTES = STATUS_MAX_MACHINE_BYTES;
/** Human render line cap, reused by reference from the digest (NFR-4). */
export const BLOCKERS_MAX_HUMAN_LINES = STATUS_MAX_HUMAN_LINES;
/** Human render byte cap, reused by reference from the digest (NFR-4). */
export const BLOCKERS_MAX_HUMAN_BYTES = STATUS_MAX_HUMAN_BYTES;

/** The additive question record kind inside `delivery.state.v1` (EVT-1, DM-1). */
export const BLOCKER_QUESTION_RECORD_KIND = "blocker.question" as const;
/** The additive answer record kind inside `delivery.state.v1` (EVT-2, DM-2). */
export const BLOCKER_ANSWER_RECORD_KIND = "blocker.answer" as const;

/** The question payload schema identifier (EVT-1, DM-1, DEC-11). */
export const BLOCKER_QUESTION_PAYLOAD_SCHEMA = "delivery.blocker.question.v1" as const;
/** The answer payload schema identifier (EVT-2, DM-2, DEC-11). */
export const BLOCKER_ANSWER_PAYLOAD_SCHEMA = "delivery.blocker.answer.v1" as const;

/** The list/answer/publish machine payload schema (DM-1..DM-3). */
export const BLOCKERS_SCHEMA_VERSION = "delivery.blockers.v1" as const;

/** The caller-audience environment suffix, named through the branding seam (DEC-4, GAP-10). */
export const BLOCKER_CALLER_AUDIENCE_SUFFIX = "CALLER_AUDIENCE" as const;

/** The candidate-audience values (the resolver normalizes these exactly). */
export const BLOCKER_CALLER_AUDIENCE_VALUES = ["owner", "coordinator"] as const;

/** The owner-gate counterpart of a question audience, copied as a type alias. */
export type BlockerDelegationPolicyLabel = "allowed" | "none";

/** One row of the closed delegation policy-as-data map (DM-4, DEC-3). */
export type BlockerDelegationPolicyRow = {
  readonly questionAudience: BlockerAudience;
  readonly answeringAudience: BlockerAudience;
  readonly allowed: boolean;
  readonly policy: BlockerDelegationPolicyLabel;
};

/** The shipped PDR-0003-shaped four-row delegation map (DEC-3). */
export const BLOCKER_DELEGATION_POLICY_ROWS = [
  {
    questionAudience: "owner",
    answeringAudience: "owner",
    allowed: true,
    policy: "allowed",
  },
  {
    questionAudience: "owner",
    answeringAudience: "coordinator",
    allowed: true,
    policy: "allowed",
  },
  {
    questionAudience: "coordinator",
    answeringAudience: "coordinator",
    allowed: true,
    policy: "allowed",
  },
  {
    questionAudience: "coordinator",
    answeringAudience: "owner",
    allowed: false,
    policy: "none",
  },
] as const satisfies readonly BlockerDelegationPolicyRow[];

/** The injectable delegation policy snapshot. */
export type BlockerDelegationPolicy = {
  readonly rows: readonly BlockerDelegationPolicyRow[];
};

/** The shipped delegation policy consumed by the pure resolver (DM-4). */
export const BLOCKER_DELEGATION_POLICY = {
  rows: BLOCKER_DELEGATION_POLICY_ROWS,
} as const satisfies BlockerDelegationPolicy;

/** The closed blockers error-family codes (DEC-9). */
export const BLOCKERS_ERROR_CODES = [
  "blockers.invalid-type",
  "blockers.unknown-id",
  "blockers.credential-value-rejected",
  "blockers.audience-mismatch",
] as const;
export type BlockersErrorCode = (typeof BLOCKERS_ERROR_CODES)[number];

/** The declared lane id shape is not enforced; identifiers are recorded as given. */
export type BlockerLane = string;

/** The append-only question payload (DM-1, EVT-1). */
export type BlockerQuestionRecord = {
  readonly schemaId: typeof BLOCKER_QUESTION_PAYLOAD_SCHEMA;
  readonly id: string;
  readonly type: BlockerQuestionType;
  readonly audience: BlockerAudience;
  readonly lane: string;
  readonly ref: string | null;
  readonly question: string;
  readonly options: readonly string[];
  readonly askedAt: string;
};

/** The recorded resume projection embedded in every answer (DM-3). */
export type BlockerLaneResume = {
  readonly mode: BlockerResumeMode;
  readonly sessionReentry: boolean;
  readonly capabilitySource: BlockerCapabilitySource;
  readonly prefillCost?: typeof BLOCKER_PREFILL_COST;
};

/** The append-only answer intent payload (DM-2, EVT-2). */
export type BlockerAnswerRecord = {
  readonly schemaId: typeof BLOCKER_ANSWER_PAYLOAD_SCHEMA;
  readonly questionId: string;
  readonly answeringAudience: BlockerAudience;
  readonly choice?: string;
  readonly text?: string;
  readonly answeredAt: string;
  readonly applied: false;
  readonly laneResume: BlockerLaneResume;
};

/** The published-question view shared by every ranked surface (GAP-6/GAP-11). */
export type BlockerQuestionView = {
  readonly id: string;
  readonly type: BlockerQuestionType;
  readonly audience: BlockerAudience;
  readonly lane: string;
  readonly ref: string | null;
  readonly question: string;
  readonly options: readonly string[];
  readonly askedAt: string;
  readonly age: number;
  readonly rank?: number;
  readonly status: "open";
};

/** The resolved answered record in the list's resolved group (GAP-6). */
export type BlockerAnsweredView = {
  readonly id: string;
  readonly type: BlockerQuestionType;
  readonly audience: BlockerAudience;
  readonly lane: string;
  readonly ref: string | null;
  readonly question: string;
  readonly options: readonly string[];
  readonly askedAt: string;
  readonly age: number;
  readonly status: "answered";
  readonly answer: {
    readonly choice?: string;
    readonly text?: string;
    readonly answeringAudience: BlockerAudience;
    readonly answeredAt: string;
  };
};

/** One rendered list row: an open ranked question or a resolved answer. */
export type BlockerListQuestion = BlockerQuestionView | BlockerAnsweredView;

/** The bounded `blockers list` machine payload (F-7, DM-1). */
export type BlockerListData = {
  readonly schemaVersion: typeof BLOCKERS_SCHEMA_VERSION;
  readonly questions: readonly BlockerListQuestion[];
  readonly truncated: boolean;
  readonly omitted: number;
};

/** The bounded `blockers publish` machine payload (GAP-11). */
export type BlockerPublishData = {
  readonly schemaVersion: typeof BLOCKERS_SCHEMA_VERSION;
  readonly question: BlockerQuestionRecord;
};

/** The bounded `blockers answer` machine payload (F-5, DM-2, DM-3). */
export type BlockerAnswerData = {
  readonly schemaVersion: typeof BLOCKERS_SCHEMA_VERSION;
  readonly answered: string;
  readonly audience: BlockerAudience;
  readonly choice?: string;
  readonly text?: string;
  readonly applied: false;
  readonly laneResume: BlockerLaneResume;
};

/** The publish request validated by the pure domain (F-2, GAP-5). */
export type BlockerPublishInput = {
  readonly type: string;
  readonly audience?: string;
  readonly lane: string;
  readonly ref?: string | null;
  readonly question: string;
  readonly options?: readonly string[];
};

/** The answer request validated by the pure domain (F-2, GAP-5). */
export type BlockerAnswerInput = {
  readonly questionId: string;
  readonly choice?: string;
  readonly text?: string;
};

/** The injected harness-adapter resume-injection fact (DM-3, DEC-5). */
export type BlockerCapabilityFact = {
  readonly resumeInjection: boolean;
  readonly mode?: string;
};

/** The recorded open/answered fold the ranked surfaces consume (DEC-11). */
export type BlockerLedgerView = {
  readonly questions: readonly BlockerQuestionRecord[];
  readonly answers: readonly BlockerAnswerRecord[];
  readonly verifiedEmpty: boolean;
};
