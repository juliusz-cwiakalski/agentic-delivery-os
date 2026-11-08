/**
 * Deterministic dispatch truth fixtures (GH-239 §6.3): one builder per token
 * family and every contradiction case, including the empty-URL tracker fact,
 * the missing tracker fact, and the unreadable truth reads.
 *
 * Fixtures are data only; the real classifier and the real derivation are used.
 */
import { classifyHarnessEvidence } from "../../../packages/core/src/domain/harness-classify";
import type {
  DispatchArtifactFacts,
  DispatchHarnessFacts,
  DispatchLedgerFacts,
  DispatchPrFact,
  DispatchRead,
  DispatchRestartFacts,
  DispatchTrackerFacts,
  DispatchTruthInput,
} from "../../../packages/core/src/domain/dispatch-result";
import type { HarnessEvidence } from "../../../packages/core/src/contracts/index";
import { COMPLETED_EVIDENCE, DISPATCH_NOW } from "./harness";

export const readOk = <T>(value: T): DispatchRead<T> => ({ ok: true, value });

export const readFail = <T = never>(
  reason: "ledger" | "tracker" | "artifact" | "state",
  identity?: string,
): DispatchRead<T> => ({
  ok: false,
  reason,
  ...(identity === undefined ? {} : { identity }),
});

export const harnessFacts = (evidence: HarnessEvidence): DispatchHarnessFacts => {
  const classified = classifyHarnessEvidence(evidence);
  const { token } = classified;
  return {
    outcome: classified.outcome,
    token,
    exitStatus: evidence.exitStatus,
    spawnRefused: evidence.spawnRefused,
  };
};

export const prNone: DispatchPrFact = { state: "none", url: null, mergeReady: false };

export const prOpen = (
  url: string | null = "https://example.test/owner/repo/pull/1",
): DispatchPrFact => ({
  state: "open",
  url,
  mergeReady: true,
});

export const prMerged = (
  url: string | null = "https://example.test/owner/repo/pull/1",
): DispatchPrFact => ({
  state: "already-merged",
  url,
  mergeReady: false,
});

export const artifacts = (input: {
  readonly branchCommits: number;
  readonly pr?: DispatchPrFact;
}): DispatchArtifactFacts => ({
  branchCommits: input.branchCommits,
  pr: input.pr ?? prNone,
});

export const ledger = (input: Partial<DispatchLedgerFacts> = {}): DispatchLedgerFacts => ({
  completed: 3,
  total: 7,
  lastCompletedPhase: "delivery_planning",
  progressed: true,
  workRemaining: true,
  ...input,
});

export const ledgerExhausted = (): DispatchLedgerFacts => ({
  completed: 7,
  total: 7,
  lastCompletedPhase: "pr_creation",
  progressed: false,
  workRemaining: false,
});

export const tracker = (input: Partial<DispatchTrackerFacts> = {}): DispatchTrackerFacts => ({
  state: "in-progress",
  blocking: false,
  ...input,
});

export const restarts = (input: Partial<DispatchRestartFacts> = {}): DispatchRestartFacts => ({
  count: 0,
  bound: 3,
  ...input,
});

/** The default: an open PR with commits and an advancing ledger. */
export const truthInput = (input: Partial<DispatchTruthInput> = {}): DispatchTruthInput => ({
  harness: readOk(harnessFacts(COMPLETED_EVIDENCE)),
  artifacts: readOk(artifacts({ branchCommits: 2, pr: prOpen() })),
  ledger: readOk(ledger()),
  tracker: readOk(tracker()),
  restarts: restarts(),
  handoverState: "dual-run",
  ...input,
});

/** Exit-0 with no branch commit, no PR, and no ledger progress (SC-M1-27). */
export const noArtifactInput = (): DispatchTruthInput =>
  truthInput({
    harness: readOk(harnessFacts(COMPLETED_EVIDENCE)),
    artifacts: readOk(artifacts({ branchCommits: 0, pr: prNone })),
    ledger: readOk(ledger({ progressed: false })),
  });

/** An open PR whose URL read returns empty (engine-side attribute only). */
export const unverifiedUrlInput = (): DispatchTruthInput =>
  truthInput({ artifacts: readOk(artifacts({ branchCommits: 2, pr: prOpen(null) })) });

/** The PR was already merged independently (detection only). */
export const mergedInput = (): DispatchTruthInput =>
  truthInput({ artifacts: readOk(artifacts({ branchCommits: 2, pr: prMerged() })) });

/** The tracker reports a delivery-blocking state. */
export const blockedInput = (): DispatchTruthInput =>
  truthInput({ tracker: readOk(tracker({ state: "delivery-blocked", blocking: true })) });

/** A lane exhausting its work with no remaining phase. */
export const exhaustedLaneInput = (): DispatchTruthInput =>
  truthInput({
    artifacts: readOk(artifacts({ branchCommits: 2, pr: prNone })),
    ledger: readOk(ledgerExhausted()),
  });

/** A harness spawn refusal: a recorded attempt, never a pre-session refusal. */
export const spawnRefusedInput = (evidence: HarnessEvidence): DispatchTruthInput =>
  truthInput({ harness: readOk(harnessFacts(evidence)) });

/** A spawn attempt that failed before any session existed. */
export const spawnFailureInput = (): DispatchTruthInput => truthInput({ spawnFailure: true });

/** Every unreadable-truth input, one per source. */
export const unreadableInputs = (): readonly {
  readonly source: "ledger" | "tracker" | "artifact" | "state";
  readonly input: DispatchTruthInput;
}[] => [
  { source: "ledger", input: truthInput({ ledger: readFail("ledger", "ledger.read-unreadable") }) },
  {
    source: "tracker",
    input: truthInput({ tracker: readFail("tracker", "tracker.read-unreadable") }),
  },
  {
    source: "artifact",
    input: truthInput({ artifacts: readFail("artifact", "artifact.read-unreadable") }),
  },
  { source: "state", input: truthInput({ harness: readFail("state", "state.store.torn") }) },
];

/** A missing tracker fact is never a clean success (TC-TRUTH-005). */
export const missingTrackerFactInput = (): DispatchTruthInput =>
  truthInput({ tracker: readFail("tracker", "tracker.fact-missing") });

/** The fixed recorded instant used in assertions. */
export const RECORDED_AT = DISPATCH_NOW;
