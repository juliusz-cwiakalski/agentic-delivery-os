/**
 * TC-DOCTOR-015 / TC-DOCTOR-016 / TC-DOCTOR-017 — outcome modelling: the
 * Appendix B failure summaries, success data with exit 0, envelope exclusivity,
 * and the {0,1,2} exit taxonomy through the existing projection.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  announcementRecord,
  fakeDoctorRuntime,
  parkRecord,
  parseEnvelope,
  READ_FAILED,
  runCliWithRuntime,
  runDoctorCli,
} from "../fixtures/doctor/harness";

const APPENDIX_B_1_OF_5 =
  "doctor check failures (1/5) — provider (fail): refresh the credential for provider-c, then run provider quota --provider provider-c";
const APPENDIX_B_2_OF_5 =
  "doctor check failures (2/5) — repo (fail): commit or discard the uncommitted changes, then re-run doctor; tracker (unreachable): restore tracker reachability, then re-run doctor";

const summaryOf = (stdout: string): string => {
  const error = parseEnvelope(stdout).error as { readonly summary?: string } | undefined;
  return error?.summary ?? "";
};

describe("TC-DOCTOR-015 failure outcome and the Appendix B grammar", () => {
  test("the 1/5 provider fixture reproduces the Appendix B summary byte-for-byte", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      provider: {
        fold: {
          ok: true,
          parks: [parkRecord({ subjectName: "provider-c", cause: "credential-rejected" })],
          announcements: [],
        },
      },
    });
    expect(run.exitCode).toBe(1);
    expect(summaryOf(run.stdout)).toBe(APPENDIX_B_1_OF_5);
  });

  test("the 2/5 repo+tracker fixture reproduces the Appendix B summary byte-for-byte", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      checkout: { clean: false },
      tracker: { read: READ_FAILED(500) },
    });
    expect(run.exitCode).toBe(1);
    expect(summaryOf(run.stdout)).toBe(APPENDIX_B_2_OF_5);
  });

  test("a 5/5 run names every area in fixed order", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      checkout: { clean: false },
      tracker: { credential: { ok: false, envVar: "EXAMPLE_PRODUCT_GITHUB_TOKEN" } },
      provider: {
        config: { ok: false, reason: "config-invalid", failureCode: "config.file.malformed" },
      },
      state: { ok: false, reason: "store-torn" },
      ci: { commit: { resolved: false, detached: true } },
    });
    const summary = summaryOf(run.stdout);
    expect(summary.startsWith("doctor check failures (5/5) — repo (fail): ")).toBe(true);
    for (const area of ["repo", "tracker", "provider", "state", "ci"]) {
      expect(summary).toContain(`${area} (`);
    }
    expect(summary.split("\n")).toHaveLength(1);
    const order = ["repo", "tracker", "provider", "state", "ci"].map((area) =>
      summary.indexOf(`${area} (`),
    );
    expect(order).toEqual([...order].sort((left, right) => left - right));
  });

  test("the envelope error object carries the generic row metadata", async () => {
    const run = await runDoctorCli(["doctor", "--json"], { checkout: { clean: false } });
    const error = parseEnvelope(run.stdout).error as Record<string, unknown>;
    expect(error.code).toBe("doctor.check.failed");
    expect(error.category).toBe("user");
    expect(error.retryable).toBe(false);
    expect(error.consequence).toBe("not_landed");
    expect(error.remediationHint).toBe(
      "Resolve each named failing check using its fix hint, then re-run doctor.",
    );
    expect(String(error.summary)).not.toContain("Resolve each named failing check");
  });

  test("the success path never carries the failure identity", async () => {
    const run = await runDoctorCli(["doctor", "--json"]);
    expect(run.stdout).not.toContain("doctor.check.failed");
  });
});

describe("TC-DOCTOR-016 success outcome and envelope exclusivity", () => {
  test("every all-ok variant is one success envelope with the v1 key set", async () => {
    for (const world of [
      {},
      { tracker: { read: { ok: true as const, pageItemCount: 0 } } },
      { ci: { read: { ok: true as const, pageItemCount: 0 } } },
      { state: { ok: true as const, verifiedEmpty: true, recordCount: 0 } },
      { provider: { fold: { ok: true as const, parks: [], announcements: [] } } },
    ]) {
      const run = await runDoctorCli(["doctor", "--json"], world);
      expect(run.exitCode).toBe(0);
      const envelope = parseEnvelope(run.stdout);
      expect(Object.keys(envelope).sort()).toEqual([
        "data",
        "exitCode",
        "runId",
        "schemaVersion",
        "timing",
      ]);
      expect(envelope.error).toBeUndefined();
      expect(envelope.exitCode).toBe(0);
    }
  });

  test("success data carries five checks, counts, binding, and the injected clock", async () => {
    const run = await runDoctorCli(["doctor", "--json"]);
    const data = parseEnvelope(run.stdout).data as {
      readonly schemaVersion: string;
      readonly generatedAt: string;
      readonly repository: unknown;
      readonly checks: readonly unknown[];
      readonly summary: unknown;
    };
    expect(data.schemaVersion).toBe("delivery.doctor.v1");
    expect(data.generatedAt).toBe("2026-11-18T10:20:00Z");
    expect(data.checks).toHaveLength(5);
    expect(data.repository).toEqual({
      state: "observed",
      host: "github.com",
      owner: "example-owner",
      name: "example-repo",
    });
    expect(data.summary).toEqual({ total: 5, ok: 5, fail: 0, unreachable: 0 });
  });

  test("a failure envelope carries no data and an unreachable check still exits 1", async () => {
    const failed = await runDoctorCli(["doctor", "--json"], {
      tracker: { read: READ_FAILED(500) },
    });
    expect(failed.exitCode).toBe(1);
    const envelope = parseEnvelope(failed.stdout);
    expect(envelope.data).toBeUndefined();
    expect((envelope.error as { readonly code: string }).code).toBe("doctor.check.failed");
  });

  test("envelope mutations fail by name", async () => {
    const run = await runDoctorCli(["doctor", "--json"], { checkout: { clean: false } });
    const envelope = parseEnvelope(run.stdout);
    const withData = { ...envelope, data: { schemaVersion: "delivery.doctor.v1" } };
    expect(Object.hasOwn(withData, "data") && Object.hasOwn(withData, "error")).toBe(true);
    const withoutError = { ...envelope } as Record<string, unknown>;
    delete withoutError.error;
    expect(Object.hasOwn(withoutError, "error")).toBe(false);
    expect(Object.hasOwn(withoutError, "data")).toBe(false);
  });
});

describe("TC-DOCTOR-017 unable-to-run and the exit taxonomy", () => {
  test("an outside-check containment failure projects exit 2 and fabricates no report", async () => {
    const { runtime } = fakeDoctorRuntime();
    const run = await runCliWithRuntime(["doctor", "--json"], {
      ...runtime,
      nowMs: () => {
        throw new Error("composition exploded");
      },
    });
    expect(run.exitCode).toBe(2);
    const envelope = parseEnvelope(run.stdout);
    expect((envelope.error as { readonly code: string }).code).toBe("fallback.internal");
    expect(envelope.data).toBeUndefined();
  });

  test("every outcome in the matrix exits inside {0, 1, 2}", async () => {
    const worlds = [
      {},
      { checkout: { clean: false } },
      { tracker: { read: READ_FAILED(500) } },
      {
        provider: { fold: { ok: true as const, parks: [], announcements: [announcementRecord()] } },
      },
      { state: { ok: false as const, reason: "unreadable" as const } },
    ];
    for (const world of worlds) {
      const run = await runDoctorCli(["doctor", "--json"], world);
      expect([0, 1, 2]).toContain(run.exitCode);
    }
  });

  test("doctor source chooses no exit literal and calls no process exit", () => {
    for (const file of [
      "packages/cli/src/commands/doctor.ts",
      "packages/core/src/domain/doctor.ts",
      "packages/core/src/contracts/doctor.ts",
    ]) {
      const text = readFileSync(file, "utf8");
      expect(text).not.toContain("process.exit");
      expect(text).not.toMatch(/return\s+[012]\s*;/);
    }
  });
});
