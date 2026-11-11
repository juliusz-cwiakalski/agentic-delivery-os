/**
 * The daemon-owned lock artifact `daemon.lock` (GH-238 F-2, F-3; GH-286 NF-1;
 * TDR-0004).
 *
 * Over the injected StateRuntimeEdge: exclusive create, 0600 file in a verified
 * 0700 directory, verified classification of torn/unreadable/permission
 * failures, and removal only through a compare-and-delete on the observed
 * `lockToken`. The removal path is the same one the holder uses at release and
 * the one the engine uses for a lock its staleness evaluation PROVED dead, so a
 * lock whose record changed between observation and removal is never deleted.
 * The state tier imports contracts plus this tier's edge only.
 */
import type { DaemonLockPort, DaemonLockRead, DaemonLockRecord } from "#contracts";
import type { StateRuntimeEdge } from "./edge.js";

const LOCK_FILE = "daemon.lock" as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isLockRecord = (value: unknown): value is DaemonLockRecord =>
  isRecord(value) &&
  Object.keys(value).every((key) =>
    ["lockToken", "instanceId", "pid", "scope", "acquiredAt", "heartbeatAt"].includes(key),
  ) &&
  typeof value.lockToken === "string" &&
  value.lockToken.length > 0 &&
  typeof value.instanceId === "string" &&
  value.instanceId.length > 0 &&
  typeof value.pid === "number" &&
  Number.isInteger(value.pid) &&
  typeof value.scope === "string" &&
  typeof value.acquiredAt === "string" &&
  typeof value.heartbeatAt === "string";

/** Compose the daemon lock port over the injected edge and state directory. */
export const createDaemonLockPort = (
  edge: StateRuntimeEdge,
  stateDirectory: string,
): DaemonLockPort => {
  const path = `${stateDirectory}/${LOCK_FILE}`;

  const ensureDirectory = ():
    | { readonly ok: true }
    | { readonly ok: false; readonly code: string; readonly path: string } => {
    edge.ensureDirectory(stateDirectory);
    if (!edge.verifyPermissions(stateDirectory, "directory")) {
      return { ok: false, code: "state.permission.denied", path: stateDirectory };
    }
    return { ok: true };
  };

  const read = (): DaemonLockRead => {
    if (!edge.exists(path)) return { state: "absent" };
    if (!edge.verifyPermissions(path, "file")) {
      return { state: "unreadable", code: "state.permission.denied", path };
    }
    try {
      const parsed: unknown = JSON.parse(edge.readText(path));
      if (!isLockRecord(parsed)) {
        return { state: "unreadable", code: "state.store.torn", path };
      }
      return { state: "held", record: parsed };
    } catch {
      return { state: "unreadable", code: "state.store.torn", path };
    }
  };

  /**
   * Compare-and-delete: remove the record only while its `lockToken` still
   * equals the observed token. The read is re-taken here, so a record a
   * concurrent starter replaced after the caller's observation is left in place
   * and answers the delivered `state.lock.busy` instead of being deleted. The
   * holder's release and the engine's removal of a lock its staleness
   * evaluation proved dead share this one path.
   */
  const removeIfTokenMatches = (
    observedToken: string,
  ):
    | { readonly ok: true }
    | { readonly ok: false; readonly code: string; readonly path: string } => {
    const current = read();
    if (current.state === "absent") return { ok: true };
    if (current.state !== "held" || current.record.lockToken !== observedToken) {
      return { ok: false, code: "state.lock.busy", path };
    }
    try {
      edge.removeFile(path);
      return { ok: true };
    } catch {
      return { ok: false, code: "state.write.failed", path };
    }
  };

  return {
    read,
    acquire: (record) => {
      const directory = ensureDirectory();
      if (!directory.ok) return directory;
      const created = edge.createExclusiveFile(path, JSON.stringify(record));
      if (!created) {
        return { ok: false, code: "state.lock.busy", path };
      }
      edge.applyPermissions(path, "file");
      return edge.verifyPermissions(path, "file")
        ? { ok: true }
        : { ok: false, code: "state.permission.denied", path };
    },
    heartbeat: (lockToken, heartbeatAt) => {
      const current = read();
      if (current.state !== "held" || current.record.lockToken !== lockToken) {
        return { ok: false, code: "state.lock.busy", path };
      }
      try {
        edge.writeFile(path, JSON.stringify({ ...current.record, heartbeatAt }));
        return { ok: true };
      } catch {
        return { ok: false, code: "state.write.failed", path };
      }
    },
    remove: (lockToken) => removeIfTokenMatches(lockToken),
  };
};
