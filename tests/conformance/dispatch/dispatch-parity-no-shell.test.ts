/**
 * TC-SHELL-001 — the guarded injected runner records ZERO shell invocations
 * across the whole battery (GH-347 AC-F9-4, API-7, NFR-5).
 *
 * The sweep is the registry, not a list in this body: every declared row runs
 * once, and the guard's records are asserted for each observation. The suite
 * also STATES which registry rows invoke a process (AC-F9-4's "the per-
 * invocation argv sweep is not empty for every row") and proves that the
 * real-child-start counter is live rather than a literal (review M5).
 */
import { describe, expect, test } from "bun:test";
import { PARITY_CASES, runAllParityCases } from "../../fixtures/dispatch/parity/cases";
import { createParityHarness } from "../../fixtures/dispatch/parity/harness";
import { createGuardedRunner, isScriptPath } from "../../fixtures/dispatch/parity/process-runner";

const SHELLS = new Set(["bash", "sh", "zsh", "dash", "cmd", "powershell"]);

/**
 * The registry rows that invoke a PROCESS through the guarded runner (AC-F9-4).
 *
 * Every other row drives the engine over an injected session-port double, so it
 * has no child-process argv to sweep — that is a declared property of the
 * registry, not an omission. A new row that starts a process must be named here
 * or this declaration fails.
 */
export const PARITY_PROCESS_ROWS = [
  "admission-same-ref-race",
  "resume-pr-open-lane",
  "resume-no-lane",
  "resume-unknown-session",
  "spawn-fresh",
  "spawn-resume",
  "tracker-outage-with-artifact",
  "tracker-outage-without-artifact",
] as const;

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

  test("the registry rows that invoke a process are exactly the declared set", async () => {
    const results = await runAllParityCases();
    const invoking = results
      .filter((run) => run.observation.invocations.length > 0)
      .map((run) => run.entry.id)
      .sort();
    expect(invoking).toEqual([...PARITY_PROCESS_ROWS].sort());
    // Every declared process row actually produced an argv to sweep, so the
    // per-invocation assertions above are non-vacuous for it.
    for (const run of results) {
      if (!PARITY_PROCESS_ROWS.includes(run.entry.id as (typeof PARITY_PROCESS_ROWS)[number]))
        continue;
      expect(run.observation.invocations.length, run.entry.id).toBeGreaterThan(0);
    }
  });

  test("the guard refuses a requested shell or script path by name", async () => {
    const guarded = createGuardedRunner();
    await expect(
      guarded.runner("bash", ["scripts/deliver-ticket.sh"], {
        cwd: "/synthetic",
        env: {},
        timeout: 1,
      }),
    ).rejects.toThrow(/shell invocation recorded|script path recorded/u);
    expect(guarded.violations.length).toBeGreaterThan(0);
  });

  test("the battery's guarded runner intercepts work and starts no real child", async () => {
    // A FRESH, UNUSED runner cannot prove anything (review M5). This drives a
    // real composed dispatch through a shared guard: it observes an intercepted
    // start (so the seam was used) and a zero real-start count.
    const guarded = createGuardedRunner();
    const harness = createParityHarness({ label: "no-shell-live", guarded });
    try {
      await harness.run(["dispatch", "GH-347", "--json"]);
      expect(guarded.invocations).toBeGreaterThan(0);
      expect(guarded.realChildStarts).toBe(0);
    } finally {
      harness.dispose();
    }

    // The counter is LIVE: the planted control permits one start and observes
    // it, so `realChildStarts === 0` above is a measurement, not a literal.
    const permitted = createGuardedRunner({ permitStarts: true });
    await permitted.runner("opencode", ["run"], {
      cwd: "/synthetic",
      env: {},
      timeout: 1,
    });
    expect(permitted.realChildStarts).toBe(1);
  });
});
