/**
 * Reconcile case data (GH-292 TC-QLC-050..058): the stale-state matrix, the
 * retention matrix, the provider failure classes, and the exact payload keys.
 */
import type { DeliveryStateAlias } from "../../../../packages/core/src/contracts/index";

/** The primary refs the reconcile suites seed. */
export const RECONCILE_REFS = {
  done: "GH-241",
  canceled: "GH-245",
  ready: "GH-243",
  unobserved: "GH-244",
} as const;

/** Every open delivery state is retained with its observed alias (TC-QLC-052). */
export const OPEN_DELIVERY_STATES: readonly DeliveryStateAlias[] = [
  "backlog",
  "ready",
  "in-progress",
  "in-review",
];

/** The closed stale set: the only states a reconcile removes (DEC-11). */
export const STALE_DELIVERY_STATES: readonly DeliveryStateAlias[] = ["done", "canceled"];

/** The provider failure classes and their projected exits (TC-QLC-053). */
export const PROVIDER_FAILURES: readonly { readonly code: string; readonly exit: number }[] = [
  { code: "provider.outage", exit: 2 },
  { code: "provider.quota.exceeded", exit: 2 },
  { code: "provider.auth.rejected", exit: 1 },
];

/** The exact `queue reconcile` payload key set (DM-5, TC-QLC-058). */
export const RECONCILE_PAYLOAD_KEYS = [
  "result",
  "checked",
  "removed",
  "retained",
  "unobserved",
  "readySet",
  "truncated",
  "remainder",
  "degraded",
];

/** The sweep cap (NFR-4). */
export const RECONCILE_CAP = 100;
