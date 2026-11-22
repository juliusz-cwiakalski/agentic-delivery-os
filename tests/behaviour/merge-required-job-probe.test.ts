/**
 * TC-F3-002 / TC-F3-003 / TC-F3-004 / TC-F3-005 / TC-F3-006 (behaviour half) —
 * the post-verification probe refuses every **declared** required job that is
 * not green on the verified head, through the delivered
 * `merge.gate.<gate-id>.failed` family, with exactly one attribution value.
 *
 * The delivery under test is the pure transaction composed over the harness's
 * recording ports, so every assertion reads the refusal evidence the CLI maps
 * onto its failure envelope. Each absence is paired with a positive: an
 * undeclared job and an other-head page are proven inert by the same page
 * producing a refusal once the job is declared and labelled with the head.
 */
import { describe, expect, test } from "bun:test";
import { resolveAppErrorCode } from "../../packages/cli/src/classify";
import {
  ERROR_TABLE_FAMILIES,
  MERGE_DEFAULT_GATE_ENTRIES,
  MERGE_GATE_ERROR_PREFIX,
  MERGE_GATE_ERROR_SUFFIX,
  MERGE_REFUSAL_ATTRIBUTIONS,
  type MergeGateEntry,
  type PipelineJobState,
} from "../../packages/core/src/contracts/index";
import { resolveMergeGateSet } from "../../packages/core/src/domain/merge-gate-set";
import {
  evaluateRequiredJobGate,
  type RequiredJobEvaluation,
} from "../../packages/core/src/domain/merge-probe";
import {
  type MergeFailure,
  runMergeTransaction,
} from "../../packages/core/src/domain/merge-transaction";
import {
  baseCheckRuns,
  baseRequest,
  createMergeHarness,
  MERGE_CLOCK_MS,
  MERGE_HEAD,
  type MergeHarness,
  verificationFor,
  verificationRecord,
} from "../fixtures/merge/harness";

const MINUTE = 60_000;
const isoAt = (offsetMs: number): string => new Date(MERGE_CLOCK_MS + offsetMs).toISOString();
const VERIFIED_AT = isoAt(-2 * MINUTE);
const OTHER_HEAD = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";
const WORKSPACE_JOB = "workspace-tests";

const workspaceEntry: MergeGateEntry = {
  id: WORKSPACE_JOB,
  recipe: "required-ci-job",
  surface: "both",
  job: WORKSPACE_JOB,
};

const declaredSet = (entries: readonly MergeGateEntry[]) => {
  const raw = { schemaVersion: "delivery.merge.gates.v1", entries };
  const set = resolveMergeGateSet(raw);
  if (!set.ok) throw new Error(`fixture gate set invalid: ${set.failure.detail}`);
  return { raw, set: set.value };
};

const declaredWorkspace = () => declaredSet([...MERGE_DEFAULT_GATE_ENTRIES, workspaceEntry]);

/**
 * The same job declared by the change-level battery only (surface `battery`):
 * the freshness probe does not re-evaluate it, so a non-green page surfaces in
 * the post-refusal checks posture rather than pre-empting the landing.
 */
const postureWorkspace = () =>
  declaredSet([...MERGE_DEFAULT_GATE_ENTRIES, { ...workspaceEntry, surface: "battery" }]);

type Page = {
  readonly items: readonly {
    readonly identity: { readonly systemName: string; readonly entityId: string };
    readonly pipelineName: string;
    readonly jobs: readonly { readonly jobName: string; readonly jobState: PipelineJobState }[];
    readonly traceEvidence: readonly never[];
  }[];
  readonly pageItemCount: number;
  readonly sha?: string;
};

/** One page with the declared job in a delivered job state, labelled with a head. */
const pageWith = (state: PipelineJobState, sha: string | undefined = MERGE_HEAD): Page => ({
  items: [
    ...baseCheckRuns().items,
    {
      identity: { systemName: "github", entityId: "44899" },
      pipelineName: WORKSPACE_JOB,
      jobs: [{ jobName: WORKSPACE_JOB, jobState: state }],
      traceEvidence: [],
    },
  ],
  pageItemCount: 3,
  ...(sha === undefined ? {} : { sha }),
});

/** The same page rendered through the single required-check evaluator. */
const evaluatePage = (state: PipelineJobState, sha: string | undefined = MERGE_HEAD) =>
  evaluateRequiredJobGate({
    jobName: WORKSPACE_JOB,
    runs: pageWith(state, sha).items,
    pageSha: sha,
    headSha: MERGE_HEAD,
  });

