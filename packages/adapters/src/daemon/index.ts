/**
 * `@delivery-os/adapters/daemon` — the declared non-provider local-I/O subpath
 * (GH-238 F-1..F-9; ADR-0003 DEC-6).
 *
 * Owns the local control transports and, in later phases, the detached process
 * supervisor, wake source, clock edge, lane executor, and platform supervisors.
 * It never owns a commit effect wrapper.
 */

export { createNodeClock } from "./clock.js";
export { classifyTransportError } from "./errors.js";
export { createLaneExecutor, type LaneExecutorAdapterOptions } from "./lane-executor.js";
export {
  createNodeProcessPort,
  type KillCoordinatorProcessInput,
  killCoordinatorProcess,
  type NodeProcessPortOptions,
} from "./process.js";
export { createStdioTransport, type StdioTransportOptions } from "./stdio.js";
export {
  absentSupervisorDescriptor,
  createSupervisorAdapter,
  type SupervisorAdapterOptions,
  type SupervisorCommandRunner,
  type SupervisorFileSystem,
} from "./supervisor.js";
export {
  createConnectionIdFactory,
  createLineConnection,
  type LineStreamPair,
} from "./transport.js";
export {
  createUnixTransport,
  type DaemonSocketProbeResult,
  probeDaemonSocket,
  type UnixTransportOptions,
} from "./unix.js";
export { createEventLogWake, type EventLogWake, type EventLogWakeOptions } from "./wake.js";
