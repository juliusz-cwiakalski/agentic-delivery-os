/**
 * The 11-class parity table and the PERMANENT proof boundary (GH-347 §6.1,
 * §7.1; spec Appendix C, Appendix G).
 *
 * This module is the machine-checked source of the boundary: the eight proven
 * ids and the six not-proven ids in their declared order. `evidence.ts` also
 * holds the class rows' fixture inputs and the canonicalizer used by the
 * two-run determinism comparison. Nothing here reads a change artifact.
 */
import { createCommandScenario, readsFrom } from "../golden/harness";
import { COMPLETED_EVIDENCE, SPAWN_REFUSED_EVIDENCE, TOOL_FAILURE_EVIDENCE } from "../harness";
import { artifacts, prNone, prOpen, readFail, readOk, tracker } from "../truth";
import type { ParityEnvelope, ParityObservation } from "./harness";

/** The PROVEN surfaces, in the declared order (GH-386 adds the push seam). */
export const PARITY_PROVEN_SURFACES = [
  "claim",
  "lane",
  "spawn",
  "ladder",
  "terminate",
  "loop",
  "class-coverage",
  "no-shell",
  "push",
] as const;

/** The six NOT-PROVEN surfaces, in the declared order (Appendix C). */
export const PARITY_NOT_PROVEN_SURFACES = [
  "live-opencode",
  "live-provider",
  "os-termination",
  "real-lifecycle-outcome",
  "cross-process-race",
  "long-run-outage",
] as const;

export type ParityProvenSurface = (typeof PARITY_PROVEN_SURFACES)[number];
export type ParityNotProvenSurface = (typeof PARITY_NOT_PROVEN_SURFACES)[number];

/**
 * The permanent boundary constant. The current-truth page publishes the same
 * list (lifecycle phase 7); a mismatch is a documentation-phase defect caught
 * by the doc guard, never by this constant.
 */
export const PARITY_PROOF_BOUNDARY = {
  proven: [...PARITY_PROVEN_SURFACES],
  notProven: [...PARITY_NOT_PROVEN_SURFACES],
} as const;

export type ParitySeam = ParityProvenSurface;

/** One class row: the fixture input, the expected token and its delivered exit. */
export type ClassRow = {
  readonly id: string;
  readonly token: string;
  readonly exit: number;
  readonly declaredSeam: ParitySeam;
  readonly scenario: () => Promise<ParityObservation>;
};

const exitOf = (token: string): number => {
  switch (token) {
    case "merged":
    case "blocked":
    case "pr-open":
    case "pr-open-unverified":
    case "finished":
    case "noop-lane-nothing-to-do":
      return 0;
    default:
      return token === "state-unverified" ? 2 : 1;
  }
};

const timedOutEvidence = {
  completionMarker: false,
  exitStatus: null,
  timedOut: true,
  spawnRefused: false,
  failureReported: false,
  toolFailure: false,
};

/** Run one class through the real command path and the real derivation. */
const classObservation = async (input: {
  readonly label: string;
  readonly evidence?: typeof COMPLETED_EVIDENCE;
  readonly reads?: ReturnType<typeof readsFrom>;
  readonly restartCount?: number;
  readonly restartBudget?: number;
}): Promise<ParityObservation> => {
  const scenario = createCommandScenario({
    label: `class-${input.label}`,
    evidence: input.evidence ?? COMPLETED_EVIDENCE,
    reads: input.reads ?? readsFrom(),
    ...(input.restartCount === undefined ? {} : { restartCount: input.restartCount }),
    ...(input.restartBudget === undefined ? {} : { restartBudget: input.restartBudget }),
  });
  try {
    const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
    const envelope = (run.envelope ?? undefined) as ParityEnvelope | undefined;
    const { readDispatchAttempts, readDispatchLanes } = await import(
      "../../../../packages/core/src/app/dispatch-ledger"
    );
    const attempts = readDispatchAttempts(scenario.state.store);
    const lanes = readDispatchLanes(scenario.state.store);
    if (!attempts.ok || !lanes.ok) throw new Error("class observation read failed");
    return {
      exit: run.exit,
      token: run.envelope?.data?.result,
      results: [
        {
          exit: run.exit,
          stdout: run.stdout,
          stderr: run.stderr,
          ...(envelope === undefined ? {} : { envelope }),
        },
      ],
      attempts: attempts.records,
      lanes: lanes.records,
      divergences: 0,
      economicsRestarts: scenario.calls.restarts.length,
      leaseRecords: 0,
      leaseAcquisitions: 0,
      spawns: scenario.scripted.calls.filter((call) => call === "spawn").length,
      resumes: scenario.scripted.calls.filter((call) => call === "resume").length,
      waits: [],
      violations: [],
      invocations: [],
      envelopes: envelope === undefined ? [] : [envelope],
    };
  } finally {
    scenario.dispose();
  }
};

