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

/**
 * The daemon execution ledgers (GH-238 F-2, F-7): instance, heartbeat, lane,
 * reconciliation, and preemption records over the injected state port.
 */
export {
  appendDaemonHeartbeat,
  appendDaemonInstance,
  appendDaemonLane,
  appendDaemonPreemption,
  appendDaemonReconciliation,
  type DaemonAppendResult,
  type DaemonLedgerRead,
  readDaemonHeartbeat,
  readDaemonInstance,
  readDaemonLanes,
  readDaemonPreemptions,
  readDaemonReconciliations,
} from "./daemon.js";
export {
  createControlServer,
  type ControlHandlerResult,
  type ControlServer,
  type ControlServerHandlers,
  type ControlServerOptions,
  type ControlSubscribeAccept,
} from "./control-server.js";
export {
  type DaemonEvidenceProvider,
  type DaemonReconcileInput,
  type DaemonReconcileResult,
  reconcileDaemon,
} from "./daemon-reconcile.js";
export {
  type DaemonStatusInput,
  type DaemonStatusRead,
  readDaemonStatus,
} from "./daemon-status.js";
export {
  createDaemonRuntime,
  readRuntimeHeartbeat,
  readRuntimeInstance,
  type DaemonRuntime,
  type DaemonRuntimeFailure,
  type DaemonRuntimePorts,
  type DaemonRuntimeState,
} from "./daemon-runtime.js";
export {
  createResidentPolling,
  type ResidentPolling,
  type ResidentPollingInput,
} from "./polling.js";
export {
  recordResumeIntent,
  runSupervisionCycle,
  SUPERVISE_ONLY_DEGRADATION,
  type SupervisionAction,
  type SupervisionHandle,
  type SupervisionInput,
  type SupervisionPorts,
  type SupervisionResult,
} from "./daemon-supervision.js";
export {
  appendCommandReceipt,
  appendOutboxEffect,
  beginCommitEffect,
  detectDaemonEffects,
  type BeginCommitEffectInput,
  type DaemonEffectDetectionInput,
  type EffectAppendResult,
  type EffectLedgerRead,
  readCommandReceipts,
  readOutboxEffects,
  recordRedriveRequest,
  recoverCommitEffect,
  type RecoverCommitEffectInput,
  type RecoverCommitEffectResult,
} from "./effects.js";
export {
  applyPreemption,
  reevaluatePendingPreemptions,
  type ApplyPreemptionInput,
  type ApplyPreemptionResult,
  type PreemptionBoundaryObservation,
  type PreemptionReleasePort,
  type ReevaluatePendingInput,
} from "./daemon-preemption.js";
export {
  watchLines,
  type WatchInput,
  type WatchRead,
} from "./watch.js";
export {
  installSupervisor,
  type SupervisorResult,
  uninstallSupervisor,
} from "./daemon-supervisor.js";
