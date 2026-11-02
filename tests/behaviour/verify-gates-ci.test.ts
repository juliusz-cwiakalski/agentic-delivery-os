/** TC-VGATES-018..027, 061, 067, 068, 070 — CI gate rules and counts. */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readCiWorkflowJobNames } from "../../packages/adapters/src/file/ci-workflow";
import type { PipelineRun } from "../../packages/core/src/contracts/index";
import { evaluateVerifyGates } from "../../packages/core/src/domain/index";
import {
  baseFacts,
  clone,
  EXPECTED_JOBS,
  request,
  run,
  withReadError,
} from "../fixtures/verify-gates/cases/facts";

const ci = (facts: ReturnType<typeof baseFacts>) => evaluateVerifyGates(facts).gates[1];

const countOf = (record: ReturnType<typeof ci>, name: string): number | undefined =>
  record.citation.counts.find((entry) => entry.name === name)?.value;

const namesOf = (record: ReturnType<typeof ci>, kind: string): readonly string[] =>
  record.citation.names.find((entry) => entry.kind === kind)?.values ?? [];

const withRuns = (runs: readonly PipelineRun[], pageItemCount = runs.length) => {
  const facts = clone(baseFacts());
  facts.checkRuns = { ok: true, value: { items: runs, pageItemCount } };
  return facts;
};

const greenRuns = (): PipelineRun[] => EXPECTED_JOBS.map((name) => run(name, "succeeded"));

describe("TC-VGATES-018/019 green and red", () => {
  test("all expected jobs succeeded passes with exact counts", () => {
    const record = ci(baseFacts());
    expect(record.verdict).toBe("pass");
    expect(record.reason).toBe("ci-green");
    expect(countOf(record, "expected")).toBe(23);
    expect(countOf(record, "runs")).toBe(23);
    expect(countOf(record, "succeeded")).toBe(23);
    expect(countOf(record, "missing")).toBe(0);
    expect(record.citation.sources.map((source) => source.name)).toEqual([
      "repository-ci-workflow",
      "github-delivery-request-detail",
      "github-check-runs",
    ]);
  });

  test("one red run fails ci-failed and cites the job and counts", () => {
    const runs = greenRuns().map((entry) =>
      entry.pipelineName === EXPECTED_JOBS[3] ? run(entry.pipelineName, "failed") : entry,
    );
    const record = ci(withRuns(runs));
    expect(record.verdict).toBe("fail");
    expect(record.reason).toBe("ci-failed");
    expect(namesOf(record, "failed-jobs")).toEqual([EXPECTED_JOBS[3] as string]);
    expect(countOf(record, "failed")).toBe(1);
    expect(countOf(record, "succeeded")).toBe(22);
    expect(countOf(record, "runs")).toBe(23);
  });
});

describe("TC-VGATES-020..022 missing, zero-run, and all-skipped", () => {
  test("a missing expected job fails ci-missing-jobs in expected order", () => {
    const runs = greenRuns().filter((entry) => entry.pipelineName !== EXPECTED_JOBS[10]);
    const record = ci(withRuns(runs));
    expect(record.verdict).toBe("fail");
    expect(record.reason).toBe("ci-missing-jobs");
    expect(namesOf(record, "missing-jobs")).toEqual([EXPECTED_JOBS[10] as string]);
    expect(countOf(record, "missing")).toBe(1);
  });

  test("many missing jobs are bounded to eight with an omitted count", () => {
    const runs = greenRuns().filter((entry) => EXPECTED_JOBS.slice(9).includes(entry.pipelineName));
    const record = ci(withRuns(runs));
    const list = record.citation.names.find((entry) => entry.kind === "missing-jobs");
    expect(list?.values).toHaveLength(8);
    expect(list?.omitted).toBe(1);
  });

  test("zero runs fails ci-no-runs", () => {
    const record = ci(withRuns([]));
    expect(record.verdict).toBe("fail");
    expect(record.reason).toBe("ci-no-runs");
    expect(countOf(record, "runs")).toBe(0);
  });

  test("TC-VGATES-070 non-finite page sizes never serialize a non-integer count", () => {
    for (const pageItemCount of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const record = ci(withRuns(greenRuns(), pageItemCount));
      for (const entry of record.citation.counts) {
        expect(Number.isInteger(entry.value)).toBe(true);
      }
      expect(record.reason).toBe("ci-truncated");
      expect(record.verdict).toBe("unknown");
    }
  });

  test("all-skipped fails even with an extra non-expected success", () => {
    const facts = withRuns([
      ...EXPECTED_JOBS.map((name) => run(name, "skipped")),
      run("extra-not-expected", "succeeded"),
    ]);
    const record = ci(facts);
    expect(record.verdict).toBe("fail");
    expect(record.reason).toBe("ci-all-skipped");
    expect(countOf(record, "runs")).toBe(24);
    expect(countOf(record, "skipped")).toBe(23);
    expect(countOf(record, "succeeded")).toBe(1);
  });

  test("one expected success removes all-skipped", () => {
    const facts = withRuns([
      run(EXPECTED_JOBS[0] as string, "succeeded"),
      ...EXPECTED_JOBS.slice(1).map((name) => run(name, "skipped")),
    ]);
    const record = ci(facts);
    expect(record.reason).not.toBe("ci-all-skipped");
    expect(record.verdict).toBe("pass");
  });
});

