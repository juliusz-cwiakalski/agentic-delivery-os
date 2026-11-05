/**
 * TC-DPLAN-017, TC-DPLAN-018, TC-DPLAN-019 — declared-versus-actual
 * classification, fully-within success, wildcard resolution, and prefix
 * boundaries.
 */
import { describe, expect, test } from "bun:test";
import { computePlanDiff } from "../../packages/core/src/domain/plan-diff";
import { diffFixture, planDocumentFor } from "../fixtures/plan/harness/index";

const classify = (relative: string, ref: string) => {
  const fixture = diffFixture(relative);
  return computePlanDiff({
    workItemRef: ref,
    document: planDocumentFor(ref, `${relative}/plan.yaml`),
    actualPaths: fixture.paths,
    against: fixture.against,
  });
};

describe("TC-DPLAN-017 declared versus actual", () => {
  test("within, outside-declared, and undeclared-missing are distinguished", () => {
    const data = classify("diff/outside", "GH-308");
    expect(data.verdict).toBe("findings");
    const byPath = new Map(data.entries.map((entry) => [entry.path, entry]));
    expect(byPath.get("packages/core/src/contracts/queue.ts")).toEqual({
      path: "packages/core/src/contracts/queue.ts",
      classification: "within",
      phase: 1,
    });
    expect(byPath.get("packages/cli/src/commands/plan.ts")?.classification).toBe(
      "outside-declared",
    );
    const missing = byPath.get("doc/spec/features/feature-scheduler.md");
    expect(missing?.classification).toBe("undeclared-missing");
    expect(missing?.phase).toBe(1);
  });

  test("out-of-scope findings carry plan.scope.undeclared-paths", () => {
    const data = classify("diff/outside", "GH-308");
    const finding = data.findings.find(
      (entry) => entry.path === "packages/cli/src/commands/plan.ts",
    );
    expect(finding?.code).toBe("plan.scope.undeclared-paths");
    expect(finding?.classification).toBe("outside-declared");
    expect(
      data.findings.find((entry) => entry.classification === "undeclared-missing")?.phase,
    ).toBe(1);
  });

  test("each path appears exactly once and no path is dropped", () => {
    const data = classify("diff/outside", "GH-308");
    const paths = data.entries.map((entry) => entry.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toEqual([...paths].sort());
    expect(data.against).toBe("main-tools");
  });
});

describe("TC-DPLAN-018 fully within", () => {
  test("a conforming diff has no findings and verdict within", () => {
    const data = classify("diff/within", "GH-308");
    expect(data.verdict).toBe("within");
    expect(data.findings).toEqual([]);
    expect(data.entries.every((entry) => entry.classification === "within")).toBe(true);
  });

  test("the requested base is echoed unchanged", () => {
    const data = classify("diff/within", "GH-308");
    expect(data.against).toBe("release/1.0");
  });
});

describe("TC-DPLAN-019 wildcards and prefix boundaries", () => {
  test("package and folder scopes resolve; prefix-only siblings stay outside", () => {
    const data = classify("diff/wildcards", "GH-308");
    const byPath = new Map(data.entries.map((entry) => [entry.path, entry.classification]));
    expect(byPath.get("packages/core/src/domain/plan-diff.ts")).toBe("within");
    expect(byPath.get("doc/guides/lifecycle.md")).toBe("within");
    expect(byPath.get("doc/guides-archive/x.md")).toBe("outside-declared");
    expect(data.findings.map((entry) => entry.path)).toEqual(["doc/guides-archive/x.md"]);
  });
});