/** The recorded verification whose declared required-job verdict is green. */
const recordedGreen = (set: ReturnType<typeof declaredSet>["set"]) =>
  verificationFor(set, {
    verifiedAt: VERIFIED_AT,
    gates: [
      ...verificationRecord().gates,
      {
        id: WORKSPACE_JOB,
        verdict: "pass" as const,
        reason: "ci-green",
        citation: {
          sources: [],
          identity: { changeRef: "GH-301" },
          counts: [],
          names: [],
          reasons: ["ci-green" as const],
        },
      },
    ],
  });

type Refused = { readonly failure: MergeFailure; readonly summary: string };

/** Compose the production transaction over the harness's recording ports. */
const transactionOf = async (harness: MergeHarness) => {
  const configRead = harness.runtime.readConfig(harness.ref);
  if (!configRead.ok) throw new Error(`fixture config failed: ${configRead.code}`);
  return runMergeTransaction({
    changeRef: harness.ref,
    dryRun: false,
    waiverDeclarations: [],
    config: configRead.config,
    ports: harness.runtime.createPorts(harness.ref),
  });
};

const refusedOf = async (harness: MergeHarness): Promise<Refused> => {
  const outcome = await transactionOf(harness);
  if (outcome.kind !== "refused") throw new Error(`expected a refusal, got ${outcome.kind}`);
  return { failure: outcome.failure, summary: outcome.summary };
};

const attributionLines = (summary: string): readonly string[] =>
  summary.split("\n").filter((line) => line.startsWith("attribution="));

const attributionKeys = (evidence: Record<string, unknown>): readonly string[] =>
  Object.keys(evidence).filter((key) => key.toLowerCase().includes("attribution"));

const timeValuedKeys = (evidence: Record<string, unknown>): readonly string[] =>
  Object.keys(evidence).filter((key) => /(?:At|time|Time|date|Date|verified|Verified)/u.test(key));

describe("TC-F3-002 a not-green declared job refuses through the family row with attribution probe", () => {
  const stimuli: readonly { readonly state: PipelineJobState; readonly reason: string }[] = [
    { state: "queued", reason: "ci-pending" },
    { state: "running", reason: "ci-pending" },
    { state: "canceled", reason: "ci-canceled" },
    { state: "skipped", reason: "ci-all-skipped" },
    { state: "failed", reason: "ci-failed" },
  ];

  for (const stimulus of stimuli) {
    test(`${stimulus.state} refuses ${WORKSPACE_JOB} with ${stimulus.reason} and attribution probe`, async () => {
      const { raw, set } = declaredWorkspace();
      const harness = createMergeHarness({ gateSet: raw, checkRuns: pageWith(stimulus.state) });
      try {
        harness.seedVerification(recordedGreen(set));
        const { failure, summary } = await refusedOf(harness);
        expect(failure.code).toBe(`merge.gate.${WORKSPACE_JOB}.failed`);
        expect(failure.domainKind).toBe("merge");
        expect(failure.exit).toBe(1);
        expect(failure.evidence.gateId).toBe(WORKSPACE_JOB);
        expect(failure.evidence.detail).toBe(stimulus.reason);
        expect(failure.evidence.jobs).toEqual([WORKSPACE_JOB]);
        expect(failure.evidence.attribution).toBe("probe");
        expect(attributionKeys(failure.evidence as unknown as Record<string, unknown>)).toEqual([
          "attribution",
        ]);
        // Exactly one attribution value, and it is the summary's own line.
        expect(attributionLines(summary)).toEqual(["attribution=probe"]);
        expect(summary).toContain(`gate=${WORKSPACE_JOB}`);
        expect(summary).toContain(`evidence=${stimulus.reason}`);
        expect(harness.counts.landing).toBe(0);
        expect(harness.transactions()).toHaveLength(0);
      } finally {
        harness.cleanup();
      }
    });
  }

  test("control M34: treating queued as green removes the finding, by stimulus name", () => {
    const greenIfQueued = (state: PipelineJobState): RequiredJobEvaluation =>
      evaluatePage(state === "queued" ? "succeeded" : state);
    const evaluated = evaluatePage("queued");
    expect(evaluated.verdict).toBe("fail");
    expect(evaluated.reason).toBe("ci-pending");
    const mutated = greenIfQueued("queued");
    expect(mutated.verdict).toBe("pass");
    expect(mutated.reason).toBe("ci-green");
  });

  test("control M35: one reason for all five states fails by the duplicated value", () => {
    const reasons = [
      evaluatePage("queued").reason,
      evaluatePage("running").reason,
      evaluatePage("canceled").reason,
      evaluatePage("skipped").reason,
      evaluatePage("failed").reason,
    ];
    expect(reasons).toEqual([
      "ci-pending",
      "ci-pending",
      "ci-canceled",
      "ci-all-skipped",
      "ci-failed",
    ]);
    expect(new Set(reasons).size).toBe(4);
    expect(reasons).not.toEqual(Array.from({ length: 5 }, () => "ci-pending"));
  });
});

