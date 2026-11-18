/**
 * The daemon lock policy (GH-238 F-2; DM-1; AC-F2-1, AC-F2-2).
 *
 * Pure policy: no clock, randomness, filesystem, or environment access. The
 * daemon lock is a distinct artifact and token from the short-lived state
 * writer fence; staleness is `heartbeat age >= daemon.lock-staleness`, with the
 * at-bound value stale.
 */
import type { DaemonInstanceRecord, DaemonLockRecord, DaemonLockRead } from "#contracts";
import { DAEMON_SCOPE_DIGEST_LENGTH } from "#contracts";
import { sha256Hex } from "./sha256.js";

/** The 16-hex state-directory scope identifier; the raw path is never stored. */
export const daemonScopeDigest = (stateDirectory: string): string =>
  sha256Hex(stateDirectory).slice(0, DAEMON_SCOPE_DIGEST_LENGTH);

export type DaemonLockRefusal =
  | {
      readonly kind: "already-running";
      readonly holder: DaemonLockRecord;
      readonly heartbeatAgeMs: number;
    }
  | {
      readonly kind: "takeover";
      readonly previous: DaemonLockRecord;
      readonly heartbeatAgeMs: number;
    }
  | { readonly kind: "acquire" }
  | { readonly kind: "unreadable"; readonly code: string; readonly path: string };

/** Classify the lock under the injected clock and staleness bound. */
export const evaluateDaemonLock = (input: {
  readonly lock: DaemonLockRead;
  readonly nowMs: number;
  readonly stalenessMs: number;
}): DaemonLockRefusal => {
  if (input.lock.state === "absent") return { kind: "acquire" };
  if (input.lock.state === "unreadable") {
    return { kind: "unreadable", code: input.lock.code, path: input.lock.path };
  }
  const record = input.lock.record;
  const heartbeatAgeMs = Math.max(0, input.nowMs - Date.parse(record.heartbeatAt));
  if (heartbeatAgeMs >= input.stalenessMs) {
    return { kind: "takeover", previous: record, heartbeatAgeMs };
  }
  return { kind: "already-running", holder: record, heartbeatAgeMs };
};

/** Build the takeover evidence carried only on a `taken-over` instance record. */
export const takeoverEvidence = (
  previous: DaemonLockRecord,
  heartbeatAgeMs: number,
  takenOverAt: string,
): NonNullable<DaemonInstanceRecord["takeover"]> => ({
  previousInstanceId: previous.instanceId,
  previousLockToken: previous.lockToken,
  lastHeartbeatAt: previous.heartbeatAt,
  heartbeatAgeMs,
  takenOverAt,
});
