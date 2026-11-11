/**
 * The committed durable-state case set for the GH-286 daemon-mount suites.
 *
 * Each case is one store shape (the records appended, in order) plus the
 * expected degradation marker array and the expected status-fold heartbeat
 * state, so a case is a fixture and its oracle in one place. Nothing here reads
 * the clock or the filesystem: the caller supplies the store and the instant.
 */

import {
  appendDaemonHeartbeat,
  appendDaemonInstance,
  appendDaemonLane,
} from "../../../packages/core/src/app/index";
import {
  DAEMON_HEARTBEAT_PAYLOAD_SCHEMA,
  DAEMON_INSTANCE_PAYLOAD_SCHEMA,
  DAEMON_LANE_PAYLOAD_SCHEMA,
  type DaemonHeartbeatRecord,
  type DaemonHeartbeatState,
  type DaemonInstanceRecord,
  type DaemonLaneRecord,
  type StateStorePort,
} from "../../../packages/core/src/contracts/index";
import { daemonScopeDigest } from "../../../packages/core/src/domain/daemon-lock";

export const MOUNT_NOW = "2026-11-11T10:00:00Z";

/** The one fence token every fixture append uses; content-free on purpose. */
export const MOUNT_FENCE = "fence-gh286";

export const instanceRecord = (
  overrides: Partial<DaemonInstanceRecord> = {},
): DaemonInstanceRecord => ({
  schema: DAEMON_INSTANCE_PAYLOAD_SCHEMA,
  instanceId: "instance-live",
  pid: 4321,
  scope: "scope-fixture",
  lockToken: "lock-token-fixture",
  operation: "acquired",
  acquiredAt: MOUNT_NOW,
  heartbeatAt: MOUNT_NOW,
  recordedAt: MOUNT_NOW,
  ...overrides,
});

export const heartbeatRecord = (
  overrides: Partial<DaemonHeartbeatRecord> = {},
): DaemonHeartbeatRecord => ({
  schema: DAEMON_HEARTBEAT_PAYLOAD_SCHEMA,
  instanceId: "instance-live",
  ordinal: 1,
  beatAt: MOUNT_NOW,
  uptimeMs: 0,
  queueDepth: 0,
  laneCounts: { delivering: 0, idle: 0, parked: 0, failed: 0 },
  cursor: 0,
  recordedAt: MOUNT_NOW,
  ...overrides,
});

export const laneRecord = (overrides: Partial<DaemonLaneRecord> = {}): DaemonLaneRecord => ({
  schema: DAEMON_LANE_PAYLOAD_SCHEMA,
  ref: "GH-286",
  state: "delivering",
  spawnOrdinal: 1,
  sessionId: "session-fixture",
  harnessKind: "opencode",
  recordedAt: MOUNT_NOW,
  ...overrides,
});

export const appendInstance = (
  store: StateStorePort,
  overrides: Partial<DaemonInstanceRecord> = {},
): DaemonInstanceRecord => {
  const record = instanceRecord(overrides);
  appendDaemonInstance(store, MOUNT_FENCE, record);
  return record;
};

export const appendHeartbeat = (
  store: StateStorePort,
  overrides: Partial<DaemonHeartbeatRecord> = {},
): DaemonHeartbeatRecord => {
  const record = heartbeatRecord(overrides);
  appendDaemonHeartbeat(store, MOUNT_FENCE, record);
  return record;
};

export const appendLane = (
  store: StateStorePort,
  overrides: Partial<DaemonLaneRecord> = {},
): DaemonLaneRecord => {
  const record = laneRecord(overrides);
  appendDaemonLane(store, MOUNT_FENCE, record);
  return record;
};

/** The scope digest an instance over the given directory must carry. */
export const scopeOf = (stateDirectory: string): string => daemonScopeDigest(stateDirectory);

export type MountStateCase = {
  readonly id: string;
  readonly description: string;
  /** Append the case's records over the store in declaration order. */
  readonly arrange: (store: StateStorePort) => void;
  /** The expected degradation markers for a strictly-fresh owned instance. */
  readonly expectedDegraded: readonly string[];
  /** The delivered fold's heartbeat state for the same store and instant. */
  readonly expectedFoldState: DaemonHeartbeatState;
};

export type MountStateCaseOptions = {
  /** The operator-facing instant the case is evaluated at. */
  readonly nowMs: number;
  /** The configured lock-staleness bound. */
  readonly lockStalenessMs: number;
};

/** The owned live case: an acquired instance with its own fresh heartbeat. */
const liveCase = (options: MountStateCaseOptions): MountStateCase => ({
  id: "live-fresh",
  description: "an acquired instance with a matching heartbeat inside the bound",
  arrange: (store) => {
    appendInstance(store);
    appendHeartbeat(store, {
      beatAt: new Date(options.nowMs - Math.floor(options.lockStalenessMs / 3)).toISOString(),
      recordedAt: new Date(options.nowMs - Math.floor(options.lockStalenessMs / 3)).toISOString(),
    });
  },
  expectedDegraded: [],
  expectedFoldState: "running",
});

/** The released case: the latest operation is a release. */
const releasedCase = (): MountStateCase => ({
  id: "released",
  description: "the latest instance operation is a release",
  arrange: (store) => {
    appendInstance(store);
    appendInstance(store, {
      operation: "released",
      releaseReason: "drain",
      recordedAt: "2026-11-11T10:00:30Z",
      heartbeatAt: "2026-11-11T10:00:30Z",
    });
  },
  expectedDegraded: ["daemon-unreachable"],
  expectedFoldState: "stopped",
});

/** The immediate-stop case: SIGINT recorded its own operation. */
const immediateStopCase = (): MountStateCase => ({
  id: "immediate-stop",
  description: "the latest instance operation is an immediate stop",
  arrange: (store) => {
    appendInstance(store);
    appendInstance(store, {
      operation: "immediate-stop",
      releaseReason: "immediate",
      recordedAt: "2026-11-11T10:00:30Z",
      heartbeatAt: "2026-11-11T10:00:30Z",
    });
  },
  expectedDegraded: ["daemon-unreachable"],
  expectedFoldState: "stopped",
});

/** The absent case: nothing durable exists. */
const absentCase = (): MountStateCase => ({
  id: "absent",
  description: "no instance and no heartbeat",
  arrange: () => undefined,
  expectedDegraded: ["daemon-unreachable"],
  expectedFoldState: "stale",
});

/**
 * The committed case set the suites iterate. Every degradation expectation is
 * for the owned/heartbeat-less family: the unowned family (an orphan or foreign
 * heartbeat) diverges from the fold on purpose and is asserted separately.
 */
export const mountStateCases = (options: MountStateCaseOptions): readonly MountStateCase[] => [
  liveCase(options),
  releasedCase(),
  immediateStopCase(),
  absentCase(),
];
