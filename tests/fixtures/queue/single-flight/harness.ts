/**
 * The single-flight harness (GH-292 TC-QLC-040..045): a real store seeded with
 * one entry and leases held by arbitrary holders, wrapped in the delivered
 * composition seams — the dispatch family's claim port routes through
 * `dispatchAdmissionRefusal` before `claimQueueLease` exactly as the
 * production composition wires it, and `queue claim` routes through
 * `claimSingleFlightRefusal` before the same primitive.
 */

import type { DispatchLeaseClaim } from "../../../../packages/core/src/app/dispatch";
import {
  claimDispatchLease,
  claimQueueLease,
  claimSingleFlightRefusal,
  declareQueueEntry,
  readActiveLeases,
  readQueueFold,
  releaseQueueLease,
  renewDispatchLease,
} from "../../../../packages/core/src/app/index";
import type { StateStorePort } from "../../../../packages/core/src/contracts/index";
import { type AuditStoreFixture, makeAuditStore, removeRoot } from "../../state/harness";

const NOW_ISO = "2026-11-12T10:00:00Z";
const NOW_MS = Date.parse(NOW_ISO);
export const REPO = "host/owner/name";
export const TTL = 90_000;

export type SingleFlightStore = {
  readonly store: StateStorePort;
  readonly dispose: () => void;
  readonly nowMs: () => number;
  /** The injected lease clock (GH-413 TC-PEAK-010): never a wall clock. */
  readonly setNowMs: (value: number) => void;
};

export const singleFlightStore = (label: string, ref = "GH-241"): SingleFlightStore => {
  const fixture: AuditStoreFixture = makeAuditStore(`queue-single-flight-${label}`);
  for (const [index, seeded] of [ref, "GH-242"].entries()) {
    const declared = declareQueueEntry(fixture.store, {
      ref: seeded,
      repository: REPO,
      repositoryRoot: "/work/repo-alpha",
      priority: 1,
      recordedAt: NOW_ISO,
      fenceToken: `seed-${label}-${index}`,
    });
    if (!declared.ok) throw new Error(`seed failed: ${JSON.stringify(declared)}`);
  }
  let nowMs = NOW_MS;
  return {
    store: fixture.store,
    dispose: () => removeRoot(fixture.root),
    nowMs: () => nowMs,
    setNowMs: (value) => {
      nowMs = value;
    },
  };
};

/** Seed a live lease held by `holder` over `ref` with a heartbeat aged `ageMs`. */
export const seedLease = (
  single: SingleFlightStore,
  input: { readonly holder: string; readonly ref: string; readonly ageMs?: number },
): void => {
  const seededAtMs = NOW_MS - (input.ageMs ?? 0);
  const claimed = claimQueueLease(single.store, {
    ref: input.ref,
    holder: input.holder,
    runner: `runner-${input.holder}`,
    weightClass: "standard",
    ttlMs: TTL,
    nowIso: new Date(seededAtMs).toISOString(),
    nowMs: seededAtMs,
    fenceToken: `seed-lease-${input.holder}`,
  });
  if (!claimed.ok) throw new Error(`lease seed failed: ${JSON.stringify(claimed)}`);
};

/**
 * The dispatch family's claim port, wired exactly as production wires it: the
 * atomic seam decides the verdict inside the claim (same-ref under any holder →
 * `queue.single-flight`, other ref → `queue.lease-conflict`, never a renewal).
 */
export const dispatchClaim = (
  single: SingleFlightStore,
  ref: string,
): Promise<DispatchLeaseClaim> =>
  claimDispatchLease(single.store, {
    ref,
    nowIso: () => new Date(single.nowMs()).toISOString(),
    nowMs: single.nowMs,
    fenceToken: `dispatch-claim-${ref}`,
    ttlMs: TTL,
  });

/** Release a seeded lease through the delivered primitive (the holder's own). */
export const releaseSeededLease = (
  single: SingleFlightStore,
  input: { readonly ref: string; readonly holder: string },
): void => {
  const released = releaseQueueLease(single.store, {
    ref: input.ref,
    holder: input.holder,
    nowIso: NOW_ISO,
    nowMs: single.nowMs(),
    fenceToken: `release-${input.holder}-${input.ref}`,
  });
  if (!released.ok) throw new Error(`lease release failed: ${JSON.stringify(released)}`);
};

/** The claim path's admission, wired exactly as the queue command wires it. */
export const claimAdmission = (
  single: SingleFlightStore,
  input: { readonly ref: string; readonly holder: string },
) => claimSingleFlightRefusal(single.store, { ...input, nowMs: single.nowMs() });

/** The lease claim through the delivered primitive, as `queue claim` runs it. */
export const claim = (
  single: SingleFlightStore,
  input: { readonly ref: string; readonly holder: string },
) =>
  claimQueueLease(single.store, {
    ref: input.ref,
    holder: input.holder,
    runner: `runner-${input.holder}`,
    weightClass: "standard",
    ttlMs: TTL,
    nowIso: NOW_ISO,
    nowMs: single.nowMs(),
    fenceToken: `claim-${input.holder}-${input.ref}`,
  });

/** The live lease truth for zero-mutation observations. */
export const activeLease = (single: SingleFlightStore) => {
  const read = readActiveLeases(single.store, single.nowMs());
  if (!read.ok) throw new Error("active lease read failed");
  return read.active;
};

/** Claim the dispatch lane's lease through the delivered admission path. */
export const claimLane = (single: SingleFlightStore, ref: string) =>
  claimDispatchLease(single.store, {
    ref,
    nowIso: () => new Date(single.nowMs()).toISOString(),
    nowMs: single.nowMs,
    fenceToken: `dispatch-lane-${ref}-${single.nowMs()}`,
    ttlMs: TTL,
  });

/** Renew the dispatch lane's lease through the delivered run-path renewal. */
export const renewLane = (
  single: SingleFlightStore,
  input: { readonly ref: string; readonly holder: string; readonly expectedHeartbeatAt: string },
) =>
  renewDispatchLease(single.store, {
    repository: REPO,
    ref: input.ref,
    holder: input.holder,
    expectedHeartbeatAt: input.expectedHeartbeatAt,
    ttlMs: TTL,
    nowIso: new Date(single.nowMs()).toISOString(),
    nowMs: single.nowMs(),
    fenceToken: `renew-lane-${input.holder}-${single.nowMs()}`,
  });

/** The second dispatch's admission probe over the same store (TC-PEAK-010). */
export const secondDispatchRefusal = (single: SingleFlightStore, ref: string) =>
  claimLane(single, ref);

/** The durable record count for zero-append observations. */
export const recordCount = (single: SingleFlightStore): number => {
  const read = single.store.readRecords();
  if (!read.ok) throw new Error("store read failed");
  return read.value.records.length;
};

/** The folded entry refs for fold observations. */
export const foldedRefs = (single: SingleFlightStore): readonly string[] => {
  const fold = readQueueFold(single.store);
  if (!fold.ok) throw new Error("fold read failed");
  return fold.value.entries.map((entry) => entry.ref);
};
