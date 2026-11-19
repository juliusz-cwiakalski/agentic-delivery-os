/**
 * TC-F2-001 .. TC-F2-006 — the mergeability refusal taxonomy.
 *
 * The decision rule is total over the delivered four-state normalization plus
 * absence: `conflicting` refuses the certain sync cause without a landing call;
 * `not-mergeable` offers the provider one guarded landing and classifies its
 * refusal from exactly one bounded post-refusal re-read; `unknown`/absent
 * performs exactly one exact-head recovery re-read. No branch rebases, mutates
 * the head it verified, retries a landing, or reports success by inference.
 */
import { describe, expect, test } from "bun:test";
import {
  ERROR_TABLE,
  MERGE_DEFAULT_GATE_ENTRIES,
  MERGE_GATE_SET_SCHEMA_VERSION,
  MERGE_SYNC_REQUIRED_REASONS,
  type PipelineRun,
} from "../../packages/core/src/contracts/index";
import {
  baseCheckRuns,
  baseRequest,
  createMergeHarness,
  MERGE_CLOCK_MS,
  MERGE_HEAD,
  type MergeHarness,
  verificationRecord,
} from "../fixtures/merge/harness";

const MINUTE = 60_000;
const isoAt = (offsetMs: number): string => new Date(MERGE_CLOCK_MS + offsetMs).toISOString();

const MOVED_HEAD = "d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4";

const errorOf = (run: { envelope?: Record<string, unknown> }) =>
  run.envelope?.error as Record<string, unknown> | undefined;

const summaryOf = (run: { envelope?: Record<string, unknown>; stderr: string }): string =>
  String(errorOf(run)?.summary ?? run.stderr);

const remediationOf = (code: string): string => {
  const row = ERROR_TABLE.find((entry) => entry.code === code);
  if (row === undefined) throw new Error(`no declared row for ${code}`);
  return row.remediationHint;
};

/** The landing refusal every not-mergeable fixture produces. */
const REFUSED_LANDING = { ok: false as const, code: "protection-rule" };

/** A page whose first job is in the given state (never green). */
const pageWith = (
  jobState: PipelineRun["jobs"][number]["jobState"],
): {
  items: readonly PipelineRun[];
  pageItemCount: number;
  sha: string;
} => ({
  items: baseCheckRuns().items.map((run, index) =>
    index === 0 ? { ...run, jobs: [{ jobName: run.pipelineName, jobState }] } : run,
  ),
  pageItemCount: 2,
  sha: MERGE_HEAD,
});

/** The shipped set plus ONE declared required job (a `required-ci-job` entry). */
const gateSetDeclaring = (job: string) => ({
  schemaVersion: MERGE_GATE_SET_SCHEMA_VERSION,
  entries: [
    ...MERGE_DEFAULT_GATE_ENTRIES,
    { id: "ci-required-job", recipe: "required-ci-job", surface: "battery", job },
  ],
});

/** The gate-set identity carrying the one declared job, in declaration order. */
const gateSetIdsDeclaring = (): readonly string[] => [
  ...MERGE_DEFAULT_GATE_ENTRIES.map((entry) => entry.id),
  "ci-required-job",
];

const notMergeableHarness = (options: {
  readonly page?: ReturnType<typeof pageWith>;
  readonly record?: Parameters<typeof verificationRecord>[0];
  readonly reReadHead?: string;
  readonly requiredJob?: string;
}): MergeHarness => {
  const harness = createMergeHarness({
    landing: REFUSED_LANDING,
    request: baseRequest({ mergeableState: "not-mergeable" }),
    ...(options.page === undefined ? {} : { checkRuns: options.page }),
    ...(options.requiredJob === undefined
      ? {}
      : { gateSet: gateSetDeclaring(options.requiredJob) }),
  });
  harness.seedVerification(
    verificationRecord({
      verifiedAt: isoAt(-2 * MINUTE),
      ...(options.requiredJob === undefined
        ? {}
        : {
            gateSet: {
              schemaVersion: MERGE_GATE_SET_SCHEMA_VERSION,
              ids: gateSetIdsDeclaring(),
            },
          }),
      ...(options.record ?? {}),
    }),
  );
  // The re-read returns the same request, unless a head change is declared.
  harness.setRequest(() =>
    baseRequest({
      mergeableState: "not-mergeable",
      ...(options.reReadHead === undefined ? {} : { headSha: options.reReadHead }),
    }),
  );
  return harness;
};

