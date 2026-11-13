/**
 * The closeout queue-removal harness (GH-292 TC-QLC-020..025): a REAL state
 * store fenced by the delivered `CloseoutStateRuntime`, with the queue
 * ledgers seeded through the core seams and the `queueRemoval` hook wired
 * exactly as the production composition wires it — `queueRemovalForCloseout`
 * over the same store the transaction fences.
 */

import { createCloseoutStateRuntime } from "../../../packages/cli/src/edge";
import {
  claimQueueLease,
  declareQueueEntry,
  queueRemovalForCloseout,
} from "../../../packages/core/src/app/index";
import type { CloseoutData, StateStorePort } from "../../../packages/core/src/contracts/index";
import { CLOSEOUT_QUEUE_REMOVAL_SKIP_REASONS } from "../../../packages/core/src/contracts/index";
import { buildCloseoutPlan, runCloseout } from "../../../packages/core/src/domain/closeout";
import { type AuditStoreFixture, makeAuditStore, removeRoot } from "../state/harness";
import { makeFacts, makeGit, makeProvider } from "./harness";

const NOW_ISO = "2026-11-12T10:00:00Z";
const NOW_MS = Date.parse(NOW_ISO);
export const REPO = "host/owner/name";
const TTL = 90_000;

/** The closeout fixture's work item ref (the delivered closeout target). */
export const CLOSEOUT_WORK_ITEM_REF = "GH-183";

export type QueueRemovalHarnessOptions = {
  readonly label: string;
  /** `observed` (default) keeps the merge truth; any other value removes it. */
  readonly mergeObserved?: boolean;
  readonly apply: boolean;
  /** `false` composes the delivered closeout without the queue hook. */
  readonly hookEnabled?: boolean;
};

export type QueueRemovalHarness = {
  readonly store: StateStorePort;
  readonly run: () => Promise<
    | { readonly ok: true; readonly data: CloseoutData }
    | { readonly ok: false; readonly code: string }
  >;
  readonly dispose: () => void;
};

export const createQueueRemovalHarness = (
  options: QueueRemovalHarnessOptions,
): QueueRemovalHarness => {
  const fixture: AuditStoreFixture = makeAuditStore(`closeout-queue-${options.label}`);
  const facts = makeFacts(
    options.mergeObserved === false
      ? ({ mergedRequest: { observation: "unobserved" } } as never)
      : {},
  );
  const plan = buildCloseoutPlan(facts);
  const provider = makeProvider();
  const git = makeGit();
  const stateRuntime = createCloseoutStateRuntime(fixture.store);
  const run = async () => {
    const result = await runCloseout({
      plan,
      provider: provider.runtime,
      git: git.runtime,
      state: stateRuntime,
      timestamp: NOW_ISO,
      fenceToken: `fence-closeout-${options.label}`,
      apply: options.apply,
      ...(options.hookEnabled === false
        ? {}
        : {
            queueRemoval: (hook) =>
              queueRemovalForCloseout(fixture.store, {
                mode: hook.mode,
                workItemRef: hook.workItemRef,
                mergedObserved: hook.mergedObserved,
                recordedAt: NOW_ISO,
                nowMs: NOW_MS,
                ...(hook.handle === undefined ? {} : { handle: hook.handle }),
              }),
          }),
    });
    if (!result.ok) return { ok: false as const, code: result.error.code };
    return { ok: true as const, data: result.data };
  };
  return {
    store: fixture.store,
    run,
    dispose: () => removeRoot(fixture.root),
  };
};

/**
 * The hook seam invoked directly (GH-292 DM-6): the no-merge-truth cell — the
 * delivered apply closeout refuses without a merge before the hook runs, so
 * the closed reason is proven at the seam the composition wires.
 */
export const hookFor = (
  harness: QueueRemovalHarness,
  input: {
    readonly mode: "plan" | "apply";
    readonly mergedObserved: boolean;
    readonly workItemRef?: string;
    readonly handle?: unknown;
  },
) =>
  queueRemovalForCloseout(harness.store, {
    mode: input.mode,
    workItemRef: input.workItemRef ?? CLOSEOUT_WORK_ITEM_REF,
    mergedObserved: input.mergedObserved,
    recordedAt: NOW_ISO,
    nowMs: NOW_MS,
  });

/** Seed one observed queue entry for the closeout's work item. */
export const seedQueueEntry = (harness: QueueRemovalHarness, ref = "GH-292"): void => {
  const declared = declareQueueEntry(harness.store, {
    ref,
    repository: REPO,
    repositoryRoot: "/work/repo-alpha",
    priority: 1,
    recordedAt: NOW_ISO,
    fenceToken: `seed-closeout-${ref}`,
  });
  if (!declared.ok) throw new Error(`seed failed: ${JSON.stringify(declared)}`);
};

/** Seed a live lease held by `holder` over `ref`. */
export const seedQueueLease = (
  harness: QueueRemovalHarness,
  input: { readonly holder: string; readonly ref: string },
): void => {
  const claimed = claimQueueLease(harness.store, {
    ref: input.ref,
    holder: input.holder,
    runner: `runner-${input.holder}`,
    weightClass: "standard",
    ttlMs: TTL,
    nowIso: NOW_ISO,
    nowMs: NOW_MS,
    fenceToken: `seed-lease-${input.holder}`,
  });
  if (!claimed.ok) throw new Error(`lease seed failed: ${JSON.stringify(claimed)}`);
};

export { CLOSEOUT_QUEUE_REMOVAL_SKIP_REASONS };
