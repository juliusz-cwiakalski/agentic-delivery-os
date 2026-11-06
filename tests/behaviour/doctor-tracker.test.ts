/**
 * TC-DOCTOR-007 — tracker wiring: one bounded page, verified-empty success,
 * credential/401-403/other-non-2xx/transport/unattempted, no prose parsing.
 */
import { describe, expect, test } from "bun:test";
import { DOCTOR_TRACKER_READ_LIMIT } from "../../packages/core/src/contracts/index";
import {
  CREDENTIAL_MISSING,
  READ_FAILED,
  READ_OK,
  runDoctorCli,
  UNRESOLVED_BINDING,
} from "../fixtures/doctor/harness";

const tracker = (report: Record<string, unknown> | undefined): Record<string, unknown> => {
  const data = report as { readonly checks: readonly Record<string, unknown>[] };
  const found = data.checks.find((entry) => entry.area === "tracker");
  if (found === undefined) throw new Error("tracker check missing");
  return found;
};

const reasons = (check: Record<string, unknown>): readonly string[] =>
  (check.evidence as { readonly reasons: readonly string[] }).reasons;

describe("TC-DOCTOR-007 tracker check", () => {
  test("a successful read is ok with exactly one bounded page at the declared limit", async () => {
    const run = await runDoctorCli(["doctor", "--json"]);
    expect(run.exitCode).toBe(0);
    expect(tracker(run.report).verdict).toBe("ok");
    expect(run.counts.tracker).toBe(1);
    expect(run.limits.tracker).toBe(DOCTOR_TRACKER_READ_LIMIT);
    expect(DOCTOR_TRACKER_READ_LIMIT).toBeGreaterThan(0);
  });

  test("a verified-empty page is a successful ok observation", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      tracker: { read: { ok: true, pageItemCount: 0 } },
    });
    const check = tracker(run.report);
    expect(check.verdict).toBe("ok");
    expect(reasons(check)).toContain("observed-empty");
    expect(String(check.detail)).toContain("empty page");
  });

  test("an unresolvable credential is fail naming only the declared environment variable", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      tracker: { credential: CREDENTIAL_MISSING },
    });
    expect(run.exitCode).toBe(1);
    const check = tracker(run.report);
    expect(check.verdict).toBe("fail");
    expect(reasons(check)).toContain("credential-unavailable");
    expect(String(check.fixHint)).toContain("EXAMPLE_PRODUCT_GITHUB_TOKEN");
    expect(run.counts.tracker).toBe(0);
  });

  test("structured 401 and 403 are fail/credential-rejected from the status only", async () => {
    for (const status of [401, 403]) {
      const run = await runDoctorCli(["doctor", "--json"], {
        tracker: { read: READ_FAILED(status, { failureClass: "planted-doctor-prose-401" }) },
      });
      const check = tracker(run.report);
      expect(check.verdict).toBe("fail");
      expect(reasons(check)).toContain("credential-rejected");
      expect(String(check.fixHint)).toContain("replace or broaden");
      expect(run.counts.tracker).toBe(1);
      expect(run.stdout).not.toContain("planted-doctor-prose-401");
    }
  });

  test("every other non-2xx, timeout, and absent status is unreachable/read-failed", async () => {
    for (const read of [
      READ_FAILED(404),
      READ_FAILED(500),
      READ_FAILED(503),
      READ_FAILED(undefined, { failureClass: "TimeoutError" }),
      READ_FAILED(),
    ]) {
      const run = await runDoctorCli(["doctor", "--json"], { tracker: { read } });
      const check = tracker(run.report);
      expect(check.verdict).toBe("unreachable");
      expect(reasons(check)).toContain("read-failed");
      expect(String(check.fixHint)).toContain("restore tracker reachability");
      expect(run.counts.tracker).toBe(1);
    }
  });

  test("classification never parses prose carried in an adapter-local class", async () => {
    const unauthorizedProse = await runDoctorCli(["doctor", "--json"], {
      tracker: { read: READ_FAILED(500, { failureClass: "401 Unauthorized" }) },
    });
    expect(tracker(unauthorizedProse.report).verdict).toBe("unreachable");
    const serverProse = await runDoctorCli(["doctor", "--json"], {
      tracker: { read: READ_FAILED(401, { failureClass: "server error" }) },
    });
    expect(tracker(serverProse.report).verdict).toBe("fail");
  });

  test("an unresolvable binding leaves the read unattempted and directs to the repo finding", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      checkout: { binding: UNRESOLVED_BINDING },
      tracker: { read: undefined },
      ci: { read: undefined },
    });
    const check = tracker(run.report);
    expect(check.verdict).toBe("unreachable");
    expect(reasons(check)).toContain("not-attempted");
    expect(String(check.fixHint)).toContain("repository remote binding");
    expect(run.counts.tracker).toBe(0);
  });

  test("the restored success fixture reaches ok after each failure", async () => {
    for (const read of [READ_FAILED(500), READ_FAILED(401)]) {
      const failed = await runDoctorCli(["doctor", "--json"], { tracker: { read } });
      expect(tracker(failed.report).verdict).not.toBe("ok");
      const restored = await runDoctorCli(["doctor", "--json"], { tracker: { read: READ_OK() } });
      expect(tracker(restored.report).verdict).toBe("ok");
    }
  });
});