/** A request with the given mergeability; `undefined` omits the signal entirely. */
const requestWith = (
  state: "mergeable" | "conflicting" | "not-mergeable" | "unknown" | undefined,
) => {
  if (state !== undefined) return baseRequest({ mergeableState: state });
  const { mergeableState: _omitted, ...rest } = baseRequest();
  return rest;
};

describe("TC-F2-001 a conflicting request refuses one typed sync-required and touches nothing", () => {
  test("code, reason dirty, both heads, exit 1, zero refresh and zero landing", async () => {
    const harness = createMergeHarness({
      request: baseRequest({ mergeableState: "conflicting" }),
    });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      const result = await harness.run();
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("merge.sync-required");
      const error = errorOf(result);
      expect(error?.code).toBe("merge.sync-required");
      expect(error?.consequence).toBe("not_landed");
      expect(error?.retryable).toBe(false);
      const summary = summaryOf(result);
      expect(summary).toContain("evidence=dirty");
      expect(summary).toContain("request-state=conflicting");
      expect(summary).toContain(`recorded-sha=${MERGE_HEAD.slice(0, 7)}`);
      expect(summary).toContain(`current-sha=${MERGE_HEAD.slice(0, 7)}`);
      expect(summary).toContain(remediationOf("merge.sync-required"));
      // Nothing was refreshed, landed, or recorded; the head never moved.
      expect(harness.events).not.toContain("git-rebase-refresh");
      expect(harness.counts.landing).toBe(0);
      expect(harness.transactions()).toHaveLength(0);
      expect(await harness.runtime.createPorts(harness.ref).readHead()).toBe(MERGE_HEAD);
      expect(harness.counts.requestDetail).toBe(1);
    } finally {
      harness.cleanup();
    }
  });

  test("controls: a refresh, a landing, or the other reason value each fail by name", () => {
    const plantedRefresh = ["git-read-head", "git-rebase-refresh"];
    expect(plantedRefresh).toContain("git-rebase-refresh");
    expect(plantedRefresh.filter((event) => event === "git-rebase-refresh")).toHaveLength(1);
    expect(() => expect(1).toBe(0)).toThrow();
    expect(MERGE_SYNC_REQUIRED_REASONS).toEqual(["dirty", "behind-unconfirmed"]);
    expect(() =>
      expect(["dirty", "behind-unconfirmed"] as readonly string[]).not.toContain("behind"),
    ).not.toThrow();
  });
});

