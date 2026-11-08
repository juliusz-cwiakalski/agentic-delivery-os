/**
 * TC-ERR-001 / TC-ERR-002 (phase 4) — the spawn failure classifies as
 * `dispatch.session.spawn-failed` and an unverifiable dispatch truth read as
 * `dispatch.state-unverified`; each appends exactly one attempt record with the
 * Appendix G pair, and both the machine and documented rows carry the identity.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readDispatchAttempts } from "../../packages/core/src/app/dispatch-ledger";
import {
  DOMAIN_KINDS,
  ERROR_TABLE,
  type ErrorTableEntry,
} from "../../packages/core/src/contracts/index";
import { createCommandScenario, readsFrom } from "../fixtures/dispatch/golden/harness";
import { COMPLETED_EVIDENCE } from "../fixtures/dispatch/harness";
import { readFail } from "../fixtures/dispatch/truth";

const entries = ERROR_TABLE as readonly ErrorTableEntry[];

const attemptOf = (scenario: ReturnType<typeof createCommandScenario>) => {
  const read = readDispatchAttempts(scenario.state.store);
  if (!read.ok) throw new Error("ledger read failed");
  return read.records[0];
};

describe("TC-ERR-001 spawn failure classifies as dispatch.session.spawn-failed", () => {
  test("exit 1, user-validation identity, failed/failed, one record", async () => {
    const scenario = createCommandScenario({ spawnFails: true });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(1);
      expect(run.envelope?.data?.error).toMatchObject({
        code: "dispatch.session.spawn-failed",
        category: "user",
        consequence: "not_landed",
      });
      expect(run.envelope?.data?.result).toBe("failed");
      expect(run.envelope?.data?.outcome).toBe("failed");
      const record = attemptOf(scenario);
      expect(record?.token).toBe("failed");
      expect(record?.outcome).toBe("failed");
      expect(record?.comparison).toEqual({
        class: "not-applicable",
        token: null,
        outcome: "not-applicable",
        reason: "comparison-source-unavailable",
      });
      const read = readDispatchAttempts(scenario.state.store);
      expect(read.ok && read.records.length).toBe(1);
    } finally {
      scenario.dispose();
    }
  });

  test("the machine and documented tables both carry the row with matching fields", () => {
    const row = entries.find((entry) => entry.code === "dispatch.session.spawn-failed");
    expect(row).toBeDefined();
    expect(DOMAIN_KINDS).toContain("dispatch");
    const doc = readFileSync(
      join(process.cwd(), "doc/spec/features/feature-result-contract.md"),
      "utf8",
    );
    expect(doc.split(`| ${row?.code} |`).length - 1).toBe(1);
    expect(doc).toContain(row?.summary ?? "");
  });
});

describe("TC-ERR-002 dispatch state failure classifies as dispatch.state-unverified", () => {
  test("exit 2, platform-provider identity, state-unverified, one record", async () => {
    const scenario = createCommandScenario({
      evidence: COMPLETED_EVIDENCE,
      reads: readsFrom({ tracker: readFail("tracker", "tracker.read-unreadable") }),
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(2);
      expect(run.envelope?.data?.error).toMatchObject({
        code: "dispatch.state-unverified",
        category: "platform",
        consequence: "not_landed",
      });
      expect(run.envelope?.data?.result).toBe("state-unverified");
      expect(run.envelope?.data?.error?.remediationHint.length).toBeGreaterThan(0);
      const record = attemptOf(scenario);
      expect(record?.token).toBe("state-unverified");
      expect(record?.comparison).toEqual({
        class: "not-applicable",
        token: null,
        outcome: "not-applicable",
        reason: "comparison-source-unavailable",
      });
    } finally {
      scenario.dispose();
    }
  });

  test("the machine and documented tables both carry the row", () => {
    const row = entries.find((entry) => entry.code === "dispatch.state-unverified");
    expect(row).toBeDefined();
    expect(row?.projectionClass).toBe("platform-provider");
    const doc = readFileSync(
      join(process.cwd(), "doc/spec/features/feature-result-contract.md"),
      "utf8",
    );
    expect(doc.split(`| ${row?.code} |`).length - 1).toBe(1);
  });
});

describe("a post-spawn collect failure is an attempt-stage outcome", () => {
  test("it appends exactly one unevaluable record instead of returning unrecorded", async () => {
    const scenario = createCommandScenario({
      evidence: COMPLETED_EVIDENCE,
      collectFails: true,
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      // A session existed, so this is not one of the three unrecorded pre-session
      // refusals: the attempt is classified `state-unverified` at exit 2.
      expect(run.exit).toBe(2);
      expect(run.envelope?.data?.result).toBe("state-unverified");
      expect(run.envelope?.data?.outcome).toBe("failed");
      expect(run.envelope?.data?.error?.code).toBe("dispatch.state-unverified");
      expect(run.envelope?.data?.error?.summary).toContain("harness.collect.unreadable");
      const read = readDispatchAttempts(scenario.state.store);
      expect(read.ok && read.records).toHaveLength(1);
      if (!read.ok) return;
      expect(read.records[0]?.token).toBe("state-unverified");
      expect(read.records[0]?.outcome).toBe("failed");
      expect(read.records[0]?.comparison).toEqual({
        class: "not-applicable",
        token: null,
        outcome: "not-applicable",
        reason: "comparison-source-unavailable",
      });
      expect(read.records[0]?.evidenceRefs).toContain("harness:collect-failed");
      expect(read.records[0]?.falseSuccess).toBe(false);
    } finally {
      scenario.dispose();
    }
  });
});
