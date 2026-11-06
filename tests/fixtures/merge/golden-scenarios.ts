/**
 * The fixed golden scenarios shared by the merge and deploy golden suites.
 * Every factory builds a fresh harness over the same injected facts, so each
 * run is the first invocation and the bytes are deterministic.
 */
import { MERGE_DEFAULT_GATE_ENTRIES } from "../../../packages/core/src/contracts/index";
import { resolveMergeGateSet } from "../../../packages/core/src/domain/merge-gate-set";
import {
  baseCheckRuns,
  baseRequest,
  baseWorkItem,
  createFakeGit,
  createMergeHarness,
  MERGE_CLOCK_MS,
  MERGE_HEAD,
  MERGE_REF,
  verificationFor,
  verificationRecord,
} from "./harness";

const MINUTE = 60_000;
const isoAt = (offsetMs: number): string => new Date(MERGE_CLOCK_MS + offsetMs).toISOString();

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
    harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-31 * MINUTE) }));
    return { harness, args: [] };
  },
  "refusal-gate": () => {
    const raw = {
      schemaVersion: "delivery.merge.gates.v1",
      entries: [
        ...MERGE_DEFAULT_GATE_ENTRIES,
        {
          id: "workspace-tests",
          recipe: "required-ci-job",
          surface: "both",
          job: "workspace-tests",
        },
      ],
    };
    const set = resolveMergeGateSet(raw);
    if (!set.ok) throw new Error(`fixture gate set invalid: ${set.failure.detail}`);
    const harness = createMergeHarness({
      gateSet: raw,
      checkRuns: {
        items: [
          ...baseCheckRuns().items,
          {
            identity: { systemName: "github", entityId: "44899" },
            pipelineName: "workspace-tests",
            jobs: [{ jobName: "workspace-tests", jobState: "failed" as const }],
            traceEvidence: [],
          },
        ],
        pageItemCount: 3,
        sha: MERGE_HEAD,
      },
    });
    harness.seedVerification(verificationFor(set.value, { verifiedAt: isoAt(-2 * MINUTE) }));
    return { harness, args: [] };
  },
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
  "refusal-rebase": () => {
    const git = createFakeGit({
      refresh: {
        outcome: "conflicted",
        paths: ["packages/core/src/a.ts", "packages/core/src/b.ts"],
      },
    });
    const harness = createMergeHarness({
      git,
      request: baseRequest({ mergeableState: "conflicting" }),
    });
    harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
    return { harness, args: [] };
  },
});