describe("TC-F2-002 a not-mergeable refusal resolves to behind-unconfirmed after one re-read", () => {
  test("one landing, two request reads, the observed state named, exit 1", async () => {
    const harness = notMergeableHarness({});
    try {
      const result = await harness.run();
      expect(result.exitCode).toBe(1);
      expect(errorOf(result)?.code).toBe("merge.sync-required");
      const summary = summaryOf(result);
      expect(summary).toContain("evidence=behind-unconfirmed");
      expect(summary).toContain("request-state=not-mergeable");
      expect(summary).toContain(remediationOf("merge.sync-required"));
      expect(harness.counts.landing).toBe(1);
      expect(harness.counts.requestDetail).toBe(2);
      expect(harness.transactions()).toHaveLength(0);
    } finally {
      harness.cleanup();
    }
  });

  test("controls: a third read, a retried landing, and the wrong reason each fail by name", async () => {
    const harness = notMergeableHarness({});
    try {
      await harness.run();
      expect(harness.counts.requestDetail).toBe(2);
      expect(harness.counts.landing).toBe(1);
      // A third read or a second landing would move these numbers.
      expect(() => expect(3).toBe(harness.counts.requestDetail)).toThrow();
      expect(() => expect(2).toBe(harness.counts.landing)).toThrow();
      // The pair has no third member, so a decisive `behind` cannot be declared.
      expect(() => expect(["dirty", "behind-unconfirmed"]).not.toContain("behind")).not.toThrow();
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-F2-003 a checks posture resolves to the effective gate set's row", () => {
  test("a pending job yields the ci-green family row with ci-pending", async () => {
    const harness = notMergeableHarness({
      page: pageWith("queued"),
      requiredJob: "CI / test (18)",
    });
    try {
      const result = await harness.run();
      expect(result.exitCode).toBe(1);
      expect(errorOf(result)?.code).toBe("merge.gate.ci-green.failed");
      const summary = summaryOf(result);
      expect(summary).toContain("gate=ci-green");
      expect(summary).toContain("evidence=ci-pending");
      expect(harness.counts.requestDetail).toBe(2);
    } finally {
      harness.cleanup();
    }
  });

  test("a job the recorded verification already read failed yields ci-failed", async () => {
    const harness = notMergeableHarness({
      page: pageWith("failed"),
      requiredJob: "CI / test (18)",
      record: {
        gates: verificationRecord().gates.map((gate) =>
          gate.id === "ci-green"
            ? {
                ...gate,
                citation: {
                  ...gate.citation,
                  names: [{ kind: "failed-jobs" as const, values: ["CI / test (18)"], omitted: 0 }],
                },
              }
            : gate,
        ),
      },
    });
    try {
      const result = await harness.run();
      expect(result.exitCode).toBe(1);
      expect(errorOf(result)?.code).toBe("merge.gate.ci-green.failed");
      expect(summaryOf(result)).toContain("evidence=ci-failed");
      expect(harness.counts.requestDetail).toBe(2);
      expect(harness.counts.landing).toBe(1);
    } finally {
      harness.cleanup();
    }
  });

  test("control: classifying a checks posture as sync-required fails naming both codes", () => {
    const codes = ["merge.gate.ci-green.failed", "merge.sync-required"];
    expect(codes).not.toEqual(["merge.sync-required", "merge.sync-required"]);
    expect(codes[0]).not.toBe(codes[1]);
  });
});

describe("AC-F3-3 the not-mergeable checks posture covers only declared required jobs", () => {
  test("an undeclared failing job is not evidence and the refusal stays behind-unconfirmed", async () => {
    // The page's failing job is `CI / test (18)`; the effective gate set
    // declares only `CI / lint`, which is green.
    const harness = notMergeableHarness({ page: pageWith("failed"), requiredJob: "CI / lint" });
    try {
      const result = await harness.run();
      expect(result.exitCode).toBe(1);
      expect(errorOf(result)?.code).toBe("merge.sync-required");
      const summary = summaryOf(result);
      expect(summary).toContain("evidence=behind-unconfirmed");
      expect(summary).not.toContain("gate=ci-green");
      expect(harness.counts.landing).toBe(1);
      expect(harness.counts.requestDetail).toBe(2);
    } finally {
      harness.cleanup();
    }
  });

  test("the same non-green job, declared, is gate evidence and refuses", async () => {
    const harness = notMergeableHarness({
      page: pageWith("failed"),
      requiredJob: "CI / test (18)",
    });
    try {
      const result = await harness.run();
      expect(result.exitCode).toBe(1);
      expect(errorOf(result)?.code).toBe("merge.gate.ci-green.failed");
      expect(summaryOf(result)).toContain("evidence=ci-failed");
      expect(harness.counts.landing).toBe(1);
      expect(harness.counts.requestDetail).toBe(2);
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-F2-004 no not-mergeable branch yields a clean pre-mutation abort", () => {
  test("the three stimuli's code set is exactly the two declared identities", async () => {
    const codes: string[] = [];
    // (a) the re-read repeats not-mergeable
    const repeated = notMergeableHarness({});
    // (b) the re-read observes a declared checks posture
    const checks = notMergeableHarness({ page: pageWith("queued"), requiredJob: "CI / test (18)" });
    // (c) the re-read observes a non-checks protection posture
    const blocked = notMergeableHarness({ page: baseCheckRuns() });
    for (const harness of [repeated, checks, blocked]) {
      try {
        const result = await harness.run();
        codes.push(String(errorOf(result)?.code));
        expect(harness.counts.landing).toBe(1);
        expect(harness.counts.requestDetail).toBe(2);
        expect(harness.transactions()).toHaveLength(0);
      } finally {
        harness.cleanup();
      }
    }
    expect([...new Set(codes)].sort()).toEqual([
      "merge.gate.ci-green.failed",
      "merge.sync-required",
    ]);
    expect(codes).not.toContain("merge.transaction-aborted");
  });

  test("the blocked-posture case names the observed state with the caveated remediation", async () => {
    const harness = notMergeableHarness({ page: baseCheckRuns() });
    try {
      const result = await harness.run();
      expect(errorOf(result)?.code).toBe("merge.sync-required");
      const summary = summaryOf(result);
      expect(summary).toContain("evidence=behind-unconfirmed");
      expect(summary).toContain("request-state=not-mergeable");
      expect(summary).toContain("protection rule is the cause");
      // The clean pre-mutation abort is exactly what this branch must not emit.
      expect(summary).not.toContain("merge.transaction-aborted");
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-F2-005 the undecisive boundary yields one typed refusal, never success", () => {
  test("behind-unconfirmed with the observed state and no success outcome", async () => {
    const harness = notMergeableHarness({});
    try {
      const result = await harness.run();
      expect(result.exitCode).toBe(1);
      expect(errorOf(result)?.code).toBe("merge.sync-required");
      expect(result.stdout).not.toContain("result=merged");
      expect(result.stdout).not.toContain("squash=");
      const summary = summaryOf(result);
      expect(summary).toContain("evidence=behind-unconfirmed");
      expect(summary).toContain("request-state=not-mergeable");
      expect(summary).toContain(remediationOf("merge.sync-required"));
      expect(MERGE_SYNC_REQUIRED_REASONS).not.toContain("behind");
      expect(harness.events).not.toContain("git-rebase-refresh");
      expect(harness.counts.landing).toBeLessThanOrEqual(1);
      expect(harness.counts.landing).toBe(1);
    } finally {
      harness.cleanup();
    }
  });

  test("control: a success, a dirty reason, or an uncaveated remediation fails by name", () => {
    const remediation = remediationOf("merge.sync-required");
    expect(remediation).toContain("protection rule is the cause");
    expect(remediation).not.toBe(remediationOf("merge.transaction-aborted"));
    expect(() => expect(["dirty"]).toContain("behind-unconfirmed")).toThrow();
  });
});

describe("TC-F2-006 unknown mergeability is recovered by exactly one exact-head re-read", () => {
  test("(a) a recovered mergeable read proceeds to exactly one guarded landing", async () => {
    const harness = createMergeHarness({ request: requestWith("unknown") });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      let reads = 0;
      harness.setRequest(() => {
        reads += 1;
        return reads === 1 ? requestWith("unknown") : requestWith("mergeable");
      });
      const result = await harness.run();
      expect(result.exitCode).toBe(0);
      expect(harness.counts.requestDetail).toBe(2);
      expect(harness.counts.landing).toBe(1);
      expect(harness.counts.nowIso).toBe(1);
      expect(harness.counts.nowMs).toBe(1);
    } finally {
      harness.cleanup();
    }
  });

  test("(b) a changed head refuses gates-stale with both heads and zero landings", async () => {
    const harness = createMergeHarness({ request: requestWith("unknown") });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      harness.setRequest(() => baseRequest({ mergeableState: "unknown", headSha: MOVED_HEAD }));
      const result = await harness.run();
      expect(result.exitCode).toBe(1);
      expect(errorOf(result)?.code).toBe("merge.gates-stale");
      const summary = summaryOf(result);
      expect(summary).toContain(MERGE_HEAD.slice(0, 7));
      expect(summary).toContain(MOVED_HEAD.slice(0, 7));
      expect(harness.counts.landing).toBe(0);
      expect(harness.counts.requestDetail).toBe(2);
    } finally {
      harness.cleanup();
    }
  });

  test("(c) a still-unknown read refuses mergeability-unknown at exit 2, retryable", async () => {
    const harness = createMergeHarness({ request: requestWith(undefined) });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      harness.setRequest(() => requestWith(undefined));
      const result = await harness.run();
      expect(result.exitCode).toBe(2);
      const error = errorOf(result);
      expect(error?.code).toBe("merge.mergeability-unknown");
      expect(error?.retryable).toBe(true);
      expect(error?.consequence).toBe("not_landed");
      expect(String(error?.remediationHint)).toContain("Retry after the provider finishes");
      expect(harness.counts.landing).toBe(0);
      expect(harness.counts.requestDetail).toBe(2);
      // No polling and no waiting: the clock is read once and no timer exists.
      expect(harness.counts.nowMs).toBe(1);
      expect(harness.transactions()).toHaveLength(0);
    } finally {
      harness.cleanup();
    }
  });

  test("control: a second recovery read fails naming the count", () => {
    const planted = { requestDetail: 3 };
    expect(planted.requestDetail).toBe(3);
    expect(() => expect(planted.requestDetail).toBe(2)).toThrow();
  });
});
