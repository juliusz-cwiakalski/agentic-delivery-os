/**
 * TC-CEREMONY-017 — a quiet night-watch renders every declared check exactly
 * once, and each clean area is an explicit verified-empty rather than an omitted
 * line; an anomaly cites its evidence reference.
 */
import { describe, expect, test } from "bun:test";
import {
  CEREMONY_DECLARED_CHECKS,
  CEREMONY_CHECK_STATE_VALUES,
} from "../../packages/core/src/domain/index";
import { prepareBuiltin, runPrepared } from "../fixtures/ceremony/builtins";

const nightWatchOf = (harness: ReturnType<typeof prepareBuiltin>["harness"]) => {
  for (const content of harness.artifactContents.values()) {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (parsed.schemaId === "delivery.ceremony.night-watch.v1") return parsed;
  }
  return undefined;
};

describe("TC-CEREMONY-017 a quiet night-watch is explicit verified-empty", () => {
  test("every declared check appears exactly once and each clean area is verified-empty", () => {
    const prepared = prepareBuiltin("night-watch");
    try {
      const run = runPrepared(prepared);
      expect(run.ok).toBe(true);
      if (run.ok) expect(run.data.verdict).toBe("verified");
      const report = nightWatchOf(prepared.harness);
      const checks = report?.checks as { id: string; state: string; verifiedEmpty: boolean }[];
      expect(checks.map((check) => check.id)).toEqual([...CEREMONY_DECLARED_CHECKS]);
      for (const check of checks) {
        expect(CEREMONY_CHECK_STATE_VALUES).toContain(check.state as never);
        expect(check.state).toBe("clean");
        expect(check.verifiedEmpty).toBe(true);
      }
    } finally {
      prepared.harness.dispose();
    }
  });

  test("an anomaly cites its evidence reference and is not reported clean", () => {
    const prepared = prepareBuiltin("night-watch");
    try {
      prepared.harness.scriptInput("audit-ledger", {
        state: "present",
        facts: { anomalies: [{ id: "unexpected-write" }] },
      });
      const run = runPrepared(prepared);
      expect(run.ok).toBe(true);
      const report = nightWatchOf(prepared.harness);
      const checks = report?.checks as {
        id: string;
        state: string;
        evidenceRef?: string;
        verifiedEmpty: boolean;
      }[];
      const audit = checks.find((check) => check.id === "audit-ledger");
      expect(audit?.state).toBe("anomaly");
      expect(audit?.evidenceRef).toBe("input:audit-ledger");
      expect(audit?.verifiedEmpty).toBe(false);
    } finally {
      prepared.harness.dispose();
    }
  });
});
