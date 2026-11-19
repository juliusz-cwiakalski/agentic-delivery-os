/**
 * The closeout × queue-removal milestone-variant harness (GH-349 TC-F6-008).
 *
 * A REAL state store fenced by the delivered `CloseoutStateRuntime`, the queue
 * ledger seeded through the production writer, and the `queueRemoval` hook wired
 * exactly as the production composition wires it. Three milestone variants share
 * the same fixture: `applied` (the step closes), `withheld` (an open attached
 * item withholds closure), and `gap` (the project declares no milestone
 * construct). The write log counts every fence acquisition, append and document
 * replacement, so the automatic removal's single-fence and one-record contract
 * is observed rather than assumed.
 */
import { createCloseoutStateRuntime } from "../../../packages/cli/src/edge";
import { declareQueueEntry, queueRemovalForCloseout } from "../../../packages/core/src/app/index";
import type { CloseoutData, StateStorePort } from "../../../packages/core/src/contracts/index";
import { ADAPTER_OPERATIONS } from "../../../packages/core/src/contracts/index";
import { buildCloseoutPlan, runCloseout } from "../../../packages/core/src/domain/closeout";
import { makeFacts, makeGit, makeProvider, makeWorkItem, observed } from "../closeout/harness";
import {
  MILESTONE_DECLARATION,
  MILESTONE_TITLE,
  openItemMilestone,
  satisfyingMilestone,
} from "../closeout/milestone";
import { type AuditStoreFixture, makeAuditStore, removeRoot } from "../state/harness";
import { type StoreWriteLog, trackingStore } from "./cli/harness";

const NOW_ISO = "2026-11-12T10:00:00Z";
const NOW_MS = Date.parse(NOW_ISO);
const REPO = "host/owner/name";

export type MilestoneVariant = "applied" | "withheld" | "gap";

export type CloseoutRemovalVariantHarness = {
  readonly variant: MilestoneVariant;
  readonly store: StateStorePort;
  readonly writeLog: StoreWriteLog;
  readonly run: () => Promise<
    | { readonly ok: true; readonly data: CloseoutData }
    | { readonly ok: false; readonly code: string }
  >;
  readonly dispose: () => void;
};

const GITHUB_CAPABILITIES = {
  supportedOperations: [...ADAPTER_OPERATIONS],
  declaredGaps: [],
  writableCarriers: [],
  readableCarriers: [],
} as const;

const milestoneFacts = (variant: MilestoneVariant) =>
  makeFacts({
    provider: { systemName: "github", capabilities: GITHUB_CAPABILITIES },
    observedWorkItem: observed(makeWorkItem({ milestone: MILESTONE_TITLE })),
    milestone:
      variant === "gap"
        ? { declaration: "none" }
        : variant === "withheld"
          ? { declaration: MILESTONE_DECLARATION, observation: openItemMilestone() }
          : { declaration: MILESTONE_DECLARATION, observation: satisfyingMilestone() },
  });

/** Build the milestone-variant harness over the real closeout composition. */
export const createCloseoutRemovalVariantHarness = (options: {
  readonly label: string;
  readonly variant: MilestoneVariant;
}): CloseoutRemovalVariantHarness => {
  const fixture: AuditStoreFixture = makeAuditStore(`queue-closeout-${options.label}`);
  const tracked = trackingStore(fixture.store);
  const facts = milestoneFacts(options.variant);
  const plan = buildCloseoutPlan(facts);
  const provider = makeProvider();
  const git = makeGit();
  const stateRuntime = createCloseoutStateRuntime(tracked.store);
  const run = async () => {
    const result = await runCloseout({
      plan,
      provider: provider.runtime,
      git: git.runtime,
      state: stateRuntime,
      timestamp: NOW_ISO,
      fenceToken: `fence-closeout-${options.label}`,
      apply: true,
      queueRemoval: (hook) =>
        queueRemovalForCloseout(tracked.store, {
          mode: hook.mode,
          workItemRef: hook.workItemRef,
          mergedObserved: hook.mergedObserved,
          recordedAt: NOW_ISO,
          nowMs: NOW_MS,
          ...(hook.handle === undefined ? {} : { handle: hook.handle }),
        }),
    });
    if (!result.ok) return { ok: false as const, code: result.error.code };
    return { ok: true as const, data: result.data };
  };
  return {
    variant: options.variant,
    store: tracked.store,
    writeLog: tracked.log,
    run,
    dispose: () => removeRoot(fixture.root),
  };
};

/** Seed one observed queue entry for the closeout's work item. */
export const seedVariantQueueEntry = (
  harness: CloseoutRemovalVariantHarness,
  ref = "GH-183",
): void => {
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

export { NOW_ISO, NOW_MS };
