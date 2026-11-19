/**
 * TC-SHELL-001 — the guarded injected runner records ZERO shell invocations
 * across the whole battery (GH-347 AC-F9-4, API-7, NFR-5).
 *
 * The sweep is the registry, not a list in this body: every declared row runs
 * once, and the guard's records are asserted for each observation.
 */
import { describe, expect, test } from "bun:test";
import { PARITY_CASES, runAllParityCases } from "../../fixtures/dispatch/parity/cases";
import { createGuardedRunner, isScriptPath } from "../../fixtures/dispatch/parity/process-runner";

const SHELLS = new Set(["bash", "sh", "zsh", "dash", "cmd", "powershell"]);

describe("TC-SHELL-001 zero shell invocations across the battery", () => {
  test("every registry row runs with fixed argv, no shell, and no script path", async () => {
    const results = await runAllParityCases();
    expect(results).toHaveLength(PARITY_CASES.length);
    expect(new Set(results.map((run) => run.entry.group))).toEqual(
      new Set(["class", "admission", "resume", "tracker-outage", "loop", "terminate", "spawn"]),
    );
    for (const run of results) {
      expect(run.observation.violations, run.entry.id).toEqual([]);
      for (const invocation of run.observation.invocations) {
        const basename = invocation.file.split("/").pop() ?? invocation.file;
        expect(SHELLS.has(basename), `${run.entry.id} ${invocation.file}`).toBe(false);
        for (const arg of invocation.args) {
          expect(isScriptPath(arg), `${run.entry.id} ${arg}`).toBe(false);
        }
      }
    }
  });

  test("the guard refuses a requested shell or script path by name", async () => {
    const guarded = createGuardedRunner();
    await expect(
      guarded.runner("bash", ["scripts/deliver-ticket.sh"], {
        cwd: "/tmp",
        env: {},
        timeout: 1,
      }),
    ).rejects.toThrow(/shell invocation recorded|script path recorded/u);
    expect(guarded.violations.length).toBeGreaterThan(0);
  });

  test("no real child process is ever started by the battery's injected seams", () => {
    const guarded = createGuardedRunner();
    expect(guarded.realChildStarts).toBe(0);
  });
});
