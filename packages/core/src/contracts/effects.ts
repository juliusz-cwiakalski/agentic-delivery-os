/**
 * External-effect vocabulary (GH-238 F-10; DM-9, DM-10, DM-11, DM-18;
 * TDR-0014 INV-1..INV-8).
 *
 * Runtime-neutral: types and `as const` data only. An effect is intent first,
 * receipt second. A commit intent carries a message-independent identity:
 * baseline HEAD, change ref, phase, and the sorted normalized staged path set.
 * No message, subject, body, or fingerprint is representable.
 */
import type { CallerPrincipal } from "./principal.js";

export const EFFECT_KINDS = ["tracker-transition", "tracker-comment", "commit"] as const;
export type EffectKind = (typeof EFFECT_KINDS)[number];

export const EFFECT_STATES = ["accepted", "in-flight", "applied", "failed", "unknown"] as const;
export type EffectState = (typeof EFFECT_STATES)[number];

export const EFFECT_RECEIPT_STATUSES = ["applied", "already-applied", "failed", "unknown"] as const;
export type EffectReceiptStatus = (typeof EFFECT_RECEIPT_STATUSES)[number];

export const EFFECT_QUERY_VERDICTS = ["found", "not-found", "unreadable"] as const;
export type EffectQueryVerdict = (typeof EFFECT_QUERY_VERDICTS)[number];

export const EFFECT_CHECK_STRATEGIES = ["query-by-id", "query-by-log-since"] as const;
export type EffectCheckStrategy = (typeof EFFECT_CHECK_STRATEGIES)[number];

export const COMMAND_RECEIPT_SCHEMA = "delivery.command.receipt.v1" as const;
export const OUTBOX_EFFECT_SCHEMA = "delivery.outbox.effect.v1" as const;

/** One bounded evidence field; never free-form content. */
export type EffectEvidence = { readonly key: string; readonly value: string };

/**
 * The commit identity (INV-2, INV-3): baseline plus ref, phase, and the sorted
 * normalized staged path set. The idempotency key is deterministic over
 * (changeRef, phase, baselineHead).
 */
export type CommitEffectIdentity = {
  readonly baselineHead: string;
  readonly changeRef: string;
  readonly phase: string;
  readonly stagedPaths: readonly string[];
};

export type OutboxEffectRecord = {
  readonly schema: typeof OUTBOX_EFFECT_SCHEMA;
  readonly effectId: string;
  readonly intentId: string;
  readonly ref: string;
  readonly effectKind: EffectKind;
  readonly target: string;
  readonly payloadDigest: string;
  readonly idempotencyKey: string;
  readonly callerPrincipal?: CallerPrincipal;
  readonly state: EffectState;
  readonly attempts: number;
  readonly checkStrategy: EffectCheckStrategy;
  readonly baselineHead?: string;
  readonly changeRef?: string;
  readonly phase?: string;
  readonly stagedPaths?: readonly string[];
  readonly recordedAt: string;
};

export type CommandReceiptRecord = {
  readonly schema: typeof COMMAND_RECEIPT_SCHEMA;
  readonly effectId: string;
  readonly attempt: number;
  readonly queryVerdict: EffectQueryVerdict;
  readonly status: EffectReceiptStatus;
  readonly evidence: readonly EffectEvidence[];
  readonly discoveredSha?: string;
  readonly baselineHead?: string;
  readonly recordedAt: string;
};

/** The DM-18 redrive detection record: evidence only, never an attempt. */
export type EffectRedriveRequest = {
  readonly effectId: string;
  readonly attempt: 0;
  readonly baselineHead?: string;
  readonly queryVerdict: EffectQueryVerdict;
  readonly discoveredSha?: string;
  readonly recordedAt: string;
};

/** What the owner resolves from the durable originating intent at apply time. */
export type ResolvedEffectContent = {
  readonly target: string;
  readonly contentDigest?: string;
  readonly transition?: string;
};

/** The injected content seam: bounded content resolved from the durable intent. */
export type EffectIntentPort = {
  readonly resolve: (effectId: string) => ResolvedEffectContent | undefined;
};

/** The bounded apply input; the port never receives free-form content. */
export type ExternalEffectApplyInput = {
  readonly effectId: string;
  readonly effectKind: EffectKind;
  readonly ref: string;
  readonly target: string;
  readonly idempotencyKey: string;
  readonly content?: ResolvedEffectContent;
};

export type ExternalEffectApplyOutcome =
  | { readonly status: "applied" | "already-applied"; readonly evidence: readonly EffectEvidence[] }
  | { readonly status: "failed"; readonly evidence: readonly EffectEvidence[] }
  | { readonly status: "unknown"; readonly evidence: readonly EffectEvidence[] };

/** The stable-identity query for check-before-reapply. */
export type ExternalEffectQueryInput = {
  readonly effectId: string;
  readonly effectKind: EffectKind;
  readonly unitOfWork: string;
};

export type ExternalEffectQueryOutcome =
  | { readonly verdict: "found"; readonly evidence: readonly EffectEvidence[] }
  | { readonly verdict: "not-found"; readonly evidence: readonly EffectEvidence[] }
  | { readonly verdict: "unreadable"; readonly evidence: readonly EffectEvidence[] };

/** The injected external-effect write/query port (tracker writes are test-only). */
export type ExternalEffectPort = {
  readonly apply: (input: ExternalEffectApplyInput) => Promise<ExternalEffectApplyOutcome>;
  readonly query: (input: ExternalEffectQueryInput) => Promise<ExternalEffectQueryOutcome>;
};

/** The bounded commit-log read result (TDR-0014 INV-4). */
export type CommitLogEntry = {
  readonly sha: string;
  readonly changedPaths: readonly string[];
};

export type CommitLogRead =
  | { readonly ok: true; readonly commits: readonly CommitLogEntry[]; readonly capped: boolean }
  | { readonly ok: false; readonly detail: string };

/** The bounded log reader injected into the effect protocol. */
export type CommitLogPort = {
  readonly logSince: (baselineHead: string, cap: number) => Promise<CommitLogRead>;
};

/** The pure effect transition decisions (Appendix I). */
export type EffectTransition =
  | { readonly state: "in-flight"; readonly attempts: number }
  | { readonly state: "applied"; readonly attempts: number }
  | { readonly state: "failed"; readonly attempts: number }
  | { readonly state: "unknown"; readonly attempts: number }
  | { readonly state: "reapply"; readonly attempts: number };
