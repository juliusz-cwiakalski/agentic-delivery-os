/**
 * TC-DISP-001 / TC-DISP-002 (phase 4) — harness resolution (flag then config),
 * the repository lease claim, one fresh spawn, exactly one attempt record after
 * classification, and the three pre-session refusals that emit a classified
 * envelope and append no attempt record.
 */
import { describe, expect, test } from "bun:test";
import { readDispatchAttempts } from "../../packages/core/src/app/dispatch-ledger";
import { createCommandScenario, readsFrom } from "../fixtures/dispatch/golden/harness";
import { COMPLETED_EVIDENCE, SPAWN_REFUSED_EVIDENCE } from "../fixtures/dispatch/harness";

const records = (scenario: ReturnType<typeof createCommandScenario>) => {
  const read = readDispatchAttempts(scenario.state.store);
  if (!read.ok) throw new Error(`ledger read failed: ${read.code}`);
  return read.records;
};

describe("TC-DISP-001 harness resolution, lease claim, fresh spawn, one record", () => {
  test("the configured harness runs, claims the lease, spawns once, and records once", async () => {
    const scenario = createCommandScenario({ evidence: COMPLETED_EVIDENCE });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(0);
      expect(run.envelope?.data?.result).toBe("pr-open");
      expect(run.envelope?.data?.harness).toBe("opencode");
      expect(scenario.scripted.calls.filter((call) => call === "spawn")).toHaveLength(1);
      expect(scenario.calls.claims).toHaveLength(1);
      expect(scenario.calls.releases).toEqual(["completed"]);
      const attempts = records(scenario);
      expect(attempts).toHaveLength(1);
      expect(attempts[0]?.harness).toBe("opencode");
      expect(attempts[0]?.repository).toBe("github.com/owner/repo");
      expect(attempts[0]?.comparison.outcome).toBe("match");
      expect(attempts[0]?.evidenceClass).toBe("pilot");
    } finally {
      scenario.dispose();
    }
  });

  test("the --harness flag wins over configuration", async () => {
    const scenario = createCommandScenario({ evidence: COMPLETED_EVIDENCE });
    try {
      const run = await scenario.invoke([
        "dispatch",
        "GH-302",
        "--harness",
        "claude-code",
        "--json",
      ]);
      expect(run.exit).toBe(0);
      expect(run.envelope?.data?.harness).toBe("claude-code");
      expect(scenario.scripted.spawnInputs).toHaveLength(1);
      expect(records(scenario)[0]?.harness).toBe("claude-code");
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-DISP-002 pre-session refusals append no attempt record", () => {
  test("an unknown harness refuses before any claim or spawn", async () => {
    const scenario = createCommandScenario({ evidence: COMPLETED_EVIDENCE });
    try {
      const run = await scenario.invoke([
        "dispatch",
        "GH-303",
        "--harness",
        "unknown-harness",
        "--json",
      ]);
      expect(run.exit).toBe(1);
      expect(run.envelope?.error?.code).toBe("input.value.rejected");
      expect(scenario.scripted.calls).toEqual([]);
      expect(scenario.calls.claims).toEqual([]);
      expect(records(scenario)).toEqual([]);
    } finally {
      scenario.dispose();
    }
  });

  test("a rejected input value refuses before any claim or spawn", async () => {
    const scenario = createCommandScenario({ evidence: COMPLETED_EVIDENCE });
    try {
      const run = await scenario.invoke(["dispatch", "not-a-ref", "--json"]);
      expect(run.exit).toBe(1);
      expect(run.envelope?.error?.code).toBe("input.value.rejected");
      expect(scenario.scripted.calls).toEqual([]);
      expect(records(scenario)).toEqual([]);
    } finally {
      scenario.dispose();
    }
  });

  test("a conflicting lease before a spawn refuses and appends no record", async () => {
    const scenario = createCommandScenario({
      evidence: COMPLETED_EVIDENCE,
      claim: { ok: false, code: "queue.lease-conflict" },
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(1);
      expect(run.envelope?.error?.code).toBe("queue.lease-conflict");
      expect(run.envelope?.error?.category.length).toBeGreaterThan(0);
      expect(scenario.scripted.calls).toEqual([]);
      expect(scenario.calls.claims).toHaveLength(1);
      expect(records(scenario)).toEqual([]);
    } finally {
      scenario.dispose();
    }
  });

  test("a harness spawn refusal is a recorded attempt, never a pre-session refusal", async () => {
    const scenario = createCommandScenario({
      evidence: SPAWN_REFUSED_EVIDENCE,
      reads: readsFrom(),
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-311", "--json"]);
      expect(run.exit).toBe(1);
      expect(run.envelope?.data?.result).toBe("noop-lane-permission");
      expect(run.envelope?.data?.outcome).toBe("refused");
      const attempts = records(scenario);
      expect(attempts).toHaveLength(1);
      expect(attempts[0]?.token).toBe("noop-lane-permission");
      expect(attempts[0]?.outcome).toBe("refused");
    } finally {
      scenario.dispose();
    }
  });
});
