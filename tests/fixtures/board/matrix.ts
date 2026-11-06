/**
 * Shared owner-gate SLA fact and policy builders (test-plan §4.1/§4.2).
 *
 * Every suite injects facts; nothing here reads the clock, environment, network,
 * or live tree. `2026-11-06T12:00:00Z` is the fixed fixture clock, and activity
 * timestamps are derived from it so a case states only its age delta.
 */
import {
  OWNER_GATE_SLA_POLICY,
  type OwnerGateFact,
  type OwnerGateSlaPolicy,
} from "../../../packages/core/src/contracts/index";

export const BOARD_NOW_ISO = "2026-11-06T12:00:00Z";
export const BOARD_NOW_MS = Date.parse(BOARD_NOW_ISO);
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

export type MutablePolicyRow = {
  kind: string;
  class: string;
  neverMerge: boolean;
  defaultable: boolean;
  default: string | null;
};

export type MutablePolicy = {
  comparator: string;
  escalationThresholdMs: number;
  expiryThresholdMs: number;
  rows: MutablePolicyRow[];
};

export const clonePolicy = (): MutablePolicy =>
  JSON.parse(JSON.stringify(OWNER_GATE_SLA_POLICY)) as MutablePolicy;

/** Narrow a mutable test copy back to the read-only policy shape. */
export const asPolicy = (policy: MutablePolicy): OwnerGateSlaPolicy =>
  policy as unknown as OwnerGateSlaPolicy;

export const shippedPolicy = (): OwnerGateSlaPolicy => ({
  comparator: ">=",
  escalationThresholdMs: 24 * HOUR_MS,
  expiryThresholdMs: 72 * HOUR_MS,
  rows: [
    {
      kind: "owner-review",
      class: "owner-review",
      neverMerge: true,
      defaultable: false,
      default: null,
    },
    {
      kind: "waiver",
      class: "waiver",
      neverMerge: false,
      defaultable: true,
      default: "owner-review-first",
    },
  ],
});

export const atAge = (ageMs: number): string => new Date(BOARD_NOW_MS - ageMs).toISOString();

export type AbsentForm = "missing" | "undefined" | "null" | "empty" | "whitespace";

export type GateFactInput = {
  readonly id: string;
  readonly kind?: string;
  readonly ref?: string;
  readonly ageMs?: number;
  readonly activityAt?: string | null;
  readonly absent?: AbsentForm;
  readonly waivedBy?: string;
};

/** Build one normalized gate fact; exactly one activity form is supplied. */
export const gateFact = (input: GateFactInput): OwnerGateFact => {
  const kind = input.kind ?? "owner-review";
  const ref = input.ref ?? input.id;
  const base = {
    id: input.id,
    kind,
    ref,
    ...(input.waivedBy === undefined ? {} : { waivedBy: input.waivedBy }),
  };
  if (input.absent === "null") return { ...base, activityAt: null };
  if (input.absent === "empty") return { ...base, activityAt: "" };
  if (input.absent === "whitespace") return { ...base, activityAt: "   " };
  if (input.absent === "undefined" || input.absent === "missing") return base;
  if (input.activityAt !== undefined) return { ...base, activityAt: input.activityAt };
  return { ...base, activityAt: atAge(input.ageMs ?? 0) };
};

/** A fixed gate id derived from the ref and kind (deterministic and stable). */
export const gateId = (ref: string, kind = "owner-review"): string => `${ref}:${kind}`;

export const ownerReviewGate = (
  ref: string,
  ageMs: number,
  overrides: Partial<GateFactInput> = {},
): OwnerGateFact =>
  gateFact({
    id: gateId(ref, "owner-review"),
    ref,
    kind: "owner-review",
    ageMs,
    ...overrides,
  });

export const waiverGate = (
  ref: string,
  ageMs: number,
  overrides: Partial<GateFactInput> = {},
): OwnerGateFact =>
  gateFact({ id: gateId(ref, "waiver"), ref, kind: "waiver", ageMs, ...overrides });
