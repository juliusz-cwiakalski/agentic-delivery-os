/**
 * TC-PILOT-006 — deterministic bounds and teardown.
 */

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { createPilot, PILOT_BUDGET, type Pilot, withGuards } from "../../fixtures/pilot/harness";

describe("TC-PILOT-006 deterministic bounds and cleanup", () => {
  test("the run stays inside the fixed step/retry budget and does not sleep", async () => {
    const pilot: Pilot = await createPilot();
    try {
      const startedAt = Date.now();
      const observed = await withGuards(async (guards) => {
        await pilot.runSequence();
        return guards;
      });
      const durationMs = Date.now() - startedAt;
      // Informational only: the suite's fixed runner timeout is the gate.
      expect(durationMs).toBeGreaterThanOrEqual(0);
      expect(pilot.steps.count).toBeLessThanOrEqual(PILOT_BUDGET.maxSteps);
      expect(pilot.steps.retries).toBe(0);
      expect(observed.sleep.sleeps).toEqual([]);
      expect(observed.fetch.attempts).toEqual([]);
    } finally {
      pilot.cleanup();
    }
  });

  test("teardown removes every temp repository, state directory, and bare remote", async () => {
    const pilot = await createPilot();
    const root = pilot.repo.root;
    const remote = pilot.repo.remoteRoot;
    const stateRoot = pilot.stateRoot;
    await pilot.runSequence();
    pilot.cleanup();
    expect(existsSync(root)).toBe(false);
    expect(existsSync(remote)).toBe(false);
    expect(existsSync(stateRoot)).toBe(false);
  });
});
