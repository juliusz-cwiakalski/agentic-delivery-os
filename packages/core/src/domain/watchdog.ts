/**
 * Pure watchdog evaluation (GH-221 F-1..F-4, DM-1..DM-4).
 *
 * No I/O, clock, randomness, or ambient environment: lane records and checkout
 * facts arrive through injected values, and every classification is a
 * deterministic function of those facts. The surface tier performs reads and
 * mutations; this module only decides what they mean.
 */
import {
  WATCHDOG_SCHEMA_VERSION,
  WATCHDOG_SIGNAL_KEYS,
  WATCHDOG_STALL_HEARTBEAT_MS,
  type WatchdogGitFacts,
  type WatchdogLaneRecord,
  type WatchdogMemoryPublication,
  type WatchdogProbe,
  type WatchdogRestorationAction,
  type WatchdogSignalKey,
  type WatchdogSignalSource,
  type WatchdogSignals,
  type WatchdogTeardownData,
  type WatchdogVerdict,
  type WatchdogVerdictData,
  type WatchdogWorktreeEntry,
} from "#contracts";

const MEMORY_ROOT = ".ai/memory";

const isMemoryPath = (path: string): boolean =>
  path === MEMORY_ROOT || path.startsWith(`${MEMORY_ROOT}/`);

const normalizeWorkspacePath = (path: string): string => path.replace(/\/+$/, "");

/** Whether an observed path sits under one of the lane's declared workspaces. */
export const isLaneWorkspacePath = (path: string, workspacePaths: readonly string[]): boolean =>
  workspacePaths.some((workspace) => {
    const root = normalizeWorkspacePath(workspace);
    return root.length > 0 && (path === root || path.startsWith(`${root}/`));
  });

const sortedUnique = (values: readonly string[]): string[] => [...new Set(values)].sort();

const dirtyEvidence = (baseRef: string, entries: readonly WatchdogWorktreeEntry[]): string => {
  const paths = sortedUnique(entries.map((entry) => entry.path));
  return `checkout dirty relative to base ${baseRef}: ${paths.join(", ")}`;
};

const nonBaseEvidence = (baseRef: string, actual: string): string =>
  `checkout not on base: expected ${baseRef}, actual ${actual}`;

/** The preflight classification: admit, refuse with evidence, or fail closed. */
export type WatchdogPreflightEvaluation =
  | { readonly outcome: "admitted"; readonly evidence: string }
  | {
      readonly outcome: "refused";
      readonly reason: "dirty" | "non-base";
      readonly evidence: string;
    }
  | {
      readonly outcome: "unevaluable";
      readonly reason: "base-missing" | "read-failed" | "contradictory";
      readonly evidence: string;
    };

/** Evaluate admission from the lane record and observed checkout facts (F-1). */
export const evaluateWatchdogPreflight = (input: {
  readonly lane: WatchdogLaneRecord;
  readonly checkout: WatchdogGitFacts;
}): WatchdogPreflightEvaluation => {
  const { lane, checkout } = input;
  if (checkout.kind === "unreadable") {
    return {
      outcome: "unevaluable",
      reason: "read-failed",
      evidence: `checkout facts unreadable: ${checkout.detail}`,
    };
  }
  if (!checkout.baseResolves) {
    return {
      outcome: "unevaluable",
      reason: "base-missing",
      evidence: `base reference ${lane.baseRef} does not resolve`,
    };
  }
  if (checkout.clean && checkout.entries.length > 0) {
    return {
      outcome: "unevaluable",
      reason: "contradictory",
      evidence: `contradictory checkout facts: clean=true with ${checkout.entries.length} dirty ${checkout.entries.length === 1 ? "entry" : "entries"}`,
    };
  }
  if (!checkout.clean || checkout.entries.length > 0) {
    return {
      outcome: "refused",
      reason: "dirty",
      evidence: dirtyEvidence(lane.baseRef, checkout.entries),
    };
  }
  if (checkout.detached || checkout.branch !== lane.baseRef) {
    const actual = checkout.detached
      ? `detached HEAD at ${checkout.head}`
      : (checkout.branch ?? "unknown branch");
    return {
      outcome: "refused",
      reason: "non-base",
      evidence: nonBaseEvidence(lane.baseRef, actual),
    };
  }
  return { outcome: "admitted", evidence: `checkout clean on base ${lane.baseRef}` };
};

