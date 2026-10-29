/**
 * `@delivery-os/core/state` — state driver implementations.
 * Runtime APIs are permitted only in this driver code; types only at scaffold.
 */

/** State driver kinds the ports will select between. */
export type StateDriverKind = "jsonl" | "sqlite";
