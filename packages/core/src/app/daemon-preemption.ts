/**
 * Preemption application orchestration (GH-238 F-11; EVT-5; DM-5; AC-F11-1/2).
 *
 * Applies through the delivered release-and-park semantics (injected port),
 * appends the `daemon.preemption` record, never duplicates a target/close pair,
 * and never signals a lane. Pending records are re-evaluated on restart.
 */
import {
  type DaemonPreemptionBoundary,
  type DaemonPreemptionRecord,
  type DaemonPreemptionState,
  type StateStorePort,
} from "#contracts";
import { appendDaemonPreemption, readDaemonPreemptions } from "./daemon.js";
import { decidePreemption, type PreemptionInput } from "../domain/daemon-preemption.js";

export type PreemptionReleasePort = {
  readonly releaseAndPark: (input: {
    readonly ref: string;
    readonly repository: string;
    readonly closeRef: string;
    readonly holder: string;
  }) => { readonly ok: true } | { readonly ok: false; readonly code: string };
};

export type ApplyPreemptionInput = {
  readonly store: StateStorePort;
  readonly fenceToken: string;
  readonly decisionInput: PreemptionInput;
  readonly nowIso: string;
  readonly release: PreemptionReleasePort;
  readonly evidence?: readonly string[];
};

export type ApplyPreemptionResult =
  | { readonly ok: true; readonly record: DaemonPreemptionRecord; readonly applied: boolean }
  | { readonly ok: false; readonly code: string; readonly path: string };

const existingFor = (
  store: StateStorePort,
  ref: string,
  closeRef: string,
): DaemonPreemptionRecord | undefined => {
  const read = readDaemonPreemptions(store);
  if (!read.ok) return undefined;
  return [...read.records]
    .reverse()
    .find(
      (record) =>
        record.ref === ref &&
        record.closeRef === closeRef &&
        (record.state === "pending" || record.state === "applied"),
    );
};

export const applyPreemption = (input: ApplyPreemptionInput): ApplyPreemptionResult => {
  const existing = existingFor(input.store, input.decisionInput.ref, input.decisionInput.closeRef);
  if (existing !== undefined) {
    return { ok: true, record: existing, applied: existing.state === "applied" };
  }
  const decision = decidePreemption(input.decisionInput);
  if (decision.releaseAndPark) {
    const released = input.release.releaseAndPark({
      ref: input.decisionInput.ref,
      repository: input.decisionInput.repository,
      closeRef: input.decisionInput.closeRef,
      holder: input.decisionInput.holder,
    });
    if (!released.ok) {
      return { ok: false, code: released.code, path: input.decisionInput.ref };
    }
  }
  const state: DaemonPreemptionState = decision.state;
  const record: DaemonPreemptionRecord = {
    schema: "delivery.daemon.preemption.v1",
    ref: input.decisionInput.ref,
    repository: input.decisionInput.repository,
    closeRef: input.decisionInput.closeRef,
    parkCause: "preempted-for-close-item",
    conditionType: "preemption",
    holder: input.decisionInput.holder,
    state,
    requestedAt: input.decisionInput.requestedAt,
    ...(state === "applied" ? { appliedAt: input.nowIso } : {}),
    ...(decision.state === "applied" && decision.boundary !== undefined
      ? { boundary: decision.boundary }
      : {}),
    evidence: [...(input.evidence ?? ["close-item-preemption"])],
    recordedAt: input.nowIso,
  };
  const appended = appendDaemonPreemption(input.store, input.fenceToken, record);
  return appended.ok
    ? { ok: true, record: appended.record, applied: state === "applied" }
    : { ok: false, code: appended.code, path: appended.path };
};

export type ReevaluatePendingInput = {
  readonly store: StateStorePort;
  readonly fenceToken: string;
  readonly nowIso: string;
  readonly release: PreemptionReleasePort;
  readonly sessionObservable: (record: DaemonPreemptionRecord) => boolean;
};

/**
 * Re-read durable pending records and re-evaluate: a gone session applies the
 * release/park immediately; an observable session stays pending and untouched.
 */
export const reevaluatePendingPreemptions = (
  input: ReevaluatePendingInput,
):
  | { readonly ok: true; readonly applied: readonly string[] }
  | { readonly ok: false; readonly code: string } => {
  const read = readDaemonPreemptions(input.store);
  if (!read.ok) return { ok: false, code: read.code };
  const latest = new Map<string, DaemonPreemptionRecord>();
  for (const record of read.records) latest.set(record.ref, record);
  const applied: string[] = [];
  for (const record of latest.values()) {
    if (record.state !== "pending") continue;
    if (input.sessionObservable(record)) continue;
    const released = input.release.releaseAndPark({
      ref: record.ref,
      repository: record.repository,
      closeRef: record.closeRef,
      holder: record.holder,
    });
    if (!released.ok) return { ok: false, code: released.code };
    const appliedRecord: DaemonPreemptionRecord = {
      ...record,
      state: "applied",
      appliedAt: input.nowIso,
      boundary: { phase: "completion", observedAt: input.nowIso },
      recordedAt: input.nowIso,
    };
    const appended = appendDaemonPreemption(input.store, input.fenceToken, appliedRecord);
    if (!appended.ok) return { ok: false, code: appended.code };
    applied.push(record.ref);
  }
  return { ok: true, applied };
};

/** A boundary observation type used by the runtime's re-evaluation hook. */
export type PreemptionBoundaryObservation = DaemonPreemptionBoundary;