describe("TC-VGATES-023/024 pending, canceled, and truncation", () => {
  test("running and queued fail ci-pending; canceled fails ci-canceled", () => {
    const running = greenRuns().map((entry) =>
      entry.pipelineName === EXPECTED_JOBS[0] ? run(entry.pipelineName, "running") : entry,
    );
    expect(ci(withRuns(running)).reason).toBe("ci-pending");
    const queued = greenRuns().map((entry) =>
      entry.pipelineName === EXPECTED_JOBS[0] ? run(entry.pipelineName, "queued") : entry,
    );
    expect(ci(withRuns(queued)).reason).toBe("ci-pending");
    const canceled = greenRuns().map((entry) =>
      entry.pipelineName === EXPECTED_JOBS[0] ? run(entry.pipelineName, "canceled") : entry,
    );
    expect(ci(withRuns(canceled)).reason).toBe("ci-canceled");
  });

  test("a page at 100 runs is unknown ci-truncated even with a failure", () => {
    const runs = [
      ...greenRuns(),
      ...Array.from({ length: 76 }, (_, index) => run(`extra-${index}`, "succeeded")),
      run("extra-failed", "failed"),
    ];
    expect(runs).toHaveLength(100);
    const record = ci(withRuns(runs, 100));
    expect(record.verdict).toBe("unknown");
    expect(record.reason).toBe("ci-truncated");
  });
});

describe("TC-VGATES-025/026 expected-set validation and comparison", () => {
  test("every invalid expected set fails ci-expected-jobs-invalid", () => {
    const variants = [
      { outcome: "absent" as const, names: [] },
      { outcome: "failed" as const, names: [] },
      { outcome: "read" as const, names: [] },
      { outcome: "read" as const, names: ["a", "a"] },
      { outcome: "read" as const, names: ["x".repeat(121)] },
      { outcome: "read" as const, names: Array.from({ length: 201 }, (_, index) => `j-${index}`) },
    ];
    for (const workflow of variants) {
      const facts = clone(baseFacts());
      facts.workflow = workflow;
      const record = ci(facts);
      expect(record.verdict).toBe("fail");
      expect(record.reason).toBe("ci-expected-jobs-invalid");
    }
  });

  test("extra green runs do not fail; duplicate names use the worst state", () => {
    const extra = ci(withRuns([...greenRuns(), run("extra-green", "succeeded")]));
    expect(extra.verdict).toBe("pass");
    expect(countOf(extra, "runs")).toBe(24);
    const duplicate = ci(
      withRuns([
        ...greenRuns().filter((entry) => entry.pipelineName !== EXPECTED_JOBS[0]),
        run(EXPECTED_JOBS[0] as string, "succeeded"),
        run(EXPECTED_JOBS[0] as string, "failed"),
      ]),
    );
    expect(duplicate.reason).toBe("ci-failed");
    expect(namesOf(duplicate, "failed-jobs")).toContain(EXPECTED_JOBS[0] as string);
  });
});