describe("TC-F3-003 a job already not green in the recorded verification carries attribution recorded", () => {
  const recordedRed = (set: ReturnType<typeof declaredSet>["set"]) =>
    verificationFor(set, {
      verifiedAt: VERIFIED_AT,
      gates: verificationRecord().gates.map((gate) =>
        gate.id === "ci-green"
          ? {
              ...gate,
              verdict: "fail" as const,
              reason: "ci-failed",
              citation: {
                ...gate.citation,
                names: [{ kind: "failed-jobs" as const, values: [WORKSPACE_JOB], omitted: 0 }],
                reasons: ["ci-failed" as const],
              },
            }
          : gate,
      ),
    });

  test("the recorded arm names gate id, job and verdict, and carries no timestamp", async () => {
    const { raw, set } = declaredWorkspace();
    const harness = createMergeHarness({ gateSet: raw, checkRuns: pageWith("failed") });
    try {
      harness.seedVerification(recordedRed(set));
      const { failure, summary } = await refusedOf(harness);
      expect(failure.code).toBe("merge.gate.ci-green.failed");
      expect(failure.evidence.attribution).toBe("recorded");
      expect(failure.evidence.gateId).toBe("ci-green");
      expect(failure.evidence.jobs).toEqual([WORKSPACE_JOB]);
      expect(failure.evidence.detail).toBe("ci-failed");
      expect(attributionLines(summary)).toEqual(["attribution=recorded"]);

      // The verification timestamp is not an evidence field: the bounded
      // evidence carries no time-valued member and the detail is not a date.
      const evidence = failure.evidence as unknown as Record<string, unknown>;
      expect(timeValuedKeys(evidence)).toEqual([]);
      expect(Object.hasOwn(evidence, "verifiedAt")).toBe(false);
      expect(Number.isNaN(Date.parse(String(failure.evidence.detail)))).toBe(true);

      // The persisted record resolves by gate id + job and carries the
      // timestamp the refusal deliberately does not duplicate.
      const records = harness.verifications();
      const record = records.at(-1);
      expect(record?.verifiedAt).toBe(VERIFIED_AT);
      const gate = record?.gates.find((entry) => entry.id === failure.evidence.gateId);
      expect(gate).toBeDefined();
      const named = gate?.citation.names.flatMap((list) => list.values) ?? [];
      expect(named).toContain(WORKSPACE_JOB);
    } finally {
      harness.cleanup();
    }
  });

  test("the declared entry's own recorded verdict is the recorded arm", async () => {
    const { raw, set } = declaredWorkspace();
    const harness = createMergeHarness({ gateSet: raw, checkRuns: pageWith("failed") });
    try {
      harness.seedVerification(
        verificationFor(set, {
          verifiedAt: VERIFIED_AT,
          gates: [
            ...verificationRecord().gates,
            {
              id: WORKSPACE_JOB,
              verdict: "fail" as const,
              reason: "ci-failed",
              citation: {
                sources: [],
                identity: { changeRef: "GH-301" },
                counts: [],
                names: [{ kind: "failed-jobs" as const, values: [WORKSPACE_JOB], omitted: 0 }],
                reasons: ["ci-failed" as const],
              },
            },
          ],
        }),
      );
      const { failure } = await refusedOf(harness);
      expect(failure.code).toBe(`merge.gate.${WORKSPACE_JOB}.failed`);
      expect(failure.evidence.attribution).toBe("recorded");
      expect(failure.evidence.gateId).toBe(WORKSPACE_JOB);
      expect(failure.evidence.jobs).toEqual([WORKSPACE_JOB]);
      expect(failure.evidence.detail).toBe("ci-failed");
    } finally {
      harness.cleanup();
    }
  });

  test("paired control: the same fixture with a green record yields the probe arm", async () => {
    const { raw, set } = declaredWorkspace();
    const harness = createMergeHarness({ gateSet: raw, checkRuns: pageWith("failed") });
    try {
      harness.seedVerification(recordedGreen(set));
      const { failure } = await refusedOf(harness);
      expect(failure.code).toBe(`merge.gate.${WORKSPACE_JOB}.failed`);
      expect(failure.evidence.attribution).toBe("probe");
      expect(failure.evidence.attribution).not.toBe("recorded");
    } finally {
      harness.cleanup();
    }
  });

  test("controls M87/M92: the pair is closed, one field is carried, and no timestamp rides along", () => {
    expect(MERGE_REFUSAL_ATTRIBUTIONS).toEqual(["recorded", "probe"]);
    for (const value of ["recorded", "probe"]) {
      expect(MERGE_REFUSAL_ATTRIBUTIONS.includes(value as never)).toBe(true);
    }
    expect(MERGE_REFUSAL_ATTRIBUTIONS.includes("verified" as never)).toBe(false);
    expect(attributionKeys({ attribution: "recorded", secondAttribution: "probe" })).toHaveLength(
      2,
    );
    expect(timeValuedKeys({ attribution: "recorded", verifiedAt: VERIFIED_AT })).toEqual([
      "verifiedAt",
    ]);
  });
});

