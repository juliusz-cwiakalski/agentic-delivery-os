/**
 * TC-MERGE-002 / TC-MERGE-003 / TC-MERGE-004 — a repo-declared gate is cited
 * and enforced without a source change; invalid declarations are classified
 * configuration failures with zero reads and mutations; surface applicability
 * splits the battery and merge surfaces.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MERGE_DEFAULT_GATE_ENTRIES,
  type MergeGateEntry,
  type PipelineRun,
} from "../../packages/core/src/contracts/index";
import {
  type MergeEffectiveGateSet,
  resolveMergeGateSet,
} from "../../packages/core/src/domain/merge-gate-set";
import { evaluateDeclaredBattery } from "../../packages/core/src/domain/verify-gates";
import {
  baseCheckRuns,
  createMergeHarness,
  declaredGateSetWith,
  MERGE_HEAD,
  MERGE_REF,
  verificationFor,
} from "../fixtures/merge/harness";
import {
  baseFacts,
  clone,
  EXPECTED_JOBS,
  run as verifyFixtureRun,
} from "../fixtures/verify-gates/cases/facts";
import { combinedRuntime, runVerify } from "../fixtures/verify-gates/cases/harness";

const GATE_SET_WITH_WORKSPACE = declaredGateSetWith([
  ...MERGE_DEFAULT_GATE_ENTRIES,
  { id: "workspace-tests", recipe: "required-ci-job", surface: "both", job: "workspace-tests" },
]);

const failingPage = (job: string): { items: PipelineRun[]; pageItemCount: number; sha: string } => {
  const base = baseCheckRuns();
  return {
    items: [
      ...base.items,
      {
        identity: { systemName: "github", entityId: "44899" },
        pipelineName: job,
        jobs: [{ jobName: job, jobState: "failed" }],
        traceEvidence: [],
      },
    ],
    pageItemCount: base.pageItemCount + 1,
    sha: MERGE_HEAD,
  };
};

const passingPage = (job: string): { items: PipelineRun[]; pageItemCount: number; sha: string } => {
  const base = baseCheckRuns();
  return {
    items: [
      ...base.items,
      {
        identity: { systemName: "github", entityId: "44899" },
        pipelineName: job,
        jobs: [{ jobName: job, jobState: "succeeded" }],
        traceEvidence: [],
      },
    ],
    pageItemCount: base.pageItemCount + 1,
    sha: MERGE_HEAD,
  };
};

const typeScriptFiles = (root: string): string[] => {
  const files: string[] = [];
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(root, relative), { withFileTypes: true })) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        if (["dist", "node_modules", "tmp"].includes(entry.name)) continue;
        walk(next);
      } else if (entry.name.endsWith(".ts")) files.push(next);
    }
  };
  walk("packages");
  return files;
};

const occurrencesOf = (root: string, literal: string): number => {
  let count = 0;
  for (const file of typeScriptFiles(root)) {
    count += readFileSync(join(root, file), "utf8").split(literal).length - 1;
  }
  return count;
};

describe("TC-MERGE-002 a repo-declared gate is enforced without a source change", () => {
  test("verify gates cites the declared gate like a built-in", async () => {
    const resolved = resolveMergeGateSet(GATE_SET_WITH_WORKSPACE);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const facts = clone(baseFacts());
    facts.checkRuns = {
      ok: true,
      value: {
        items: [
          ...EXPECTED_JOBS.map((name) => verifyFixtureRun(name, "succeeded")),
          verifyFixtureRun("workspace-tests", "failed"),
        ],
        pageItemCount: EXPECTED_JOBS.length + 1,
      },
    };
    const result = await runVerify(
      combinedRuntime({
        facts,
        gateSet: () => ({ ok: true, value: resolved.value }),
      }),
      ["gates", "GH-178"],
    );
    expect(result.exitCode).toBe(1);
    const data = result.envelope?.data as { gates?: readonly { id: string }[] } | undefined;
    if (data?.gates !== undefined) {
      expect(data.gates.map((gate) => gate.id)).toContain("workspace-tests");
    } else {
      const summary = (result.envelope?.error as { summary?: string } | undefined)?.summary ?? "";
      expect(summary).toContain("workspace-tests");
    }
  });

  test("failing the declared gate refuses the merge with the standard gate shape", async () => {
    const resolved = resolveMergeGateSet(GATE_SET_WITH_WORKSPACE);
    if (!resolved.ok) throw new Error("fixture invalid");
    const harness = createMergeHarness({
      gateSet: GATE_SET_WITH_WORKSPACE,
      checkRuns: failingPage("workspace-tests"),
      ownerPrincipal: "owner-principal",
    });
    try {
      harness.seedVerification(verificationFor(resolved.value));
      const result = await harness.run();
      expect(result.exitCode).toBe(1);
      const error = result.envelope?.error as Record<string, unknown> | undefined;
      expect(error?.code).toBe("merge.gate.workspace-tests.failed");
      expect(String(error?.summary)).toContain("workspace-tests");
      expect(String(error?.summary)).toContain("remediation=");
      // Durable delta: nothing landed, nothing recorded.
      expect(harness.transactions()).toHaveLength(0);
      expect(harness.waivers()).toHaveLength(0);
      expect(harness.counts.checkRuns).toBe(1);
    } finally {
      harness.cleanup();
    }
  });

  test("restored control: the declared job passes and the merge lands", async () => {
    const resolved = resolveMergeGateSet(GATE_SET_WITH_WORKSPACE);
    if (!resolved.ok) throw new Error("fixture invalid");
    const harness = createMergeHarness({
      gateSet: GATE_SET_WITH_WORKSPACE,
      checkRuns: passingPage("workspace-tests"),
      ownerPrincipal: "owner-principal",
    });
    try {
      harness.seedVerification(verificationFor(resolved.value));
      const result = await harness.run();
      expect(result.exitCode).toBe(0);
      expect((result.envelope?.data as { result?: string } | undefined)?.result).toBe("merged");
    } finally {
      harness.cleanup();
    }
  });

  test("no production source names the declared gate id; a hard-coded control is detected", () => {
    const root = process.cwd();
    expect(occurrencesOf(root, "workspace-tests")).toBe(0);
    const temp = mkdtempSync(join(tmpdir(), "merge-source-scan-"));
    try {
      mkdirSync(join(temp, "packages/core/src"), { recursive: true });
      writeFileSync(
        join(temp, "packages/core/src/hard-coded.ts"),
        'export const gate = "workspace-tests";\n',
      );
      expect(occurrencesOf(temp, "workspace-tests")).toBeGreaterThan(0);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
});

describe("TC-MERGE-003 invalid declared sets are classified configuration failures", () => {
  const validEntries = [...MERGE_DEFAULT_GATE_ENTRIES] as MergeGateEntry[];

  test("an omitted built-in is refused naming the entry", () => {
    const resolved = resolveMergeGateSet(
      declaredGateSetWith(validEntries.filter((entry) => entry.id !== "ci-green")),
    );
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved.failure.detail).toContain("ci-green");
  });

  test("a reserved built-in id with a different recipe or surface is refused", () => {
    const resolved = resolveMergeGateSet(
      declaredGateSetWith(
        validEntries.map((entry) =>
          entry.id === "ci-green" ? { ...entry, surface: "merge" as const } : entry,
        ),
      ),
    );
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved.failure.detail).toContain("ci-green");
  });

  test("an unsupported schema version is refused", () => {
    const resolved = resolveMergeGateSet({
      schemaVersion: "delivery.merge.gates.v2",
      entries: validEntries,
    });
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved.failure.detail).toContain("schema version");
  });

  test("malformed entries are refused: unknown recipe, empty id, duplicate id, extra field", () => {
    for (const entries of [
      validEntries.map((entry) =>
        entry.id === "ci-green" ? { ...entry, recipe: "nope" as never } : entry,
      ),
      [
        ...validEntries,
        { id: "", recipe: "required-ci-job", surface: "both", job: "x" } as MergeGateEntry,
      ],
      [...validEntries, validEntries[0] as MergeGateEntry],
      [
        ...validEntries,
        {
          id: "x-gate",
          recipe: "required-ci-job",
          surface: "both",
          job: "x",
          extra: true,
        } as unknown as MergeGateEntry,
      ],
    ]) {
      const resolved = resolveMergeGateSet(declaredGateSetWith(entries));
      expect(resolved.ok).toBe(false);
    }
  });

  test("a config failure is classified with zero reads, appends, and mutations", async () => {
    const harness = createMergeHarness({
      configFailure: { code: "config.value.invalid", detail: 'declared set omits "ci-green"' },
    });
    try {
      const result = await harness.run();
      expect(result.exitCode).toBe(1);
      expect((result.envelope?.error as Record<string, unknown> | undefined)?.code).toBe(
        "config.value.invalid",
      );
      expect(harness.counts.order).toEqual([]);
      expect(harness.verifications()).toHaveLength(0);
      expect(harness.transactions()).toHaveLength(0);
      const dryRun = await harness.run([MERGE_REF, "--dry-run"]);
      expect(dryRun.exitCode).toBe(1);
      expect(harness.counts.order).toEqual([]);
    } finally {
      harness.cleanup();
    }
  });

  test("the paired valid declaration resolves and cites every entry", () => {
    const resolved = resolveMergeGateSet(declaredGateSetWith(validEntries));
    expect(resolved.ok).toBe(true);
    if (resolved.ok) expect(resolved.value.ids).toHaveLength(validEntries.length);
  });
});

describe("TC-MERGE-004 surface applicability", () => {
  const set = declaredGateSetWith([
    ...MERGE_DEFAULT_GATE_ENTRIES,
    { id: "docs-links", recipe: "required-ci-job", surface: "battery", job: "docs-links" },
    { id: "workspace-tests", recipe: "required-ci-job", surface: "both", job: "workspace-tests" },
  ]);

  test("the battery projection evaluates battery and both entries, never merge-only", () => {
    const resolved = resolveMergeGateSet(set);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const ids = resolved.value.batteryEntries.map((entry) => entry.id);
    expect(ids).toContain("docs-links");
    expect(ids).toContain("workspace-tests");
    expect(ids).not.toContain("tracker-freshness");
    expect(resolved.value.mergeEntries.map((entry) => entry.id)).toEqual([
      "tracker-freshness",
      "workspace-tests",
    ]);
    expect(resolved.value.enforcedMergeEntries.map((entry) => entry.id)).not.toContain(
      "docs-links",
    );
  });

  test("a failing battery-only gate refuses verify gates but not the merge", async () => {
    const resolved = resolveMergeGateSet(set);
    if (!resolved.ok) throw new Error("fixture invalid");
    const facts = clone(baseFacts());
    facts.checkRuns = {
      ok: true,
      value: {
        items: [
          ...EXPECTED_JOBS.map((name) => verifyFixtureRun(name, "succeeded")),
          verifyFixtureRun("docs-links", "failed"),
          verifyFixtureRun("workspace-tests", "succeeded"),
        ],
        pageItemCount: EXPECTED_JOBS.length + 2,
      },
    };
    const battery = evaluateDeclaredBattery(facts, resolved.value.batteryEntries);
    expect(battery.gates.find((gate) => gate.id === "docs-links")?.verdict).toBe("fail");
    const mergeHarness = createMergeHarness({
      gateSet: set,
      checkRuns: {
        items: [
          ...baseCheckRuns().items,
          {
            identity: { systemName: "github", entityId: "44899" },
            pipelineName: "docs-links",
            jobs: [{ jobName: "docs-links", jobState: "failed" }],
            traceEvidence: [],
          },
          {
            identity: { systemName: "github", entityId: "44900" },
            pipelineName: "workspace-tests",
            jobs: [{ jobName: "workspace-tests", jobState: "succeeded" }],
            traceEvidence: [],
          },
        ],
        pageItemCount: 4,
        sha: MERGE_HEAD,
      },
    });
    try {
      mergeHarness.seedVerification(verificationFor(resolved.value));
      const result = await mergeHarness.run();
      expect(result.exitCode).toBe(0);
      expect((result.envelope?.data as { result?: string } | undefined)?.result).toBe("merged");
    } finally {
      mergeHarness.cleanup();
    }
  });

  test("the default declaration yields the shipped five battery entries plus tracker-freshness", () => {
    const resolved = resolveMergeGateSet(undefined);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.value.batteryEntries.map((entry) => entry.id)).toEqual([
      "lifecycle-finalization",
      "ci-green",
      "push-parity",
      "owner-gate",
      "squash-preflight",
    ]);
    expect(resolved.value.mergeEntries.map((entry) => entry.id)).toEqual(["tracker-freshness"]);
  });

  test("moving tracker-freshness to both makes it battery-visible", () => {
    const resolved = resolveMergeGateSet(
      declaredGateSetWith(
        MERGE_DEFAULT_GATE_ENTRIES.map((entry) =>
          entry.id === "tracker-freshness" ? { ...entry, surface: "both" as const } : entry,
        ),
      ),
    );
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.value.batteryEntries.map((entry) => entry.id)).toContain("tracker-freshness");
    }
  });
});
