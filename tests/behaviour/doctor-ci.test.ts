/**
 * TC-DOCTOR-012 — CI wiring: one bounded check-runs page, zero runs success,
 * failed runs neutral, credential/401-403/other-non-2xx, unresolved commit, and
 * the unattempted read.
 */
import { describe, expect, test } from "bun:test";
import { DOCTOR_CI_READ_LIMIT } from "../../packages/core/src/contracts/index";
import {
  CREDENTIAL_MISSING,
  READ_FAILED,
  READ_OK,
  runDoctorCli,
  UNRESOLVED_BINDING,
} from "../fixtures/doctor/harness";

const ciOf = (report: Record<string, unknown> | undefined): Record<string, unknown> => {
  const data = report as { readonly checks: readonly Record<string, unknown>[] };
  const found = data.checks.find((entry) => entry.area === "ci");
  if (found === undefined) throw new Error("ci check missing");
  return found;
};

const reasons = (check: Record<string, unknown>): readonly string[] =>
  (check.evidence as { readonly reasons: readonly string[] }).reasons;

describe("TC-DOCTOR-012 ci check", () => {
  test("a successful read is ok with exactly one bounded page at the declared limit", async () => {
    const run = await runDoctorCli(["doctor", "--json"]);
    expect(run.exitCode).toBe(0);
    expect(ciOf(run.report).verdict).toBe("ok");
    expect(run.counts.ci).toBe(1);
    expect(run.limits.ci).toBe(DOCTOR_CI_READ_LIMIT);
  });

  test("zero runs are an observed-empty success", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      ci: { read: { ok: true, pageItemCount: 0 } },
    });
    const check = ciOf(run.report);
    expect(check.verdict).toBe("ok");
    expect(reasons(check)).toContain("observed-empty");
  });

  test("failed runs never flip the verdict (build health is not wiring)", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      ci: { read: READ_OK(3) },
    });
    const check = ciOf(run.report);
    expect(check.verdict).toBe("ok");
    expect(String(check.detail).toLowerCase()).not.toContain("failed");
    expect(String(check.detail).toLowerCase()).not.toContain("build");
  });

  test("a missing credential is fail with the environment-variable hint", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      tracker: { credential: CREDENTIAL_MISSING },
    });
    const check = ciOf(run.report);
    expect(check.verdict).toBe("fail");
    expect(reasons(check)).toContain("credential-unavailable");
    expect(String(check.fixHint)).toContain("EXAMPLE_PRODUCT_GITHUB_TOKEN");
    expect(run.counts.ci).toBe(0);
  });

  test("structured 401/403 use the tracker's shared rejection mechanism", async () => {
    for (const status of [401, 403]) {
      const run = await runDoctorCli(["doctor", "--json"], {
        ci: { read: READ_FAILED(status) },
      });
      const check = ciOf(run.report);
      expect(check.verdict).toBe("fail");
      expect(reasons(check)).toContain("credential-rejected");
      expect(String(check.fixHint)).toContain("replace or broaden");
      expect(run.counts.ci).toBe(1);
    }
  });

  test("other non-2xx and transport failures are unreachable/read-failed", async () => {
    for (const read of [
      READ_FAILED(404),
      READ_FAILED(500),
      READ_FAILED(503),
      READ_FAILED(undefined, { failureClass: "TimeoutError" }),
      READ_FAILED(),
    ]) {
      const run = await runDoctorCli(["doctor", "--json"], { ci: { read } });
      const check = ciOf(run.report);
      expect(check.verdict).toBe("unreachable");
      expect(reasons(check)).toContain("read-failed");
      expect(String(check.fixHint)).toContain("restore CI read reachability");
    }
  });

  test("an unresolved HEAD commit is fail with the run-from-a-branch hint", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      ci: { commit: { resolved: false, detached: true } },
    });
    const check = ciOf(run.report);
    expect(check.verdict).toBe("fail");
    expect(reasons(check)).toContain("commit-unresolved");
    expect(String(check.fixHint)).toContain("resolved HEAD commit");
    expect(run.counts.ci).toBe(0);
  });

  test("an unresolvable binding leaves the read unattempted", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      checkout: { binding: UNRESOLVED_BINDING },
      tracker: { read: undefined },
      ci: { read: undefined },
    });
    const check = ciOf(run.report);
    expect(check.verdict).toBe("unreachable");
    expect(reasons(check)).toContain("not-attempted");
    expect(run.counts.ci).toBe(0);
  });

  test("a credential failure outranks an unresolved commit", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      tracker: { credential: CREDENTIAL_MISSING },
      ci: { commit: { resolved: false, detached: true } },
    });
    const check = ciOf(run.report);
    expect(check.verdict).toBe("fail");
    expect(reasons(check)).toContain("credential-unavailable");
    expect(reasons(check)).not.toContain("commit-unresolved");
  });
});
