/**
 * TC-DPLAN-020 and TC-DPLAN-021 — the additive lint plan target reports
 * conformance with locations (exit 1), classifies an unreadable document
 * distinctly (exit 2), and leaves the pm-notes/registry targets unchanged.
 */
import { describe, expect, test } from "bun:test";
import {
  emptyRegistry,
  runLint,
  runtimeForFixture,
} from "./pm-notes-lint-command-support";
import {
  markdownFixture,
  planLintRuntime,
  planWorld,
} from "../fixtures/plan/harness/index";

describe("TC-DPLAN-020 lint plan conformance", () => {
  test("a conformant plan reports valid with no errors and exits 0", async () => {
    const world = planWorld({ "GH-306": "valid/baseline.yaml" });
    const run = await runLint(planLintRuntime(world), ["plan", "GH-306"]);
    expect(run.exitCode).toBe(0);
    const data = run.envelope?.data as {
      target: string;
      documents: readonly { path: string; verdict: string; errors: readonly unknown[] }[];
    };
    expect(data.target).toBe("plan");
    expect(data.documents).toHaveLength(1);
    expect(data.documents[0]?.path).toBe("chg-GH-306-plan.yaml");
    expect(data.documents[0]?.verdict).toBe("valid");
    expect(data.documents[0]?.errors).toEqual([]);
  });

  test("a non-conformant plan reports classified errors with locations and exits 1", async () => {
    const world = planWorld({ "GH-308": "invalid/phase-missing-scope.yaml" });
    const run = await runLint(planLintRuntime(world), ["plan", "GH-308"]);
    expect(run.exitCode).toBe(1);
    const data = run.envelope?.data as {
      documents: readonly {
        verdict: string;
        errors: readonly { code: string; location: { phase?: number; field: string } }[];
      }[];
    };
    expect(data.documents[0]?.verdict).toBe("invalid");
    const error = data.documents[0]?.errors.find((entry) => entry.location.phase === 6);
    expect(error?.code).toBe("plan.schema.invalid");
    expect(error?.location.field).toBe("scope.files");
  });

  test("a legacy markdown plan is non-conformant with the transition identity", async () => {
    const world = { artifacts: { "GH-307": [markdownFixture("GH-307", "legacy/prose.md")] } };
    const run = await runLint(planLintRuntime(world), ["plan", "GH-307"]);
    expect(run.exitCode).toBe(1);
    const data = run.envelope?.data as {
      documents: readonly { verdict: string; errors: readonly { code: string }[] }[];
    };
    expect(data.documents[0]?.verdict).toBe("invalid");
    expect(data.documents[0]?.errors[0]?.code).toBe("plan.format.legacy-markdown");
  });
});

describe("TC-DPLAN-021 lint plan unreadable", () => {
  test("an unreadable document exits 2 and is distinguished from non-conformance", async () => {
    const world = { artifacts: {}, unreadable: ["GH-310"] };
    const run = await runLint(planLintRuntime(world), ["plan", "GH-310"]);
    expect(run.exitCode).toBe(2);
    const data = run.envelope?.data as {
      documents: readonly { path: string; verdict: string; errors: readonly { code: string }[] }[];
    };
    expect(data.documents[0]?.path).toBe("chg-GH-310-plan.yaml");
    expect(data.documents[0]?.verdict).toBe("unreadable");
    expect(data.documents[0]?.errors[0]?.code).toBe("lint.document.unreadable");
    expect(run.stderr).not.toContain(" at ");
  });
});

describe("TC-DPLAN-020 additive lint surface", () => {
  test("the pm-notes target is unchanged and still exits 0", async () => {
    const fixture = runtimeForFixture("valid/full-complete.yaml");
    try {
      const run = await runLint(fixture.runtime, ["GH-179"]);
      expect(run.exitCode).toBe(0);
      expect((run.envelope?.data as { target: string }).target).toBe("pm-notes");
    } finally {
      fixture.cleanup();
    }
  });

  test("the registry target is unchanged and still exits 0", async () => {
    const fixture = runtimeForFixture("valid/full-complete.yaml", emptyRegistry);
    try {
      const run = await runLint(fixture.runtime, ["GH-179", "--registry"]);
      expect(run.exitCode).toBe(0);
      expect((run.envelope?.data as { target: string }).target).toBe("registry");
    } finally {
      fixture.cleanup();
    }
  });
});
