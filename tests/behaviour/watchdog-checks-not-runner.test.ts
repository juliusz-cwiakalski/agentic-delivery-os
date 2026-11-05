/**
 * TC-WATCHDOG-060 — the watchdog surface never dispatches, spawns a session,
 * kills, restarts, or supervises. Local `git` child processes for inspection and
 * restoration are the expected mechanism and are not asserted against.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { WATCHDOG_PROBES } from "../../packages/core/src/contracts/index";
import { runnerSideEffectCalls, runWatchdogCli } from "../fixtures/watchdog/harness";
import { disposeMatrix, runReachableMatrix } from "../fixtures/watchdog/matrix";
import {
  createWatchdogRepository,
  makeClean,
  makeDirty,
  makeSuccessResidue,
} from "../fixtures/watchdog/temp-git";

const ROOT = process.cwd();
const COMMAND = "packages/cli/src/commands/watchdog.ts";
const SEAM = "packages/adapters/src/git/watchdog.ts";

const specifiersOf = (text: string): string[] => {
  const source = ts.createSourceFile(COMMAND, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const specifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
};

const FORBIDDEN_IMPORT = /@delivery-os\/adapters\/(session|host|opencode)|@opencode-ai\//;
const FORBIDDEN_PORT_NAMES = new Set([
  "spawnSession",
  "dispatch",
  "restartBudget",
  "supervise",
  "killSession",
  "killLane",
]);

export const runSurfaceViolations = (text: string, label: string): string[] => {
  const violations: string[] = [];
  for (const specifier of specifiersOf(text)) {
    if (FORBIDDEN_IMPORT.test(specifier)) {
      violations.push(`${label}: run-oriented import ${specifier}`);
    }
  }
  const source = ts.createSourceFile(label, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && FORBIDDEN_PORT_NAMES.has(node.text)) {
      violations.push(`${label}: run-oriented port reference ${node.text}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return violations;
};

describe("TC-WATCHDOG-060 the surface never dispatches, spawns, kills, or supervises", () => {
  test("every reachable fixture records zero runner side effects and still runs local git", async () => {
    const rows = await runReachableMatrix();
    try {
      for (const row of rows) {
        expect(runnerSideEffectCalls(row.run.runtimeCalls), row.id).toEqual([]);
      }
      const gitBacked = rows.find((row) => row.id === "admission-clean");
      expect(gitBacked?.run.gitCalls.length ?? 0).toBeGreaterThan(0);
    } finally {
      disposeMatrix(rows);
    }
  }, 30_000);

  test("all three probes against clean, dirty and residue fixtures record zero runner calls", async () => {
    const fixtures: readonly ((repo: ReturnType<typeof createWatchdogRepository>) => void)[] = [
      makeClean,
      makeDirty,
      makeSuccessResidue,
    ];
    for (const setup of fixtures) {
      const repo = createWatchdogRepository();
      try {
        setup(repo);
        for (const probe of ["preflight", "teardown", "liveness"]) {
          const run = await runWatchdogCli(["watchdog", probe, "lane-1", "--json"], { repo });
          expect(runnerSideEffectCalls(run.runtimeCalls), `${probe}`).toEqual([]);
        }
      } finally {
        repo.remove();
      }
    }
  }, 30_000);

  test("the command module and adapter seam import no session/host/opencode surface", () => {
    expect(runSurfaceViolations(readFileSync(join(ROOT, COMMAND), "utf8"), COMMAND)).toEqual([]);
    expect(runSurfaceViolations(readFileSync(join(ROOT, SEAM), "utf8"), SEAM)).toEqual([]);
  });

  test("the grammar has no run-oriented verbs", () => {
    for (const probe of WATCHDOG_PROBES) {
      expect([
        "run",
        "start",
        "stop",
        "kill",
        "spawn",
        "dispatch",
        "restart",
        "supervise",
      ]).not.toContain(probe);
    }
  });

  test("a mutant command importing a session adapter fails the scanner", () => {
    const root = mkdtempSync(join(tmpdir(), "watchdog-runner-"));
    try {
      mkdirSync(join(root, "packages/cli/src/commands"), { recursive: true });
      const mutant = `${readFileSync(join(ROOT, COMMAND), "utf8")}\nimport "@delivery-os/adapters/session";\n`;
      writeFileSync(join(root, COMMAND), mutant);
      expect(runSurfaceViolations(mutant, COMMAND).join("\n")).toContain(
        "run-oriented import @delivery-os/adapters/session",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