const row = (
  id: string,
  token: string,
  declaredSeam: ParitySeam,
  input: Parameters<typeof classObservation>[0],
): ClassRow => ({
  id,
  token,
  exit: exitOf(token),
  declaredSeam,
  scenario: () => classObservation(input),
});

/** The 11 class rows, each by its declared arm. */
export const CLASS_ROWS: readonly ClassRow[] = [
  row("class-merged", "merged", "class-coverage", {
    label: "merged-tracker",
    reads: readsFrom({ tracker: readOk(tracker({ state: "done" })) }),
  }),
  row("class-blocked", "blocked", "class-coverage", {
    label: "blocked",
    reads: readsFrom({ tracker: readOk(tracker({ state: "delivery-blocked", blocking: true })) }),
  }),
  row("class-pr-open", "pr-open", "class-coverage", { label: "pr-open" }),
  row("class-pr-open-unverified", "pr-open-unverified", "class-coverage", {
    label: "pr-open-unverified",
    reads: readsFrom({ artifacts: readOk(artifacts({ branchCommits: 2, pr: prOpen(null) })) }),
  }),
  row("class-failed", "failed", "class-coverage", {
    label: "failed",
    evidence: {
      completionMarker: true,
      exitStatus: 1,
      timedOut: false,
      spawnRefused: false,
      failureReported: true,
      toolFailure: false,
    } as typeof COMPLETED_EVIDENCE,
    reads: readsFrom({ artifacts: readOk(artifacts({ branchCommits: 0, pr: prNone })) }),
  }),
  row("class-finished", "finished", "class-coverage", {
    label: "finished",
    reads: readsFrom({ artifacts: readOk(artifacts({ branchCommits: 2, pmNotes: "complete" })) }),
  }),
  row("class-max-restarts", "max-restarts", "loop", {
    label: "max-restarts",
    evidence: timedOutEvidence as typeof COMPLETED_EVIDENCE,
    reads: readsFrom({ artifacts: readOk(artifacts({ branchCommits: 2, pmNotes: "complete" })) }),
    restartCount: 3,
    restartBudget: 3,
  }),
  row("class-state-unverified", "state-unverified", "class-coverage", {
    label: "state-unverified",
    reads: readsFrom({
      tracker: readFail("tracker", "tracker.read-unreadable"),
      artifacts: readFail("artifact", "artifact.read-unreadable"),
    }),
  }),
  row("class-partial", "partial", "class-coverage", {
    label: "partial",
    evidence: TOOL_FAILURE_EVIDENCE,
    reads: readsFrom({ artifacts: readOk(artifacts({ branchCommits: 2, pmNotes: "incomplete" })) }),
  }),
  row("class-noop-lane-permission", "noop-lane-permission", "class-coverage", {
    label: "noop-lane-permission",
    evidence: SPAWN_REFUSED_EVIDENCE,
  }),
  row("class-noop-lane-nothing-to-do", "noop-lane-nothing-to-do", "class-coverage", {
    label: "nothing-to-do",
    reads: readsFrom({ artifacts: readOk(artifacts({ branchCommits: 0, pr: prNone })) }),
  }),
];

/** The stable canonical form: the temp root normalized, JSON with sorted keys. */
export const canonicalize = (value: unknown, root: string): string => {
  const text = JSON.stringify(value, (_key, entry: unknown) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      return typeof entry === "string" ? entry.replaceAll(root, "<root>") : entry;
    }
    const record = entry as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) sorted[key] = record[key];
    return sorted;
  });
  return text ?? "";
};
