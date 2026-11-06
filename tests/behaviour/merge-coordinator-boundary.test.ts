/**
 * TC-MERGE-030 — the coordinator-only boundary: no daemon/dispatch module
 * composes the merge mutation surface, the merge command is the only landing
 * producer, and every invocation is audited with its claimed identity.
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
  sourceFiles(root).filter((file) => {
    const text = readFileSync(join(root, file), "utf8");
    return text.includes(needle);
  });

const boundaryViolations = (root: string): string[] => {
  const violations: string[] = [];
  const mergeImporters = importers(root, "commands/merge");
  for (const file of mergeImporters) {
    if (/daemon|dispatch|queue|watchdog|scheduler/i.test(file)) {
      violations.push(`${file} composes the merge mutation surface`);
    }
  }
  const landCallers = importers(root, ".squashLand(");
  for (const file of landCallers) {
    const allowed =
      file === "packages/adapters/src/git/merge.ts" ||
      file === "packages/cli/src/edge.ts" ||
      file === "packages/adapters/src/git/index.ts";
    if (!allowed) violations.push(`${file} calls the squash landing outside the composition`);
  }
  return violations;
};

describe("TC-MERGE-030 coordinator-only boundary", () => {
  test("no daemon or dispatch module imports the merge mutation surface", () => {
    expect(boundaryViolations(ROOT)).toEqual([]);
    const landingDefinition = importers(ROOT, "export const createGitMergeSeam");
    expect(landingDefinition).toEqual(["packages/adapters/src/git/merge.ts"]);
  });

  test("a daemon-to-merge fixture fails the boundary scan", () => {
    const temp = mkdtempSync(join(tmpdir(), "merge-boundary-"));
    try {
      mkdirSync(join(temp, "packages/daemon/src"), { recursive: true });
      writeFileSync(
        join(temp, "packages/daemon/src/dispatch.ts"),
        'import "../../cli/src/commands/merge.js";\n',
      );
      mkdirSync(join(temp, "packages/adapters/src/git"), { recursive: true });
      writeFileSync(
        join(temp, "packages/adapters/src/git/merge.ts"),
        "export const createGitMergeSeam = () => ({});\nawait seam.squashLand({});\n",
      );
      expect(boundaryViolations(temp).length).toBeGreaterThan(0);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  test("the CLI merge command is a positive landing control", async () => {
    const harness = createMergeHarness();
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      const result = await harness.run();
      expect(result.exitCode).toBe(0);
      expect(harness.events).toContain("git-squash-land");
    } finally {
      harness.cleanup();
    }
  });

  test("every invocation is audited with its claimed identity when present", async () => {
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
    const harness = createMergeHarness();
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      await harness.run();
      expect(harness.auditRecords[0]?.agentIdentity).toBeUndefined();
    } finally {
      harness.cleanup();
    }
  });

  test("a re-run produces a second record with a new runId", async () => {
    const harness = createMergeHarness({ checkRuns: baseCheckRuns() });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      await harness.run(undefined, { runId: "run-a" });
      await harness.run(undefined, { runId: "run-b" });
      expect(harness.auditRecords).toHaveLength(2);
      expect(harness.auditRecords.map((record) => record.runId)).toEqual(["run-a", "run-b"]);
    } finally {
      harness.cleanup();
    }
  });
});
