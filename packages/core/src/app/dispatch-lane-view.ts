/**
 * The operator lane-view read (GH-354 F-1, F-3; API-1, API-3, API-6, API-10,
 * API-11; DM-1, DM-7; DEC-2, DEC-5, DEC-7).
 *
 * ONE bounded retained-window read of the delivered `dispatch.lane` ledger,
 * filtered to the resolved repository BEFORE the newest-per-ref fold, joined
 * with the injected advisory probe. Nothing is appended, repaired, or cleared,
 * and a failed store read keeps the store's own typed `state.*` identity so the
 * query can never fabricate `absent` or `false`.
 *
 * The composition edge resolves the checkout identity with persistence
 * DISABLED, so no checkout marker is created here.
 */
import type {
  DispatchDeliveringData,
  DispatchLaneRecord,
  DispatchOwnerProbe,
  DispatchProbeVerdict,
  DispatchStatusData,
  DispatchStatusParkFact,
  QueueParkRecord,
  StateStorePort,
} from "#contracts";
import {
  buildRefDeliveringData,
  buildRepositoryDeliveringData,
  buildStatusData,
  operatorLaneFor,
  operatorLanesInRepository,
} from "../domain/dispatch-operator-view.js";
import { readDispatchLanes } from "./dispatch-ledger.js";
import { readQueueParks } from "./queue.js";

/** The store-read failure the query refuses with: the store's own identity. */
export type OperatorLaneReadFailure = {
  readonly ok: false;
  readonly code: string;
  readonly path: string;
};

/**
 * The ref-keyed worktree-path join source (GH-404 F-7, DM-1; TC-SURFACES-002):
 * the NEWEST dispatch.lane record per (repository, ref) — the store is
 * project-scoped, so the repository dimension is the store's own — folded over
 * the bounded retained-window read this module already owns. A context-less
 * record (pre-change, disable-worktrees — DEC-8) contributes nothing: absence
 * is the join's classified absence, and the join contributes paths to EXISTING
 * surface rows only, never mints rows. The path value is the record's own
 * field, carried verbatim (one bound, reused).
 */
const dispatchLaneJoinKey = (repository: string, ref: string): string => `${repository}|${ref}`;

export const newestDispatchLaneWorktreePaths = (
  records: readonly DispatchLaneRecord[],
): Readonly<Record<string, string>> => {
  const paths: Record<string, string> = {};
  for (const record of records) {
    const key = dispatchLaneJoinKey(record.repository, record.ref);
    // The NEWEST record decides (review F-7): a newer context-less record
    // supersedes an older path.
    if (record.worktreePath === undefined) delete paths[key];
    else paths[key] = record.worktreePath;
  }
  return paths;
};

export type OperatorStatusRead =
  | { readonly ok: true; readonly data: DispatchStatusData }
  | OperatorLaneReadFailure;

export type OperatorDeliveringRead =
  | { readonly ok: true; readonly data: DispatchDeliveringData }
  | OperatorLaneReadFailure;

/** The probe verdict for one record, or `undefined` when there is no record. */
const probed = (
  probe: DispatchOwnerProbe,
  record: DispatchLaneRecord | undefined,
): DispatchProbeVerdict | undefined => (record === undefined ? undefined : probe(record.owner));

/** The latest open peak-window park for the ref, projected as the additive fact. */
export const dispatchStatusParkFact = (
  parks: readonly QueueParkRecord[],
  ref: string,
): DispatchStatusParkFact | undefined => {
  for (let index = parks.length - 1; index >= 0; index -= 1) {
    const park = parks[index];
    if (park === undefined || park.ref !== ref || park.cause !== "peak-window") continue;
    if (park.recoveryState !== "parked" && park.recoveryState !== "clear-observed") {
      return undefined;
    }
    return {
      cause: park.cause,
      ...(park.until === undefined ? {} : { until: park.until }),
      ...(park.stoppedAt === undefined ? {} : { stoppedAt: park.stoppedAt }),
      ...(park.preservation === undefined ? {} : { preservation: park.preservation }),
      ...(park.recoveryRefusal === undefined ? {} : { recoveryRefusal: park.recoveryRefusal }),
    };
  }
  return undefined;
};

/** `dispatch status <ref>` — one bounded lane read, one bounded park read, then the fold. */
export const readOperatorStatus = (input: {
  readonly store: StateStorePort;
  readonly repository: string;
  readonly ref: string;
  readonly probe: DispatchOwnerProbe;
}): OperatorStatusRead => {
  const read = readDispatchLanes(input.store);
  if (!read.ok) return { ok: false, code: read.code, path: read.path };
  const record = operatorLaneFor(read.records, input.repository, input.ref);
  const parks = readQueueParks(input.store);
  const park =
    parks.ok
      ? dispatchStatusParkFact(
          parks.records.filter(
            (candidate) => candidate.repository === undefined || candidate.repository === input.repository,
          ),
          input.ref,
        )
      : undefined;
  return {
    ok: true,
    data: buildStatusData({
      ref: input.ref,
      repository: input.repository,
      record,
      probe: probed(input.probe, record),
      ...(park === undefined ? {} : { park }),
    }),
  };
};

/**
 * `dispatch is-delivering [<ref>]` — both admissible forms over the same single
 * bounded read. The ref-less form lists only active, non-stale refs of the
 * resolved repository, in a deterministic ref order.
 */
export const readOperatorDelivering = (input: {
  readonly store: StateStorePort;
  readonly repository: string;
  readonly ref?: string;
  readonly probe: DispatchOwnerProbe;
}): OperatorDeliveringRead => {
  const read = readDispatchLanes(input.store);
  if (!read.ok) return { ok: false, code: read.code, path: read.path };
  if (input.ref !== undefined) {
    const record = operatorLaneFor(read.records, input.repository, input.ref);
    return {
      ok: true,
      data: buildRefDeliveringData({
        ref: input.ref,
        repository: input.repository,
        record,
        probe: probed(input.probe, record),
      }),
    };
  }
  const refs: string[] = [];
  for (const record of operatorLanesInRepository(read.records, input.repository)) {
    if (record.state !== "active") continue;
    if (input.probe(record.owner) === "dead") continue;
    refs.push(record.ref);
  }
  return { ok: true, data: buildRepositoryDeliveringData({ repository: input.repository, refs }) };
};
