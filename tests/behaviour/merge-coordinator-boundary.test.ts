/**
 * TC-F1-008 / TC-F1-009 / TC-F2-008 (suite obligation) — the coordinator-only
 * boundary, inverted: the local landing and local refresh have zero composed
 * callers, the merge command is the only landing producer, and a declared
 * adapter landing gap refuses the delivered clean pre-mutation abort with no
 * landing attempt and no local fallback. Every invocation is still audited with
 * its claimed identity.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  baseCheckRuns,
  createMergeHarness,
  MERGE_CLOCK_MS,
  verificationRecord,
} from "../fixtures/merge/harness";

const ROOT = process.cwd();
const MINUTE = 60_000;
const isoAt = (offsetMs: number): string => new Date(MERGE_CLOCK_MS + offsetMs).toISOString();

const errorOf = (run: { envelope?: Record<string, unknown> }) =>
  run.envelope?.error as Record<string, unknown> | undefined;

const sourceFiles = (root: string): string[] => {
  const files: string[] = [];
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(root, relative), { withFileTypes: true })) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        if (["dist", "node_modules", "tmp", "doc", "tests"].includes(entry.name)) continue;
        walk(next);
      } else if (entry.name.endsWith(".ts")) files.push(next);
    }
  };
  walk("packages");
  return files;
};

const importers = (root: string, needle: string): string[] =>
  sourceFiles(root).filter((file) => readFileSync(join(root, file), "utf8").includes(needle));

const boundaryViolations = (root: string): string[] => {
  const violations: string[] = [];
  for (const file of importers(root, "commands/merge")) {
    if (/daemon|dispatch|queue|watchdog|scheduler/iu.test(file)) {
      violations.push(`${file} composes the merge mutation surface`);
    }
  }
  // The retained local capabilities must have zero composed callers anywhere in
  // the product packages: a landing is the provider-side operation only.
  for (const file of sourceFiles(root)) {
    const lines = readFileSync(join(root, file), "utf8").split("\n");
    lines.forEach((line, index) => {
      if (/\.(squashLand|refresh)\(/u.test(line)) {
        violations.push(`${file}:${index + 1} calls the local landing or refresh`);
      }
    });
  }
  return violations;
};

describe("TC-F1-009 zero composed callers of the retained local capabilities", () => {
  test("no product module composes the local landing or refresh and no daemon composes merge", () => {
    expect(boundaryViolations(ROOT)).toEqual([]);
    expect(importers(ROOT, "export const createGitMergeSeam")).toEqual([
      "packages/adapters/src/git/merge.ts",
    ]);
  });

  test("the mandatory failing control is found by file and line", () => {
    const temp = mkdtempSync(join(tmpdir(), "merge-boundary-"));
    try {
      mkdirSync(join(temp, "packages/daemon/src"), { recursive: true });
      writeFileSync(
        join(temp, "packages/daemon/src/dispatch.ts"),
        'import "../../cli/src/commands/merge.js";\n',
      );
      mkdirSync(join(temp, "packages/cli/src"), { recursive: true });
      writeFileSync(
        join(temp, "packages/cli/src/composition.ts"),
        "await seam.squashLand({ branch, baseRef, message });\n",
      );
      const violations = boundaryViolations(temp);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.join("\n")).toContain("packages/cli/src/composition.ts:1");
      expect(violations.join("\n")).toContain("composes the merge mutation surface");
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  test("the CLI merge command is a positive provider-landing control", async () => {
    const harness = createMergeHarness();
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      const result = await harness.run();
      expect(result.exitCode).toBe(0);
      expect(harness.counts.landing).toBe(1);
      expect(harness.events).not.toContain("git-squash-land");
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-F1-008 a declared landing gap refuses without an attempt", () => {
  for (const gap of ["adapter-not-implemented", "provider-unsupported"] as const) {
    test(`${gap}: exit 1, the operation and its reason named, zero attempts, zero fallback`, async () => {
      const harness = createMergeHarness({ landingGap: gap });
      try {
        harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
        const result = await harness.run();
        expect(result.exitCode).toBe(1);
        expect(errorOf(result)?.code).toBe("merge.transaction-aborted");
        const summary = String(errorOf(result)?.summary);
        expect(summary).toContain("merge-delivery-request");
        expect(summary).toContain(gap);
        // Zero attempts: the landing port is never called and no local
        // mechanism runs (no squash, no refresh).
        expect(harness.counts.landing).toBe(0);
        expect(harness.events).not.toContain("git-squash-land");
        expect(harness.events).not.toContain("git-rebase-refresh");
        expect(harness.transactions()).toHaveLength(0);
      } finally {
        harness.cleanup();
      }
    });
  }

  test("control: a silent local fallback would be visible as a landing or squash event", async () => {
    const harness = createMergeHarness({ landingGap: "adapter-not-implemented" });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      await harness.run();
      // Only the head read happened: no landing call and no local mutation.
      expect(harness.events).toEqual(["git-read-head"]);
      expect(harness.counts.landing).toBe(0);
      // A third identity would move the declared merge row count, so the refusal
      // cannot be a new `merge.landing-gap` row.
      expect(errorOf(await harness.run())?.code).toBe("merge.transaction-aborted");
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-MERGE-030 every invocation is audited with its claimed identity", () => {
  test("the audit record carries the identity, exit, and timing", async () => {
    const harness = createMergeHarness({
      auditIdentity: { kind: "claimed", value: "coordinator@example" },
    });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      await harness.run();
      const refusal = await harness.run([harness.ref, "--dry-run", "--waive", "owner-gate"]);
      expect(refusal.exitCode).toBe(1);
      expect(harness.auditRecords).toHaveLength(2);
      for (const record of harness.auditRecords) {
        expect(record.runId).toBeDefined();
        expect(record.command).toBeDefined();
        expect(record.arguments).toBeDefined();
        expect(record.exitCode).toBeDefined();
        expect(record.timing).toBeDefined();
        expect(record.agentIdentity).toEqual({ kind: "claimed", value: "coordinator@example" });
      }
      expect((harness.auditRecords[1] as { exitCode?: number }).exitCode).toBe(1);
    } finally {
      harness.cleanup();
    }
  });

  test("identity is absent, never inferred, when not supplied", async () => {
    const harness = createMergeHarness({ checkRuns: baseCheckRuns() });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      await harness.run();
      expect(harness.auditRecords[0]?.agentIdentity).toBeUndefined();
    } finally {
      harness.cleanup();
    }
  });
});
