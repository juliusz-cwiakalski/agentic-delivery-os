/**
 * TC-DOCTOR-011 — state wiring: verified/empty stores, torn/schema/permission/
 * unknown, unreadable-beyond-classified, and no repair.
 */
import { describe, expect, test } from "bun:test";
import { runDoctorCli } from "../fixtures/doctor/harness";

const stateOf = (report: Record<string, unknown> | undefined): Record<string, unknown> => {
  const data = report as { readonly checks: readonly Record<string, unknown>[] };
  const found = data.checks.find((entry) => entry.area === "state");
  if (found === undefined) throw new Error("state check missing");
  return found;
};

const reasons = (check: Record<string, unknown>): readonly string[] =>
  (check.evidence as { readonly reasons: readonly string[] }).reasons;

describe("TC-DOCTOR-011 state check", () => {
  test("valid and verified-empty stores are ok", async () => {
    const valid = await runDoctorCli(["doctor", "--json"]);
    expect(stateOf(valid.report).verdict).toBe("ok");
    const empty = await runDoctorCli(["doctor", "--json"], {
      state: { ok: true, verifiedEmpty: true, recordCount: 0 },
    });
    const check = stateOf(empty.report);
    expect(check.verdict).toBe("ok");
    expect(reasons(check)).toContain("observed-empty");
  });

  test("a torn store is fail with the salvage-as-a-separate-step hint", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      state: { ok: false, reason: "store-torn", failureCode: "state.store.torn" },
    });
    const check = stateOf(run.report);
    expect(check.verdict).toBe("fail");
    expect(reasons(check)).toContain("store-torn");
    expect(String(check.fixHint)).toBe(
      "run the store salvage as a separate step, then re-run doctor",
    );
    expect(run.counts.state).toBe(1);
  });

  test("a schema mismatch names the compatible-version-or-migrate hint", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      state: { ok: false, reason: "store-schema-mismatch", failureCode: "state.schema.mismatch" },
    });
    const check = stateOf(run.report);
    expect(check.verdict).toBe("fail");
    expect(String(check.fixHint)).toContain("compatible version or migrate");
  });

  test("a permission failure is fail (not unreachable) with the fix-permissions hint", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      state: { ok: false, reason: "store-unreadable", failureCode: "state.permission.denied" },
    });
    const check = stateOf(run.report);
    expect(check.verdict).toBe("fail");
    expect(reasons(check)).toContain("store-unreadable");
    expect(String(check.fixHint)).toContain("permissions");
  });

  test("an undeclared record kind is fail with the declare-or-compatible-version hint", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      state: { ok: false, reason: "store-unknown", failureCode: "state.store.unknown" },
    });
    const check = stateOf(run.report);
    expect(check.verdict).toBe("fail");
    expect(String(check.fixHint)).toContain("declare the record kind");
  });

  test("unreadable-beyond-classified facts are unreachable", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      state: { ok: false, reason: "unreadable" },
    });
    const check = stateOf(run.report);
    expect(check.verdict).toBe("unreachable");
    expect(reasons(check)).toContain("check-unreachable");
  });

  test("the provider fold and the state check each read the store truth once", async () => {
    const run = await runDoctorCli(["doctor", "--json"]);
    expect(run.counts.state).toBe(1);
    expect(run.counts.fold).toBe(1);
  });

  test("a failed store restored to valid reaches ok", async () => {
    const failed = await runDoctorCli(["doctor", "--json"], {
      state: { ok: false, reason: "store-torn" },
    });
    expect(stateOf(failed.report).verdict).toBe("fail");
    const restored = await runDoctorCli(["doctor", "--json"]);
    expect(stateOf(restored.report).verdict).toBe("ok");
  });
});
