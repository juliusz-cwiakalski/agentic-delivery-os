/** Review-thread fixtures: unresolved, resolved, and ordering. */
import type { DeliveryThread } from "../../../packages/core/src/contracts/index";

export const UNRESOLVED_THREADS: readonly DeliveryThread[] = [
  { threadId: "PRRT_3", resolved: false, commentCount: 1 },
  { threadId: "PRRT_1", resolved: true, commentCount: 2 },
  { threadId: "PRRT_2", resolved: false, commentCount: 1 },
];

export const ALL_RESOLVED_THREADS: readonly DeliveryThread[] = [
  { threadId: "PRRT_1", resolved: true, commentCount: 2 },
];

export const manyThreads = (count: number): readonly DeliveryThread[] =>
  Array.from({ length: count }, (_, index) => ({
    threadId: `PRRT_${String(index + 1).padStart(4, "0")}`,
    resolved: false,
    commentCount: 1,
  }));
