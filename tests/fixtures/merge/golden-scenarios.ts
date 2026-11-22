/**
 * The fixed golden scenarios shared by the merge and deploy golden suites.
 * Every factory builds a fresh harness over the same injected facts, so each
 * run is the first invocation and the bytes are deterministic.
 */
import { MERGE_DEFAULT_GATE_ENTRIES } from "../../../packages/core/src/contracts/index";
import { resolveMergeGateSet } from "../../../packages/core/src/domain/merge-gate-set";
import {
  baseCheckRuns,
  baseWorkItem,
  createMergeHarness,
  MERGE_CLOCK_MS,
  MERGE_HEAD,
  MERGE_REF,
  verificationFor,
  verificationRecord,
} from "./harness";

const MINUTE = 60_000;
const isoAt = (offsetMs: number): string => new Date(MERGE_CLOCK_MS + offsetMs).toISOString();

/** A base-tip record head, genuinely different from the request's asserted head. */
const STALE_RECORD_HEAD = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const WRONG_BRANCH_DECLARATION = "feat/GH-301/somewhere-else";

const gated = () => ({
  workItem: baseWorkItem({ labels: ["change", "hand-back"], updatedAt: isoAt(-3 * MINUTE) }),
  ownerPrincipal: "owner-principal",
});

const gatedRecord = () =>
  verificationRecord({
    verifiedAt: isoAt(-2 * MINUTE),
    trackerPosture: { labels: ["change", "hand-back"], ownerLabels: ["hand-back"] },
    gates: [
      ...verificationRecord().gates.filter((gate) => gate.id !== "owner-gate"),
      {
        id: "owner-gate",
        verdict: "fail" as const,
        reason: "owner-gate-present",
        citation: {
          sources: [],
          identity: { changeRef: MERGE_REF },
          counts: [],
          names: [{ kind: "owner-labels" as const, values: ["hand-back"], omitted: 0 }],
          reasons: ["owner-gate-present" as const],
        },
      },
    ],
  });

const redCheckRuns = () => ({
  items: baseCheckRuns().items.map((run) =>
    run.pipelineName === "CI / test (18)"
      ? { ...run, jobs: [{ jobName: run.pipelineName, jobState: "failed" as const }] }
      : run,
  ),
  pageItemCount: 2,
  sha: MERGE_HEAD,
});

const WORKSPACE_JOB = "workspace-tests";

const declaredWorkspaceGateSet = () => {
  const raw = {
    schemaVersion: "delivery.merge.gates.v1",
    entries: [
      ...MERGE_DEFAULT_GATE_ENTRIES,
      {
        id: WORKSPACE_JOB,
        recipe: "required-ci-job",
        surface: "both",
        job: WORKSPACE_JOB,
      },
    ],
  };
  const set = resolveMergeGateSet(raw);
  if (!set.ok) throw new Error(`fixture gate set invalid: ${set.failure.detail}`);
  return { raw, set: set.value };
};

const workspaceCheckRuns = (
  jobState: "queued" | "running" | "canceled" | "skipped" | "failed",
) => ({
  items: [
    ...baseCheckRuns().items,
    {
      identity: { systemName: "github", entityId: "44899" },
      pipelineName: WORKSPACE_JOB,
      jobs: [{ jobName: WORKSPACE_JOB, jobState }],
      traceEvidence: [],
    },
  ],
  pageItemCount: 3,
  sha: MERGE_HEAD,
});

/**
 * A declared `required-ci-job` refusal over one recorded gate verdict.
 *
 * `recorded` is the gate entry's own recorded verdict: `pass` makes the finding
 * the probe's (`recorded` green, the page observed it), and `fail` makes it the
 * record's (`recorded` already reported the job not green).
 */
