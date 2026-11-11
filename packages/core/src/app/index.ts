/**
 * `@delivery-os/core` application tier — use-case orchestration.
 * No I/O; ports injected; types only at scaffold.
 */

/** Placeholder marker for the application tier. */
export type AppPlaceholder = { readonly __tier: "app" };

export {
  type ControlHandlerResult,
  type ControlServer,
  type ControlServerHandlers,
  type ControlServerOptions,
  type ControlSubscribeAccept,
  createControlServer,
} from "./control-server.js";

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
  type DaemonDispatchResultInput,
  type DaemonDispatchResultOutcome,
  daemonAttemptId,
  recordDaemonDispatchResult,
} from "./daemon-dispatch-result.js";
export {
  type ApplyPreemptionInput,
  type ApplyPreemptionResult,
  applyPreemption,
  type PreemptionBoundaryObservation,
  type PreemptionReleasePort,
  type ReevaluatePendingInput,
  reevaluatePendingPreemptions,
} from "./daemon-preemption.js";
export {
  type DaemonEvidenceProvider,
  type DaemonReconcileInput,
  type DaemonReconcileResult,
  reconcileDaemon,
} from "./daemon-reconcile.js";
export {
  createDaemonRuntime,
  type DaemonRuntime,
  type DaemonRuntimeFailure,
  type DaemonRuntimePorts,
  type DaemonRuntimeState,
  readRuntimeHeartbeat,
  readRuntimeInstance,
} from "./daemon-runtime.js";
export {
  type DaemonStatusInput,
  type DaemonStatusRead,
  readDaemonStatus,
} from "./daemon-status.js";
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
  installSupervisor,
  type SupervisorResult,
  uninstallSupervisor,
} from "./daemon-supervisor.js";
export {
  boundLastMessage,
  type DispatchAdmission,
  type DispatchLeaseClaim,
  type DispatchPorts,
  type DispatchRunResult,
  type DispatchTruthReads,
  runDispatch,
} from "./dispatch.js";
export {
  type DispatchGateRead,
  type DispatchHandoverResult,
  type DispatchSummaryResult,
  handoverDispatchEvidence,
  readDispatchGate,
  resolveDispatchDivergenceEvidence,
  revertDispatchHandoverEvidence,
  summarizeDispatchEvidence,
} from "./dispatch-gate.js";
export {
  appendDispatchAttempt,
  appendDispatchDivergence,
  appendDispatchHandover,
  type DispatchAppendResult,
  type DispatchDivergenceSummary,
  type DispatchLedgerRead,
  foldDispatchDivergences,
  isEvidenceClass,
  readDispatchAttempts,
  readDispatchDivergences,
  readDispatchHandover,
  resolveDispatchDivergence,
  summarizeDispatchDivergences,
  writeDispatchAuthority,
} from "./dispatch-ledger.js";
export {
  appendCommandReceipt,
  appendOutboxEffect,
  type BeginCommitEffectInput,
  beginCommitEffect,
  type DaemonEffectDetectionInput,
  detectDaemonEffects,
  type EffectAppendResult,
  type EffectLedgerRead,
  type RecoverCommitEffectInput,
  type RecoverCommitEffectResult,
  readCommandReceipts,
  readOutboxEffects,
  recordRedriveRequest,
  recoverCommitEffect,
} from "./effects.js";
export {
  createResidentPolling,
  type ResidentPolling,
  type ResidentPollingInput,
} from "./polling.js";
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
 * The one state-scope policy (GH-288 F-1, F-6, DEC-12): the host-root rule, the
 * derived project root, the declared `unbound` scope, and the closed identity
 * outcomes over injected facts and the marker seam.
 */
export {
  type CheckoutIdentityFacts,
  checkoutDirectoryName,
  type HostStateRootInput,
  hostIndexPath,
  type ProjectIdentityPorts,
  type ProjectScopeInput,
  type ProjectScopeOutcome,
  type ProjectsScopeFailure,
  parseProjectIdentityMarker,
  projectDiscriminator,
  projectKeyFor,
  projectStateRoot,
  projectsContainerPath,
  resolveHostStateRoot,
  resolveProjectScope,
  sanitizeProjectBasename,
  serializeProjectIdentityMarker,
  unboundStateRoot,
} from "./state-scope.js";
/**
 * The derived host-index fold (GH-288 F-2, DEC-4, DEC-14, DEC-18): the pure
 * upsert/prune/revision rule over one read, with the DEC-18 key guard.
 */
export {
  corruptHostIndexSiblingName,
  type HostIndexMaintenanceInput,
  type HostIndexMaintenanceResult,
  type HostIndexRootProbe,
  maintainHostIndex,
  parseHostIndexDocument,
  serializeHostIndexDocument,
} from "./host-index.js";
export {
  type WatchInput,
  type WatchRead,
  watchLines,
} from "./watch.js";
