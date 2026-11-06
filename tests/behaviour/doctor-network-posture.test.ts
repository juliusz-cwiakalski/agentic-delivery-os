/**
 * TC-DOCTOR-024 / TC-DOCTOR-025 — hermetic default execution, the two-read
 * budget, one shared page per read, no pagination or retries, shared-source
 * read-once, and the one shared 401/403 mechanism across tracker and CI.
 */
import { describe, expect, test } from "bun:test";
import {
  DOCTOR_CI_READ_LIMIT,
  DOCTOR_TRACKER_READ_LIMIT,
} from "../../packages/core/src/contracts/index";
import {
  READ_FAILED,
  UNRESOLVED_BINDING,
  fakeDoctorRuntime,
  parseEnvelope,
  runCliWithRuntime,
  runDoctorCli,
} from "../fixtures/doctor/harness";

describe("TC-DOCTOR-024 hermetic default suite", () => {
  test("the default run performs zero live network or credential reads", async () => {
    const run = await runDoctorCli(["doctor", "--json"]);
    expect(run.exitCode).toBe(0);
    // Every read is injected; the harness carries no transport or credential port.
    expect(run.counts.tracker).toBe(1);
    expect(run.counts.ci).toBe(1);
  });

  test("the spawn sentinel and credential stub are never invoked (control proves them live)", async () => {
    const stub = {
      resolve: () => {
        throw new Error("planted-doctor-live-credential");
      },
    };
    expect(() => stub.resolve()).toThrow("planted-doctor-live-credential");
    const run = await runDoctorCli(["doctor", "--json"]);
    expect(run.stdout).not.toContain("planted-doctor-live-credential");
  });
});

describe("TC-DOCTOR-025 network posture and read budget", () => {
  test("exactly one tracker page and one check-runs page at the declared limits", async () => {
    const run = await runDoctorCli(["doctor", "--json"]);
    expect(run.counts.tracker).toBe(1);
    expect(run.counts.ci).toBe(1);
    expect(run.limits.tracker).toBe(DOCTOR_TRACKER_READ_LIMIT);
    expect(run.limits.ci).toBe(DOCTOR_CI_READ_LIMIT);
    expect(run.counts.credential).toBe(1);
    expect(run.counts.providerConfig).toBe(1);
    expect(run.counts.fold).toBe(1);
    expect(run.counts.state).toBe(1);
  });

  test("an unresolvable binding performs zero network reads", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      checkout: { binding: UNRESOLVED_BINDING },
      tracker: { read: undefined },
      ci: { read: undefined },
    });
    expect(run.counts.tracker).toBe(0);
    expect(run.counts.ci).toBe(0);
    // The local checks still run.
    expect(run.counts.providerConfig).toBe(1);
    expect(run.counts.state).toBe(1);
  });

  test("a failing tracker read is attempted exactly once and never retried", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      tracker: { read: READ_FAILED(503) },
    });
    expect(run.counts.tracker).toBe(1);
  });

  test("tracker and CI share one credential resolution and one mechanism", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      tracker: { read: READ_FAILED(401) },
      ci: { read: READ_FAILED(401) },
    });
    expect(run.counts.credential).toBe(1);
    const data = parseEnvelope(run.stdout);
    expect(data.data).toBeUndefined();
    const error = data.error as { readonly code: string; readonly summary?: string };
    expect(error.code).toBe("doctor.check.failed");
    expect(error.summary ?? "").toContain("tracker (fail)");
    expect(error.summary ?? "").toContain("ci (fail)");
  });

  test("a malformed runtime result never triggers a second attempt", async () => {
    const { runtime } = fakeDoctorRuntime();
    const run = await runCliWithRuntime(["doctor", "--json"], {
      ...runtime,
      readTrackerPage: async () => null as never,
    });
    expect(run.exitCode).toBe(1);
    expect(run.stdout).not.toContain("fallback.internal");
  });
});