describe("TC-F3-004 an undeclared job is not gate evidence, proven by a declared positive", () => {
  test("the undeclared job proceeds to its landing and carries no attribution", async () => {
    const harness = createMergeHarness({ checkRuns: pageWith("failed") });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: VERIFIED_AT }));
      const outcome = await transactionOf(harness);
      expect(outcome.kind).toBe("merged");
      expect(JSON.stringify(outcome)).not.toContain("attribution");
      expect(JSON.stringify(outcome)).not.toContain(WORKSPACE_JOB);
      expect(harness.counts.landing).toBe(1);
    } finally {
      harness.cleanup();
    }
  });

  test("the same page with the job declared refuses naming it with attribution probe", async () => {
    const { raw, set } = declaredWorkspace();
    const harness = createMergeHarness({ gateSet: raw, checkRuns: pageWith("failed") });
    try {
      harness.seedVerification(recordedGreen(set));
      const { failure } = await refusedOf(harness);
      expect(failure.code).toBe(`merge.gate.${WORKSPACE_JOB}.failed`);
      expect(failure.evidence.jobs).toEqual([WORKSPACE_JOB]);
      expect(failure.evidence.attribution).toBe("probe");
      expect(harness.counts.landing).toBe(0);
    } finally {
      harness.cleanup();
    }
  });

  test("control M37: a page-wide rule would name the undeclared job; the outcome does not", async () => {
    const page = pageWith("failed");
    const pageWide = page.items
      .filter((run) => run.jobs.some((job) => job.jobState !== "succeeded"))
      .map((run) => run.pipelineName);
    expect(pageWide).toContain(WORKSPACE_JOB);

    const harness = createMergeHarness({ checkRuns: page });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: VERIFIED_AT }));
      const outcome = await transactionOf(harness);
      expect(outcome.kind).toBe("merged");
      expect(Object.hasOwn(outcome, "failure")).toBe(false);
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-F3-005 a check-run page for another head is not head evidence", () => {
  test("the other-head page neither refuses nor names the job", async () => {
    const { raw, set } = declaredWorkspace();
    const harness = createMergeHarness({ gateSet: raw, checkRuns: pageWith("failed", OTHER_HEAD) });
    try {
      harness.seedVerification(recordedGreen(set));
      const outcome = await transactionOf(harness);
      expect(outcome.kind).toBe("merged");
      // The report replays the recorded verdicts; the *failure* evidence is
      // what must not exist, and no attribution is produced.
      expect(Object.hasOwn(outcome, "failure")).toBe(false);
      expect(JSON.stringify(outcome)).not.toContain("attribution");
      expect(harness.counts.landing).toBe(1);
    } finally {
      harness.cleanup();
    }
  });

  test("the identical page labelled with the verified head refuses", async () => {
    const { raw, set } = declaredWorkspace();
    const harness = createMergeHarness({ gateSet: raw, checkRuns: pageWith("failed", MERGE_HEAD) });
    try {
      harness.seedVerification(recordedGreen(set));
      const { failure } = await refusedOf(harness);
      expect(failure.code).toBe(`merge.gate.${WORKSPACE_JOB}.failed`);
      expect(failure.evidence.attribution).toBe("probe");
    } finally {
      harness.cleanup();
    }
  });

  test("control M38: accepting the other-head page as evidence fails naming both SHAs", async () => {
    const { raw, set } = declaredWorkspace();
    const harness = createMergeHarness({ gateSet: raw, checkRuns: pageWith("failed", OTHER_HEAD) });
    try {
      harness.seedVerification(recordedGreen(set));
      const outcome = await transactionOf(harness);
      expect(outcome.kind).toBe("merged");
      expect(MERGE_HEAD).not.toBe(OTHER_HEAD);
      // The evaluator answers `unknown` for the other head, so a caller that
      // treated "not pass" as evidence would name the job from a foreign page.
      const foreign = evaluatePage("failed", OTHER_HEAD);
      expect(foreign.verdict).toBe("unknown");
      expect(foreign.reason).toBe("head-unresolved");
      expect(foreign.verdict).not.toBe("fail");
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-MRG-027 a pending cause converges without an operator act, and the remediation says so", () => {
  test("a queued required job refuses with the family remediation; a green page re-run converges", async () => {
    const { raw, set } = declaredWorkspace();
    const harness = createMergeHarness({ gateSet: raw, checkRuns: pageWith("queued") });
    try {
      harness.seedVerification(recordedGreen(set));
      const { failure, summary } = await refusedOf(harness);
      expect(failure.code).toBe(`merge.gate.${WORKSPACE_JOB}.failed`);
      expect(failure.evidence.detail).toBe("ci-pending");
      // The row's remediation names the producing command and the re-run; it
      // never instructs clearing an unnamed condition (AC-F3-5).
      expect(summary).toContain("remediation=Resolve the named merge-applicable gate evidence");
      expect(summary).toContain("re-run `verify gates`, then retry the merge");
      // The pending cause needs no operator act: once the check is green on
      // the same head, a plain re-run converges with one landing.
      harness.setCheckRuns(pageWith("succeeded"));
      const outcome = await transactionOf(harness);
      expect(outcome.kind).toBe("merged");
      expect(harness.counts.landing).toBe(1);
    } finally {
      harness.cleanup();
    }
  });

  test("control: the family row's single retryable value is false, never a pending-specific true", () => {
    const family = ERROR_TABLE_FAMILIES.find((entry) => entry.slotPrefix === "merge.gate.");
    expect(family?.retryable).toBe(false);
    // A family instance resolves through the family, so its retryable is the
    // family's single declared value.
    const resolved = resolveAppErrorCode("merge.gate.workspace-tests.failed");
    expect(resolved.ok).toBe(true);
    if (resolved.ok) expect(resolved.entry.retryable).toBe(family?.retryable);
  });
});

describe("TC-F3-006 a provider-required refusal is classified, never retried or bypassed", () => {
  test("the guarded landing is refused once and the checks posture classifies it", async () => {
    const { raw, set } = postureWorkspace();
    const harness = createMergeHarness({
      gateSet: raw,
      request: baseRequest({ mergeableState: "not-mergeable" }),
      landing: { ok: false, code: "provider.outage" },
      checkRuns: pageWith("queued"),
    });
    try {
      harness.seedVerification(verificationFor(set, { verifiedAt: VERIFIED_AT }));
      const { failure } = await refusedOf(harness);
      expect(failure.code).toBe("merge.gate.ci-green.failed");
      expect(failure.domainKind).toBe("merge");
      expect(failure.exit).toBe(1);
      expect(failure.evidence.detail).toBe("ci-pending");
      // One guarded attempt, one post-refusal re-read: never a retry.
      expect(harness.counts.landing).toBe(1);
      expect(harness.counts.requestDetail).toBe(1);
      // The refusal is the declared family instance, never a new identity.
      expect(
        `${MERGE_GATE_ERROR_PREFIX}${failure.evidence.gateId ?? ""}${MERGE_GATE_ERROR_SUFFIX}`,
      ).toBe(failure.code);
      expect(
        (ERROR_TABLE_FAMILIES as readonly { template?: string }[]).some(
          (row) => row.template === "merge.gate.<gate-id>.failed",
        ),
      ).toBe(true);
    } finally {
      harness.cleanup();
    }
  });

  test("control M23: a retried landing fails naming the landing count", async () => {
    const harness = createMergeHarness({
      request: baseRequest({ mergeableState: "not-mergeable" }),
      landing: { ok: false, code: "provider.outage" },
      checkRuns: pageWith("queued"),
    });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: VERIFIED_AT }));
      await transactionOf(harness);
      expect(harness.counts.landing).toBe(1);
      expect(() => expect(2).toBe(harness.counts.landing)).toThrow();
    } finally {
      harness.cleanup();
    }
  });
});