describe("TC-VGATES-027 head unresolved and read-specific 404s", () => {
  test("an absent head SHA fails head-unresolved without a check-run read", () => {
    const facts = clone(baseFacts());
    facts.deliveryRequestDetail = {
      ok: true,
      value: { request: request({ sourceHeadSha: undefined }) },
    };
    facts.checkRuns = { ok: false, reason: "not-attempted" };
    const record = ci(facts);
    expect(record.verdict).toBe("fail");
    expect(record.reason).toBe("head-unresolved");
    expect(record.citation.sources[2]?.outcome).toBe("not-attempted");
  });

  test("a matched detail 404 is fail head-unresolved with source absent", () => {
    const facts = clone(baseFacts());
    facts.deliveryRequestDetail = { ok: false, reason: "not-found" };
    facts.checkRuns = { ok: false, reason: "not-attempted" };
    const record = ci(facts);
    expect(record.verdict).toBe("fail");
    expect(record.reason).toBe("head-unresolved");
    expect(record.citation.sources[1]).toMatchObject({
      outcome: "absent",
      failureClass: "provider.not-found",
    });
  });

  test("a check-run 404 is unknown read-failed with source absent", () => {
    const facts = clone(baseFacts());
    facts.checkRuns = { ok: false, reason: "not-found" };
    const record = ci(facts);
    expect(record.verdict).toBe("unknown");
    expect(record.reason).toBe("read-failed");
    expect(record.citation.sources[2]).toMatchObject({
      outcome: "absent",
      failureClass: "provider.not-found",
    });
  });

  test("non-404 failures stay unknown with the declared reason", () => {
    for (const reason of ["read-failed", "credential-unavailable", "address-unresolved"] as const) {
      const facts = clone(baseFacts());
      facts.checkRuns = withReadError(reason);
      const record = ci(facts);
      expect(record.verdict).toBe("unknown");
      expect(record.reason).toBe(reason);
    }
  });

  test("TC-VGATES-070 counts use declared denominators and an unrecognized state fails", () => {
    const unrecognized = greenRuns().map((entry) =>
      entry.pipelineName === EXPECTED_JOBS[0]
        ? { ...entry, jobs: [{ jobName: entry.pipelineName, jobState: "mystery" as never }] }
        : entry,
    );
    const record = ci(withRuns(unrecognized));
    expect(record.verdict).toBe("fail");
    expect(record.reason).toBe("ci-failed");
    expect(countOf(record, "expected")).toBe(23);
    expect(countOf(record, "runs")).toBe(23);
    expect(
      (countOf(record, "succeeded") ?? 0) +
        (countOf(record, "failed") ?? 0) +
        (countOf(record, "pending") ?? 0) +
        (countOf(record, "skipped") ?? 0) +
        (countOf(record, "canceled") ?? 0),
    ).toBe(22);
  });
});
describe("TC-VGATES-025/026 workflow extraction and validation", () => {
  const definitions = {
    exists: () => true,
    readText: (path: string) => {
      const name = path.slice(path.lastIndexOf("/") + 1);
      return readFileSync(
        join(process.cwd(), "tests/fixtures/verify-gates/workflows", name),
        "utf8",
      );
    },
  };

  test("the valid workflow yields 23 names in declaration order", () => {
    const result = readCiWorkflowJobNames({
      baseDirectory: "/wf",
      fs: definitions,
      path: "valid-23-job.yml",
    });
    expect(result.outcome).toBe("read");
    expect(result.names).toHaveLength(23);
    expect(result.names[0]).toBe("job-01");
    expect(result.names[22]).toBe("job-23");
  });

  test("absent, malformed, empty, duplicate, over-cap, over-long, and over-bytes are rejected", () => {
    const absent = readCiWorkflowJobNames({
      baseDirectory: "/wf",
      fs: { exists: () => false, readText: () => "" },
      path: "valid-23-job.yml",
    });
    expect(absent.outcome).toBe("absent");
    for (const [file, expectedOutcome] of [
      ["malformed.txt", "failed"],
      ["empty-jobs.yml", "read"],
      ["duplicate-names.yml", "read"],
      ["over-cap.yml", "read"],
      ["over-long.yml", "read"],
      ["over-bytes.yml", "failed"],
    ] as const) {
      const result = readCiWorkflowJobNames({ baseDirectory: "/wf", fs: definitions, path: file });
      expect(result.outcome, file).toBe(expectedOutcome);
      if (expectedOutcome === "read") {
        const facts = clone(baseFacts());
        facts.workflow = { outcome: "read", names: result.names };
        expect(ci(facts).reason, file).toBe("ci-expected-jobs-invalid");
      }
    }
  });
});
