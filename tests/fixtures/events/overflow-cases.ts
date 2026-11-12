/**
 * The six-topic overflow fixture (TC-EVT-040/041/042).
 *
 * The declared row shape and the per-topic change sequences. Event topics are
 * driven through the real server in one publish tick (three appended changes);
 * the two delivered snapshot topics overflow at the session seam the delivered
 * suite uses, because the server flushes a snapshot subscription on every tick.
 */

import { CONTROL_TOPICS } from "../../../packages/core/src/contracts/control";
import { TAXONOMY_OVERFLOW } from "../../../packages/core/src/contracts/taxonomy";

export const OVERFLOW_TOPICS = [...CONTROL_TOPICS] as const;
export type OverflowTopic = (typeof OVERFLOW_TOPICS)[number];

export type OverflowRow = {
  readonly topic: OverflowTopic;
  readonly shape: "snapshot" | "event";
  readonly degradedKeys: readonly string[];
  readonly overflow: string;
};

/** The expected degraded `data` key set, identical for every topic. */
export const DEGRADED_DATA_KEYS = ["degraded", "topic", "overflow", "taxonomyVersion"] as const;

export const overflowRow = (topic: OverflowTopic): OverflowRow => ({
  topic,
  shape: topic === "queue" || topic === "lanes" ? "snapshot" : "event",
  degradedKeys: [...DEGRADED_DATA_KEYS],
  overflow: TAXONOMY_OVERFLOW,
});

/** The bounded buffer every row is proven at. */
export const OVERFLOW_BUFFER = 2;
