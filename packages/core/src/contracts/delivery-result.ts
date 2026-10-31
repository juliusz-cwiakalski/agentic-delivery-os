/**
 * Delivery result vocabulary (GH-177 C-4, TDR-0005).
 *
 * Runtime-neutral and I/O-free: types and `as const` data only. The eleven
 * bash-era delivery summary tokens, their per-token taxonomy, and the class
 * vocabularies live here as the single typed home. The M0-S8-reachable subset is
 * derived from the taxonomy (entries whose derivation class is `verify`); no
 * separate reachable-subset symbol is declared (PIN-1).
 */
import type { ProjectionClass } from "./result.js";

/** The eleven bash-era tokens, in the bash usage-enum order (C-4). */
export const DELIVERY_RESULT_TOKENS = [
  "merged",
  "blocked",
  "pr-open",
  "pr-open-unverified",
  "failed",
  "finished",
  "max-restarts",
  "state-unverified",
  "partial",
  "noop-lane-permission",
  "noop-lane-nothing-to-do",
] as const;

export type DeliveryResultToken = (typeof DELIVERY_RESULT_TOKENS)[number];

/** The projection classes shared with the binding result contract (C-5). */
export const DELIVERY_RESULT_PROJECTION_CLASSES = [
  "success",
  "user-validation",
  "platform-provider",
] as const satisfies readonly ProjectionClass[];

export type DeliveryResultProjectionClass = (typeof DELIVERY_RESULT_PROJECTION_CLASSES)[number];

/** Which evidence collector derives a token (C-4). */
export const DELIVERY_RESULT_DERIVATION_CLASSES = [
  "verify",
  "tracker-pr",
  "dispatch-session",
] as const;

export type DeliveryResultDerivationClass = (typeof DELIVERY_RESULT_DERIVATION_CLASSES)[number];

/** One taxonomy row: exactly one projection class and one derivation class. */
export type DeliveryResultTaxonomyEntry = {
  readonly token: DeliveryResultToken;
  readonly projectionClass: ProjectionClass;
  readonly derivationClass: DeliveryResultDerivationClass;
};

/** The total taxonomy: exactly one entry per token, in token order (C-4). */
export const DELIVERY_RESULT_TAXONOMY = [
  { token: "merged", projectionClass: "success", derivationClass: "tracker-pr" },
  { token: "blocked", projectionClass: "success", derivationClass: "tracker-pr" },
  { token: "pr-open", projectionClass: "success", derivationClass: "tracker-pr" },
  {
    token: "pr-open-unverified",
    projectionClass: "success",
    derivationClass: "tracker-pr",
  },
  { token: "failed", projectionClass: "user-validation", derivationClass: "verify" },
  { token: "finished", projectionClass: "success", derivationClass: "verify" },
  {
    token: "max-restarts",
    projectionClass: "user-validation",
    derivationClass: "dispatch-session",
  },
  {
    token: "state-unverified",
    projectionClass: "platform-provider",
    derivationClass: "verify",
  },
  { token: "partial", projectionClass: "user-validation", derivationClass: "verify" },
  {
    token: "noop-lane-permission",
    projectionClass: "user-validation",
    derivationClass: "dispatch-session",
  },
  {
    token: "noop-lane-nothing-to-do",
    projectionClass: "success",
    derivationClass: "dispatch-session",
  },
] as const satisfies readonly DeliveryResultTaxonomyEntry[];