/** One planned restoration step, in deterministic report order (DM-4). */
export type WatchdogPlannedAction =
  | {
      readonly action: "preserve-commit";
      readonly commit: string;
      readonly ref: string;
      readonly evidence: string;
    }
  | { readonly action: "restore-checkout"; readonly baseRef: string; readonly evidence: string }
  | { readonly action: "checkout-unchanged"; readonly evidence: string }
  | { readonly action: "remove-residue"; readonly path: string; readonly evidence: string }
  | { readonly action: "preserve-content"; readonly path: string; readonly evidence: string };

/** The restoration plan: ordered actions plus memory-publication reports. */
export type WatchdogRestorationPlan =
  | {
      readonly ok: false;
      readonly reason: "base-missing" | "read-failed" | "contradictory";
      readonly evidence: string;
    }
  | {
      readonly ok: true;
      readonly actions: readonly WatchdogPlannedAction[];
      readonly memory: readonly WatchdogMemoryPublication[];
    };

/** The attributed ref that preserves a stranded/detached commit (PIN-3). */
export const watchdogPreservedRefName = (lane: string): string => `watchdog-preserved/${lane}`;

const memoryReport = (
  facts: Extract<WatchdogGitFacts, { readonly kind: "facts" }>,
): readonly WatchdogMemoryPublication[] =>
  [...facts.memory]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((fact) =>
      fact.state === "committed"
        ? {
            path: fact.path,
            status: "committed" as const,
            evidence: `publication ${fact.path} committed at ${fact.commit ?? "an unrecorded commit"}`,
          }
        : {
            path: fact.path,
            status: "preserved" as const,
            evidence: `publication ${fact.path} preserved in place (${fact.state})`,
          },
    );

/**
 * Plan the lane's restoration from observed facts (F-2, F-3, PIN-3). The plan
 * never deletes a commit-bearing branch and never plans any operation on a
 * `.ai/memory` path: memory publications are reported, not mutated.
 */
export const planWatchdogRestoration = (input: {
  readonly lane: WatchdogLaneRecord;
  readonly checkout: WatchdogGitFacts;
}): WatchdogRestorationPlan => {
  const { lane, checkout } = input;
  if (checkout.kind === "unreadable") {
    return {
      ok: false,
      reason: "read-failed",
      evidence: `checkout facts unreadable: ${checkout.detail}`,
    };
  }
  if (!checkout.baseResolves) {
    return {
      ok: false,
      reason: "base-missing",
      evidence: `base reference ${lane.baseRef} does not resolve`,
    };
  }
  if (checkout.clean && checkout.entries.length > 0) {
    return {
      ok: false,
      reason: "contradictory",
      evidence: `contradictory checkout facts: clean=true with ${checkout.entries.length} dirty ${checkout.entries.length === 1 ? "entry" : "entries"}`,
    };
  }

  const actions: WatchdogPlannedAction[] = [];
  if (checkout.strandedCommit !== undefined) {
    const ref = watchdogPreservedRefName(lane.lane);
    actions.push({
      action: "preserve-commit",
      commit: checkout.strandedCommit,
      ref,
      evidence: `stranded commit ${checkout.strandedCommit} preserved as ${ref}`,
    });
  }
  if (!checkout.detached && checkout.branch === lane.baseRef) {
    actions.push({
      action: "checkout-unchanged",
      evidence: `nothing to restore: checkout already on base ${lane.baseRef}`,
    });
  } else {
    const from = checkout.detached ? "detached HEAD" : (checkout.branch ?? "unknown branch");
    actions.push({
      action: "restore-checkout",
      baseRef: lane.baseRef,
      evidence: `restore checkout from ${from} to base ${lane.baseRef}`,
    });
  }

  const dirty = [...checkout.entries].sort((left, right) => left.path.localeCompare(right.path));
  for (const entry of dirty) {
    if (isMemoryPath(entry.path)) continue;
    if (entry.change === "untracked" && isLaneWorkspacePath(entry.path, lane.workspacePaths)) {
      actions.push({
        action: "remove-residue",
        path: entry.path,
        evidence: `lane-workspace residue ${entry.path} removed (untracked)`,
      });
      continue;
    }
    actions.push({
      action: "preserve-content",
      path: entry.path,
      evidence: `unattributable content ${entry.path} preserved in place (${entry.change})`,
    });
  }

  return { ok: true, actions, memory: memoryReport(checkout) };
};

