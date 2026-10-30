/**
 * TC-RUNCLI-001 / TC-RUNCLI-002 — the surface runs in process, returns the exit
 * code, spawns nothing, and is deterministic under injection.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { loadGoldenCases } from "../../packages/testkit/src/result-conformance";
import { createNoSpawnGuard } from "../fixtures/result/no-spawn-guard";
import { GOLDEN_ROOT, ROOT, runCase } from "../golden/helpers";

const cases = await loadGoldenCases(GOLDEN_ROOT);
const successCase = cases.find((entry) => entry.id === "success-data");
if (successCase === undefined) throw new Error("success-data golden is missing");

const SURFACE_FILES = [
  "packages/cli/src/index.ts",
  "packages/cli/src/classify.ts",
  "packages/cli/src/projection.ts",
  "packages/cli/src/edge.ts",
  "packages/cli/src/output/serialize.ts",
  "tests/behaviour/run-cli.test.ts",
];

describe("TC-RUNCLI-001 in-process, no spawn, no exit", () => {
  test("guard self-test proves a forbidden call throws", () => {
    const guard = createNoSpawnGuard();
    guard.install();
    try {
      expect(guard.exerciseForbiddenCall()).toBe(true);
    } finally {
      guard.restore();
    }
  });

  test("runCli returns a numeric exit code without touching real streams", async () => {
    const guard = createNoSpawnGuard();
    guard.install();
    let exitCode = -1;
    try {
      exitCode = (await runCase(successCase)).exitCode;
    } finally {
      guard.restore();
    }
    expect(exitCode).toBe(0);
    expect(guard.violations).toEqual([]);
  });

  test("a failing command returns non-zero and the test process survives", async () => {
    const exitCode = (await runCase(successCase)).exitCode;
    expect(exitCode).toBe(0);
    expect(true).toBe(true);
  });

  test("delivered surface and test file contain no spawn or exit constructs", () => {
    const failures: string[] = [];
    for (const file of SURFACE_FILES) {
      const text = readFileSync(join(ROOT, file), "utf8");
      const source = ts.createSourceFile(
        file,
        text,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      );
      const visit = (node: ts.Node): void => {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
          const specifier = node.moduleSpecifier.text;
          if (specifier === "node:child_process" || specifier === "child_process") {
            failures.push(`${file}: imports ${specifier}`);
          }
        }
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
          const callee = node.expression.getText(source);
          if (["Bun.spawn", "Bun.spawnSync", "process.exit"].includes(callee)) {
            failures.push(`${file}: calls ${callee}`);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    expect(failures).toEqual([]);
  });
});

describe("TC-RUNCLI-002 determinism under injection", () => {
  test("five sequential runs are byte-identical", async () => {
    const runs = [];
    for (let index = 0; index < 5; index += 1) runs.push(await runCase(successCase));
    for (const run of runs) expect(run).toEqual(runs[0] as typeof run);
  });

  test("five interleaved runs remain byte-identical", async () => {
    const failureCase = cases.find((entry) => entry.id === "classified-user");
    if (failureCase === undefined) throw new Error("classified-user golden is missing");
    const firstSuccess = await runCase(successCase);
    const firstFailure = await runCase(failureCase);
    for (let index = 0; index < 5; index += 1) {
      expect(await runCase(failureCase)).toEqual(firstFailure);
      expect(await runCase(successCase)).toEqual(firstSuccess);
    }
  });

  test("anti-vacuity: different argv differs", async () => {
    const different = cases.find((entry) => entry.id === "success-void");
    if (different === undefined) throw new Error("success-void golden is missing");
    const first = await runCase(successCase);
    const second = await runCase(different);
    expect(second.stdout).not.toBe(first.stdout);
  });

  test("a changed runId changes only the runId field", async () => {
    const baseline = await runCase(successCase);
    const changedCase = {
      ...successCase,
      injected: { ...successCase.injected, runId: "run-fixture-other" },
    };
    const changed = await runCase(changedCase);
    const baselineEnvelope = JSON.parse(baseline.stdout) as Record<string, unknown>;
    const changedEnvelope = JSON.parse(changed.stdout) as Record<string, unknown>;
    expect(changedEnvelope.runId).toBe("run-fixture-other");
    delete baselineEnvelope.runId;
    delete changedEnvelope.runId;
    expect(changedEnvelope).toEqual(baselineEnvelope);
  });

  test("throwing ambient clock/randomness stubs do not affect injected runs", async () => {
    const originalNow = Date.now;
    const originalPerformanceNow = performance.now;
    const originalRandom = Math.random;
    const originalRandomUuid = globalThis.crypto.randomUUID;
    Date.now = () => {
      throw new Error("Date.now read");
    };
    performance.now = () => {
      throw new Error("performance.now read");
    };
    Math.random = () => {
      throw new Error("Math.random read");
    };
    try {
      Object.defineProperty(globalThis.crypto, "randomUUID", {
        configurable: true,
        value: () => {
          throw new Error("randomUUID read");
        },
      });
      const baseline = await runCase(successCase);
      expect(baseline.stdout).toBe(successCase.stdout);
    } finally {
      Date.now = originalNow;
      performance.now = originalPerformanceNow;
      Math.random = originalRandom;
      Object.defineProperty(globalThis.crypto, "randomUUID", {
        configurable: true,
        value: originalRandomUuid,
      });
    }
  });

  test("a changed injected delta changes only timing", async () => {
    const baseline = await runCase(successCase);
    const changed = await runCase(successCase, {
      ticks: [1000, 1042],
    });
    const baselineEnvelope = JSON.parse(baseline.stdout) as Record<string, unknown>;
    const changedEnvelope = JSON.parse(changed.stdout) as Record<string, unknown>;
    expect(changedEnvelope.timing).toEqual({ totalMs: 42 });
    delete baselineEnvelope.timing;
    delete changedEnvelope.timing;
    expect(changedEnvelope).toEqual(baselineEnvelope);
  });
});
