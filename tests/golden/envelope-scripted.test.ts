/**
 * TC-GH223-014..TC-GH223-018 (scripted goldens), TC-GH223-020 (both-mode golden
 * coverage with no skip path) — the scripted projection is byte-bound.
 */
import { describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertScriptedProjection,
  loadGoldenCases,
} from "../../packages/testkit/src/result-conformance";
import { GOLDEN_ROOT, hasStackLeak, isSingleJsonDocument, runCase } from "./helpers";

const cases = await loadGoldenCases(GOLDEN_ROOT);
const scripted = cases.filter((entry) => (entry.injected.mode ?? "interactive") === "scripted");
const interactive = cases.filter(
  (entry) => (entry.injected.mode ?? "interactive") === "interactive",
);
const byId = (id: string) => {
  const found = scripted.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`scripted golden missing: ${id}`);
  return found;
};

describe("TC-GH223-020 both modes are represented", () => {
  test("interactive and scripted cases both exist with required scripted coverage", () => {
    expect(interactive.length).toBeGreaterThanOrEqual(11);
    const required = [
      "scripted-success-data",
      "scripted-success-void",
      "scripted-classified-user",
      "scripted-classified-platform",
      "scripted-unknown-failure",
      "scripted-broken-unknown-command",
      "scripted-broken-unknown-flag",
      "scripted-broken-missing-value",
      "scripted-broken-conflicting-flags",
    ];
    for (const id of required) expect(scripted.map((entry) => entry.id)).toContain(id);
    for (const testCase of scripted) {
      expect(["success", "classified-failure", "unknown-failure", "broken-invocation"]).toContain(
        testCase.meta.outcome,
      );
    }
  });

  test("a missing golden fails discovery loudly (no skip path)", async () => {
    const root = mkdtempSync(join(tmpdir(), "golden-missing-"));
    try {
      cpSync(GOLDEN_ROOT, root, { recursive: true });
      unlinkSync(join(root, "scripted-success-data", "stdout.json"));
      await expect(loadGoldenCases(root)).rejects.toThrow(/golden file is missing/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("TC-GH223-014/015 scripted success and void", () => {
  for (const id of ["scripted-success-data", "scripted-success-void"]) {
    test(`${id} is one minified data line without trimmed context`, async () => {
      const testCase = byId(id);
      const run = await runCase(testCase);
      expect(run.exitCode).toBe(0);
      expect(run.stdout).toBe(testCase.stdout);
      expect(run.stderr).toBe(testCase.stderr);
      expect(isSingleJsonDocument(run.stdout)).toBe(true);
      const parsed = JSON.parse(run.stdout) as Record<string, unknown>;
      expect(Object.keys(parsed)).toEqual(["data"]);
      expect(parsed.data).toEqual(
        (
          JSON.parse(readFileSync(join(testCase.directory, "stdout.json"), "utf8")) as {
            data: unknown;
          }
        ).data,
      );
      for (const token of ["schemaVersion", "runId", "exitCode", "timing"]) {
        expect(run.stdout).not.toContain(token);
      }
      expect(run.stdout).not.toContain("\n  ");
      expect(assertScriptedProjection(run.stdout)).toEqual([]);
    });
  }

  test('TC-GH223-015 void success renders exactly {"data":{}}', async () => {
    const run = await runCase(byId("scripted-success-void"));
    expect(run.stdout).toBe('{"data":{}}\n');
    expect(JSON.parse(run.stdout)).toEqual({ data: {} });
  });
});

describe("TC-GH223-016/017 scripted failure projection", () => {
  const failures = [
    "scripted-classified-user",
    "scripted-classified-platform",
    "scripted-unknown-failure",
    "scripted-broken-unknown-command",
    "scripted-broken-unknown-flag",
    "scripted-broken-missing-value",
    "scripted-broken-conflicting-flags",
  ];

  for (const id of failures) {
    test(`${id} is one minified error line with top-level runId`, async () => {
      const testCase = byId(id);
      const run = await runCase(testCase);
      const expectedExit =
        id === "scripted-classified-user" || id.startsWith("scripted-broken-") ? 1 : 2;
      expect(run.exitCode).toBe(expectedExit);
      expect(run.stdout).toBe(testCase.stdout);
      expect(run.stderr).toBe(testCase.stderr);
      expect(isSingleJsonDocument(run.stdout)).toBe(true);
      const parsed = JSON.parse(run.stdout) as {
        error: Record<string, unknown>;
        runId: string;
      };
      expect(Object.keys(parsed).sort()).toEqual(["error", "runId"]);
      expect(parsed.runId).toBe(testCase.injected.runId);
      expect(parsed.error).toMatchObject({
        code: expect.any(String),
        category: expect.any(String),
        retryable: expect.any(Boolean),
        consequence: expect.any(String),
        remediationHint: expect.any(String),
      });
      expect(Object.hasOwn(parsed.error, "runId")).toBe(false);
      for (const token of ["schemaVersion", "exitCode", "timing"]) {
        expect(run.stdout).not.toContain(token);
      }
      expect(hasStackLeak(run.stdout)).toBe(false);
      expect(assertScriptedProjection(run.stdout)).toEqual([]);
    });
  }

  test("broken invocations keep fallback.invocation on the scripted line", async () => {
    const parsed = JSON.parse((await runCase(byId("scripted-broken-unknown-command"))).stdout) as {
      error: { code: string };
    };
    expect(parsed.error.code).toBe("fallback.invocation");
  });
});