/** The liveness classification: an explicit absent outcome, or a verdict. */
export type WatchdogLivenessEvaluation =
  | { readonly outcome: "absent"; readonly evidence: string }
  | {
      readonly outcome: "verdict";
      readonly verdict: WatchdogVerdict;
      readonly signals: WatchdogSignals;
      readonly evidence: string;
    };

const presentSignalKeys = (signals: WatchdogSignals): readonly WatchdogSignalKey[] =>
  WATCHDOG_SIGNAL_KEYS.filter((key) => typeof signals[key] === "number");

/**
 * Classify liveness from the declared signals shape only (F-4, DEC-2, DEC-3).
 * The input type declares no CPU field, and `stalled` additionally requires the
 * declared progress signals to corroborate the heartbeat age.
 */
export const classifyWatchdogLiveness = (signals: WatchdogSignals): WatchdogLivenessEvaluation => {
  const present = presentSignalKeys(signals);
  if (present.length === 0) {
    return {
      outcome: "absent",
      evidence: "no declared progress-signal sources are available; the answer is unknown",
    };
  }
  const heartbeat = signals.heartbeatAgeMs;
  const corroboratedStall =
    typeof heartbeat === "number" &&
    heartbeat >= WATCHDOG_STALL_HEARTBEAT_MS &&
    signals.tokenDelta === 0 &&
    signals.traffic === 0;
  if (corroboratedStall) {
    return {
      outcome: "verdict",
      verdict: "stalled",
      signals,
      evidence: `heartbeat age ${heartbeat}ms with tokenDelta=0 and traffic=0 corroborates a stall`,
    };
  }
  return {
    outcome: "verdict",
    verdict: "progressing",
    signals,
    evidence: `declared progress signals observed: ${present.join(", ")}`,
  };
};

/** Merge the declared signal sources; no present value means the absent outcome. */
export const readWatchdogSignals = (
  sources: readonly WatchdogSignalSource[],
  lane: string,
): WatchdogSignals | undefined => {
  const merged: { -readonly [Key in WatchdogSignalKey]?: number } = {};
  let present = false;
  for (const source of sources) {
    const value = source(lane);
    if (value === undefined) continue;
    for (const key of WATCHDOG_SIGNAL_KEYS) {
      const candidate = value[key];
      if (typeof candidate === "number") {
        merged[key] = candidate;
        present = true;
      }
    }
  }
  return present ? merged : undefined;
};

/** Build the verdict-bearing probe data shared by all three probes (DM-3). */
export const buildWatchdogVerdictData = (input: {
  readonly probe: WatchdogProbe;
  readonly lane: string;
  readonly verdict: WatchdogVerdict;
  readonly signals?: WatchdogSignals;
  readonly evidence: string;
}): WatchdogVerdictData => ({
  schemaVersion: WATCHDOG_SCHEMA_VERSION,
  probe: input.probe,
  lane: input.lane,
  verdict: input.verdict,
  signals: input.signals ?? {},
  evidence: input.evidence,
});

export type WatchdogPreflightBuildInput = Parameters<typeof buildWatchdogVerdictData>[0];

/** Build teardown `data`: the verdict data plus the restoration report (DM-4). */
export const buildWatchdogTeardownData = (input: {
  readonly lane: string;
  readonly verdict: WatchdogVerdict;
  readonly signals?: WatchdogSignals;
  readonly evidence: string;
  readonly actions: readonly WatchdogRestorationAction[];
  readonly memory: readonly WatchdogMemoryPublication[];
}): WatchdogTeardownData => {
  const { actions, memory, ...verdictInput } = input;
  return {
    ...buildWatchdogVerdictData({ ...verdictInput, probe: "teardown" }),
    actions,
    memory,
  };
};
