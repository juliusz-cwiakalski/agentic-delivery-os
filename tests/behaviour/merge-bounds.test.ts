/**
 * TC-MERGE-033 — the machine and human transaction bounds, with explicit
 * truncation marks and decisive evidence rendered first.
 */
import { describe, expect, test } from "bun:test";
import {
  MERGE_DEFAULT_GATE_ENTRIES,
  MERGE_MAX_CONFLICT_PATHS,
  MERGE_MAX_HUMAN_BYTES,
  MERGE_MAX_HUMAN_LINES,
  MERGE_MAX_MACHINE_BYTES,
  MERGE_MAX_REPORT_GATES,
  type MergeGateEntry,
  type PipelineRun,
} from "../../packages/core/src/contracts/index";
import { resolveMergeGateSet } from "../../packages/core/src/domain/merge-gate-set";
import {
  baseCheckRuns,
  baseRequest,
  createFakeGit,
  createMergeHarness,
  MERGE_CLOCK_MS,
  MERGE_HEAD,
  verificationFor,
  verificationRecord,
} from "../fixtures/merge/harness";

const MINUTE = 60_000;
const isoAt = (offsetMs: number): string => new Date(MERGE_CLOCK_MS + offsetMs).toISOString();

const customGates = (count: number): MergeGateEntry[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `declared-gate-${String(index).padStart(2, "0")}`,
    recipe: "required-ci-job" as const,
    surface: "both" as const,
    job: `job-${String(index).padStart(2, "0")}`,
  }));

const runsFor = (gates: readonly MergeGateEntry[]): PipelineRun[] =>
  gates
    .filter((gate) => gate.job !== undefined)
    .map((gate) => ({
      identity: { systemName: "github", entityId: `run-${gate.id}` },
      pipelineName: gate.job as string,
      jobs: [{ jobName: gate.job as string, jobState: "succeeded" as const }],
      traceEvidence: [],
    }));

const dataOf = (run: { envelope?: Record<string, unknown> }) =>
  run.envelope?.data as Record<string, unknown> | undefined;

describe("TC-MERGE-033 output bounds", () => {
  test("a sixty-gate success keeps the machine data bounded and marks omitted gates", async () => {
    const entries = [...MERGE_DEFAULT_GATE_ENTRIES, ...customGates(55)];
    const raw = { schemaVersion: "delivery.merge.gates.v1", entries };
    const set = resolveMergeGateSet(raw);
    if (!set.ok) throw new Error(set.failure.detail);
    const make = () => {
      const harness = createMergeHarness({
        gateSet: raw,
        checkRuns: {
          items: [...baseCheckRuns().items, ...runsFor(entries)],
          pageItemCount: 2 + runsFor(entries).length,
          sha: MERGE_HEAD,
        },
      });
      harness.seedVerification(
        verificationFor(set.value, {
          verifiedAt: isoAt(-2 * MINUTE),
          gates: set.value.ids.map((id) => ({
            id,
            verdict: "pass" as const,
            reason: id.startsWith("declared-gate") ? "ci-green" : "read-failed",
            citation: {
              sources: [],
              identity: { changeRef: "GH-301" },
              counts: [],
              names: [],
              reasons: [],
            },
          })),
        }),
      );
      return harness;
    };
    const first = make();
    try {
      const json = await first.run();
      expect(json.exitCode).toBe(0);
      const data = dataOf(json);
      expect(((data?.gates ?? []) as readonly unknown[]).length).toBe(MERGE_MAX_REPORT_GATES);
      expect(data?.gatesOmitted).toBe(set.value.ids.length - MERGE_MAX_REPORT_GATES);
      expect(Buffer.byteLength(JSON.stringify(data), "utf8")).toBeLessThanOrEqual(
        MERGE_MAX_MACHINE_BYTES,
      );
    } finally {
      first.cleanup();
    }
    const second = make();
    try {
      const text = await second.run(undefined, { json: false });
      expect(text.stdout).toContain(
        `gates-omitted=+${set.value.ids.length - MERGE_MAX_REPORT_GATES}`,
      );
      expect(text.stdout.trimEnd().split("\n").length).toBeLessThanOrEqual(MERGE_MAX_HUMAN_LINES);
      expect(Buffer.byteLength(text.stdout, "utf8")).toBeLessThanOrEqual(MERGE_MAX_HUMAN_BYTES);
    } finally {
      second.cleanup();
    }
  });

  test("the under-cap control carries no omission mark", async () => {
    const defaultSet = resolveMergeGateSet(undefined);
    if (!defaultSet.ok) throw new Error(defaultSet.failure.detail);
    const harness = createMergeHarness();
    try {
      harness.seedVerification(
        verificationFor(defaultSet.value, { verifiedAt: isoAt(-2 * MINUTE) }),
      );
      const text = await harness.run(undefined, { json: false });
      expect(text.stdout).not.toContain("gates-omitted=");
    } finally {
      harness.cleanup();
    }
  });

  test("many conflicting paths are capped with an explicit +N mark", async () => {
    const paths = Array.from(
      { length: 12 },
      (_, index) => `packages/core/src/conflict-${index}.ts`,
    );
    const git = createFakeGit({
      refresh: { outcome: "conflicted", paths },
    });
    const harness = createMergeHarness({
      git,
      request: baseRequest({ mergeableState: "conflicting" }),
    });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      const result = await harness.run(undefined, { json: false });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(`+${paths.length - MERGE_MAX_CONFLICT_PATHS}`);
      const summary = result.stderr.split("summary: ")[1] ?? "";
      expect(summary.split("\n").length).toBeLessThanOrEqual(MERGE_MAX_HUMAN_LINES);
      expect(Buffer.byteLength(summary, "utf8")).toBeLessThanOrEqual(MERGE_MAX_HUMAN_BYTES);
      expect(summary).toContain("conflicting-paths=");
    } finally {
      harness.cleanup();
    }
  });
});
