/**
 * TC-HAND-005 (phase 6) — a dual-run dispatch reports `handoverState: dual-run`,
 * records its evidence, claims no authority, blocks no bash path, and fires no
 * merge; after a recorded handover the same dispatch reports `authoritative`.
 */
import { describe, expect, test } from "bun:test";
import {
  appendDispatchAttempt,
  readDispatchAttempts,
} from "../../packages/core/src/app/dispatch-ledger";
import { readDispatchAuthority } from "../../packages/adapters/src/file/dispatch-authority";
import { createCommandScenario } from "../fixtures/dispatch/golden/harness";
import { COMPLETED_EVIDENCE } from "../fixtures/dispatch/harness";
import { buildAttempts, eligibleSpecs } from "../fixtures/dispatch/evidence-windows";
import { REPOSITORY } from "../fixtures/dispatch/ledger";

const seed = (scenario: ReturnType<typeof createCommandScenario>, specs: ReturnType<typeof eligibleSpecs>) => {
  for (const attempt of buildAttempts(specs)) {
    const appended = appendDispatchAttempt(scenario.state.store, scenario.state.fenceToken, attempt);
    if (!appended.ok) throw new Error("seed failed");
  }
};

describe("TC-HAND-005 dual-run dispatch claims no authority", () => {
  test("handoverState is dual-run, evidence is recorded, and no merge fires", async () => {
    const scenario = createCommandScenario({ evidence: COMPLETED_EVIDENCE, gate: {} });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(0);
      expect(run.envelope?.data?.handoverState).toBe("dual-run");
      const read = readDispatchAttempts(scenario.state.store);
      expect(read.ok && read.records).toHaveLength(1);
      expect(read.ok && read.records[0]?.handoverState).toBe("dual-run");
      expect(scenario.calls.merge).toBe(0);
      expect(readDispatchAuthority(scenario.state.root, REPOSITORY).authority).toBe("dual-run");
    } finally {
      scenario.dispose();
    }
  });

  test("after a recorded handover the same dispatch reports authoritative", async () => {
    const scenario = createCommandScenario({ evidence: COMPLETED_EVIDENCE, gate: {} });
    try {
      seed(scenario, eligibleSpecs());
      const flip = await scenario.invoke(["dispatch", "handover", REPOSITORY, "--json"]);
      expect(flip.exit).toBe(0);
      const run = await scenario.invoke(["dispatch", "GH-302", "--json"]);
      expect(run.envelope?.data?.handoverState).toBe("authoritative");
      const read = readDispatchAttempts(scenario.state.store);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      const last = read.records[read.records.length - 1];
      expect(last?.handoverState).toBe("authoritative");
    } finally {
      scenario.dispose();
    }
  });
});