const requiredJobScenario = (recorded: "pass" | "fail") => {
  const { raw, set } = declaredWorkspaceGateSet();
  const recordedGates =
    recorded === "pass"
      ? [
          ...verificationRecord().gates,
          {
            id: WORKSPACE_JOB,
            verdict: "pass" as const,
            reason: "ci-green",
            citation: {
              sources: [],
              identity: { changeRef: MERGE_REF },
              counts: [],
              names: [],
              reasons: ["ci-green" as const],
            },
          },
        ]
      : [
          ...verificationRecord().gates,
          {
            id: WORKSPACE_JOB,
            verdict: "fail" as const,
            reason: "ci-failed",
            citation: {
              sources: [],
              identity: { changeRef: MERGE_REF },
              counts: [],
              names: [{ kind: "failed-jobs" as const, values: [WORKSPACE_JOB], omitted: 0 }],
              reasons: ["ci-failed" as const],
            },
          },
        ];
  const harness = createMergeHarness({ gateSet: raw, checkRuns: workspaceCheckRuns("failed") });
  harness.seedVerification(
    verificationFor(set, { verifiedAt: isoAt(-2 * MINUTE), gates: recordedGates }),
  );
  return { harness, args: [] };
};

export type GoldenHarness = {
  readonly harness: ReturnType<typeof createMergeHarness>;
  readonly args: readonly string[];
};

export const goldenScenarios = (): Record<string, () => GoldenHarness> => ({
  success: () => {
    const harness = createMergeHarness();
    harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
    return { harness, args: [] };
  },
  "refusal-stale": () => {
    const harness = createMergeHarness({ checkRuns: redCheckRuns() });
    // The record's head is the base tip and the resolved request head differs:
    // recorded-sha and current-sha are genuinely different objects (AC-F1-5).
    harness.seedVerification(
      verificationRecord({ verifiedAt: isoAt(-31 * MINUTE), headSha: STALE_RECORD_HEAD }),
    );
    return { harness, args: [] };
  },
  "refusal-gate": () => requiredJobScenario("pass"),
  "refusal-required-job-probe": () => requiredJobScenario("pass"),
  "refusal-required-job-recorded": () => requiredJobScenario("fail"),
  "refusal-tracker": () => {
    const harness = createMergeHarness({
      workItem: baseWorkItem({ labels: ["change", "hand-back"], updatedAt: isoAt(-1 * MINUTE) }),
    });
    harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
    return { harness, args: [] };
  },
  "refusal-waiver": () => {
    const harness = createMergeHarness(gated());
    harness.seedVerification(gatedRecord());
    return {
      harness,
      args: [MERGE_REF, "--waive", "owner-gate", "--waived-by", "someone-else"],
    };
  },
  "refusal-override": () => {
    const harness = createMergeHarness(gated());
    harness.seedVerification(gatedRecord());
    return { harness, args: [] };
  },
  "refusal-work-item": () => {
    // The work-item refusal's emitter (GH-366 AC-F3-4): a tracker object that
    // does not resolve names its own identity, the invocation ref, and the
    // read operation, never the generic abort.
    const harness = createMergeHarness({ workItem: { fault: "merge.work-item-unresolved" } });
    harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
    return { harness, args: [] };
  },
  "refusal-branch": () => {
    // The branch resolution's refusal emitter (GH-366 AC-F1-3): a candidate
    // whose record declares a branch that disagrees with its own source ref
    // refuses with the chosen closed reason and the attempted tree path.
    const harness = createMergeHarness({
      recordsAtHead: { [MERGE_HEAD]: { declaration: WRONG_BRANCH_DECLARATION } },
    });
    harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
    return { harness, args: [] };
  },
  "refusal-request": () => {
    // The request refusal's emitter (GH-366 AC-F1-4): an empty open page whose
    // convergence attempt observes the EMPTY matched-identity set refuses
    // `no-open-request` as a decidable zero.
    const harness = createMergeHarness({ openRequests: { items: [], saturated: false } });
    harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
    return { harness, args: [] };
  },
});
