/**
 * GH-292 dependency grammar case data (TC-QLC-030..036): typed case arrays,
 * not test bodies.
 */

/** The consumer/producer refs the dependency suites seed. */
export const CONSUMER_REF = "GH-243";
export const PRODUCER_REF = "GH-242";
/** A ref that never entered the queue. */
export const UNOBSERVED_REF = "GH-999";

/** Non-canonical ref forms refused by both spellings (TC-QLC-034). */
export const NON_CANONICAL_REFS: readonly string[] = ["GH-", "GH-1x", "241"];

/**
 * The delivered intent result for a dependency add onto an EXISTING entry:
 * `mutateIntent` reports `updated` when the entry record already existed
 * (delivered semantics; the spelling-equality of AC-F3-1 is the pin, so both
 * spellings must yield this same value).
 */
export const DELIVERED_DEP_ADD_RESULT = "updated";

/** The two accepted spellings of the add (TC-QLC-030). */
export const ADD_SPELLINGS: readonly (readonly string[])[] = [
  [CONSUMER_REF, PRODUCER_REF],
  ["add", CONSUMER_REF, PRODUCER_REF],
];

/** The exact add payload key set — unchanged from the delivered shape. */
export const ADD_PAYLOAD_KEYS = ["ref", "entry", "edges", "result", "degraded"];
/** The exact remove payload key set — mutation keys plus `readySet` and `event`. */
export const REMOVE_PAYLOAD_KEYS = [
  "ref",
  "entry",
  "edges",
  "result",
  "readySet",
  "event",
  "degraded",
];
