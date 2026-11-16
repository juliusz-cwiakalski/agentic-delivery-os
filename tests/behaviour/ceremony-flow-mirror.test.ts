/**
 * TC-CEREMONY-016 (mirror-sync equality with `--apply`, then drift is
 * `unverified` naming the target), TC-CEREMONY-024 (a `sync` step without
 * `--apply` is a computed dry-run that lands nothing), and TC-CEREMONY-052
 * (target bound, undeclared target untouched, no force path).
 */
import { describe, expect, test } from "bun:test";
import { planCeremonyMirror } from "../../packages/core/src/domain/index";
import { MIRROR_TARGETS, prepareBuiltin, runPrepared } from "../fixtures/ceremony/builtins";

const mirrorReport = (harness: ReturnType<typeof prepareBuiltin>["harness"]) => {
  for (const content of harness.artifactContents.values()) {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (parsed.schemaId === "delivery.ceremony.mirror-report.v1") return parsed;
  }
  return undefined;
};

describe("TC-CEREMONY-024 a sync step without --apply is a dry-run", () => {
  test("the write set is computed and nothing lands", () => {
    const prepared = prepareBuiltin("decision-record-mirror-sync");
    try {
      const run = runPrepared(prepared);
      expect(run.ok).toBe(true);
      if (!run.ok) return;
      expect(run.data.verdict).toBe("dry-run");
      expect(prepared.harness.mirrorApplies).toEqual([]);
      const report = mirrorReport(prepared.harness);
      expect(report?.applied).toBe(false);
    } finally {
      prepared.harness.dispose();
    }
  });
});

describe("TC-CEREMONY-016 with --apply each target equals its register set", () => {
  test("two targets are verified equal and drift after the run is unverified naming the target", () => {
    const applied = prepareBuiltin("decision-record-mirror-sync", { apply: true });
    try {
      const run = runPrepared(applied);
      expect(run.ok).toBe(true);
      if (!run.ok) return;
      expect(run.data.verdict).toBe("verified");
      expect(applied.harness.mirrorApplies.map((entry) => entry.target)).toEqual([
        ...MIRROR_TARGETS,
      ]);
      const report = mirrorReport(applied.harness);
      const targets = report?.targets as { target: string; equal: boolean }[];
      expect(targets.every((target) => target.equal)).toBe(true);
    } finally {
      applied.harness.dispose();
    }

    const drifted = prepareBuiltin("decision-record-mirror-sync", {
      apply: true,
      mirrorDrift: true,
      mirrorApplyNoop: true,
    });
    try {
      const run = runPrepared(drifted);
      expect(run.ok).toBe(true);
      if (!run.ok) return;
      expect(run.data.verdict).toBe("unverified");
      const failed = run.data.steps.find((step) => step.outcome === "unverified");
      expect(failed?.reason).toContain(MIRROR_TARGETS[1]);
    } finally {
      drifted.harness.dispose();
    }
  });
});

describe("TC-CEREMONY-052 mirror safety: bound, declared targets, no force path", () => {
  test("more than eight declared targets is refused before any inspection", () => {
    const planned = planCeremonyMirror({
      targets: Array.from({ length: 9 }, (_, index) => `github.com/example/repo-${String(index)}`),
      sources: {},
      inspect: () => ({ state: "clean", mirrorSet: [], sourceSet: [] }),
      apply: false,
    });
    expect(planned.failure).toContain("bound is 8");
    expect(planned.targets).toEqual([]);
  });

  test("an undeclared repository is untouched and only declared targets are applied", () => {
    const prepared = prepareBuiltin("decision-record-mirror-sync", { apply: true });
    try {
      prepared.harness.mirrorTargets.set("github.com/example/undeclared", ["KEEP-ME"]);
      expect(runPrepared(prepared).ok).toBe(true);
      expect(prepared.harness.mirrorApplies.map((entry) => entry.target)).toEqual([
        ...MIRROR_TARGETS,
      ]);
      expect(prepared.harness.mirrorTargets.get("github.com/example/undeclared")).toEqual([
        "KEEP-ME",
      ]);
      expect(prepared.harness.mirrorTargets.has("github.com/example/other")).toBe(false);
    } finally {
      prepared.harness.dispose();
    }
  });

  test("a dirty or absent target yields unverified with the precondition named", () => {
    const planned = planCeremonyMirror({
      targets: ["github.com/example/dirty"],
      sources: { "github.com/example/dirty": ["ODR-1"] },
      inspect: () => ({ state: "dirty", mirrorSet: [], sourceSet: ["ODR-1"] }),
      apply: true,
      applyTarget: () => ({ ok: true }),
    });
    expect(planned.failure).toContain("precondition");
    expect(planned.targets[0]?.equal).toBe(false);
    expect(planned.targets[0]?.applied).toBe(false);
  });
});
