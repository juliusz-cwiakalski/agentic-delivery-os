/**
 * `@delivery-os/core` application tier — use-case orchestration.
 * No I/O; ports injected; types only at scaffold.
 */

/** Placeholder marker for the application tier. */
export type AppPlaceholder = { readonly __tier: "app" };

/**
 * The queue/scheduling use-case orchestration (GH-237 F-1..F-12): the intent,
 * lease, park, and incident ledgers over the injected `StateStorePort`, composed
 * from the pure domain policy. The state tier stays contract-only; this tier may
 * import domain policy.
 */
export {
  addQueueDependency,
  claimQueueLease,
  declareQueueEntry,
  leaseRecordHeartbeatAgeMs,
  normalizedQueueEdges,
  prioritizeQueueEntry,
  type QueueActiveLeaseRead,
  type QueueClaimOutcome,
  type QueueClaimResult,
  type QueueGraphEdge,
  type QueueGraphFold,
  type QueueIntentFailure,
  type QueueIntentOutcome,
  type QueueIntentResult,
  type QueueLeaseFailure,
  type QueueLedgerRead,
  type QueueParkRead,
  type QueueParkRecoveryOutcome,
  type QueueParkRecoveryResult,
  type QueueReadReason,
  type QueueReleaseOutcome,
  type QueueReleaseResult,
  queueDependencyRecordKey,
  queueEntryRecordKey,
  queueGraphDocumentPath,
  queueIncidentRecordKey,
  queueLeaseRecordKey,
  queueParkRecordKey,
  readActiveLeases,
  readQueueDependencies,
  readQueueEntries,
  readQueueFold,
  readQueueIncidents,
  readQueueLeases,
  readQueueParkPass,
  readQueueParks,
  recoverQueueParks,
  releaseQueueLease,
} from "./queue.js";
