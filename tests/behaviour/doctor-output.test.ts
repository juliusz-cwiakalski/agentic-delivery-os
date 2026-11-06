/**
 * TC-DOCTOR-018 / TC-DOCTOR-019 / TC-DOCTOR-026 — one valid envelope on every
 * outcome, bounded machine/human output, and the text/evidence caps.
 */
import { describe, expect, test } from "bun:test";
import {
  DOCTOR_MAX_DETAIL_CHARS,
  DOCTOR_MAX_HUMAN_BYTES,
  DOCTOR_MAX_HUMAN_LINES,
  DOCTOR_MAX_MACHINE_BYTES,
} from "../../packages/core/src/contracts/index";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import {
  fakeDoctorRuntime,
  parseEnvelope,
  READ_FAILED,
  runCliWithRuntime,
  runDoctorCli,
} from "../fixtures/doctor/harness";

const envelopeFailures = (stdout: string): readonly string[] => {
  const parsed: unknown = JSON.parse(stdout.trim());
  return assertEnvelopeContract(parsed as never);
};

describe("TC-DOCTOR-018 machine output", () => {
  test("every outcome emits exactly one valid envelope", async () => {
    const runs = [
      await runDoctorCli(["doctor", "--json"]),
      await runDoctorCli(["doctor", "--json"], { checkout: { clean: false } }),
      await runDoctorCli(["doctor", "--json"], { tracker: { read: READ_FAILED(500) } }),
      await runDoctorCli(["doctor", "--json"], { checkout: { readable: false } }),
      await runDoctorCli(["doctor", "--json"], { tracker: { credential: { ok: false } } }),
    ];
    for (const run of runs) {
      expect(run.stdout.trim().split("\n\n")).toHaveLength(1);
      expect(envelopeFailures(run.stdout)).toEqual([]);
      expect(run.stderr.trimStart().startsWith("{")).toBe(false);
    }
  });

  test("success data is bounded at 64 KiB and the cap-sized report stays under", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      checkout: { branch: "b".repeat(5000) },
      tracker: { read: { ok: true, pageItemCount: 50 } },
    });
    const data = parseEnvelope(run.stdout).data;
    const bytes = Buffer.byteLength(JSON.stringify(data), "utf8");
    expect(bytes).toBeLessThanOrEqual(DOCTOR_MAX_MACHINE_BYTES);
    expect(DOCTOR_MAX_MACHINE_BYTES).toBe(65536);
  });

  test("an over-limit synthetic report demonstrates the bound is meaningful", async () => {
    const oversized = {
      schemaVersion: "delivery.doctor.v1",
      generatedAt: "2026-11-18T10:20:00Z",
      repository: {},
      checks: Array.from({ length: 5 }, () => ({ detail: "x".repeat(20000) })),
      summary: { total: 5, ok: 5, fail: 0, unreachable: 0 },
    };
    expect(Buffer.byteLength(JSON.stringify(oversized), "utf8")).toBeGreaterThan(
      DOCTOR_MAX_MACHINE_BYTES,
    );
  });
});

describe("TC-DOCTOR-019 human report", () => {
  test("an all-ok report is one line per check with no hint lines", async () => {
    const run = await runDoctorCli(["doctor"]);
    const lines = run.stdout.trimEnd().split("\n");
    expect(lines).toHaveLength(1 + 5);
    expect(lines.some((line) => line.includes("hint:"))).toBe(false);
    expect(lines[0]).toBe("example-product doctor example-owner/example-repo");
  });

  test("a mixed report adds exactly one indented hint per non-ok check and the summary", async () => {
    const run = await runDoctorCli(["doctor"], {
      checkout: { clean: false },
      tracker: { read: READ_FAILED(500) },
    });
    const lines = run.stdout.trimEnd().split("\n");
    expect(lines.filter((line) => line.startsWith("  hint:"))).toHaveLength(2);
    expect(run.stderr).toContain("doctor check failures (2/5)");
  });

  test("the human report is bounded at 24 lines and 4096 bytes", async () => {
    const run = await runDoctorCli(["doctor"], {
      checkout: { clean: false, branch: "b".repeat(5000) },
      tracker: { credential: { ok: false, envVar: "E".repeat(300) } },
      provider: { config: { ok: false, reason: "config-invalid", failureCode: "c".repeat(300) } },
      state: { ok: false, reason: "store-torn" },
      ci: { commit: { resolved: false, detached: true } },
    });
    const lines = run.stdout.trimEnd().split("\n");
    expect(lines.length).toBeLessThanOrEqual(DOCTOR_MAX_HUMAN_LINES);
    expect(Buffer.byteLength(run.stdout, "utf8")).toBeLessThanOrEqual(DOCTOR_MAX_HUMAN_BYTES);
    expect(lines).toHaveLength(1 + 5 + 5);
  });

  test("human and --json modes perform the same reads", async () => {
    const human = await runDoctorCli(["doctor"]);
    const json = await runDoctorCli(["doctor", "--json"]);
    expect(human.counts).toEqual(json.counts);
  });

  test("the human report never invents a check or a verdict", async () => {
    const run = await runDoctorCli(["doctor"]);
    const areas = run.stdout
      .trimEnd()
      .split("\n")
      .slice(1)
      .map((line) => line.split(/\s+/)[0]);
    expect(areas).toEqual(["repo", "tracker", "provider", "state", "ci"]);
    expect(run.stdout).not.toContain("all clear");
  });
});

describe("TC-DOCTOR-026 text bounds and evidence caps", () => {
  test("a long detail is deterministically bounded at 200 characters", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      checkout: { branch: "b".repeat(5000) },
    });
    const data = parseEnvelope(run.stdout).data as {
      readonly checks: readonly { readonly area: string; readonly detail: string }[];
    };
    const repo = data.checks.find((entry) => entry.area === "repo");
    expect(repo?.detail.length).toBeLessThanOrEqual(DOCTOR_MAX_DETAIL_CHARS);
    expect(repo?.detail.length).toBe(DOCTOR_MAX_DETAIL_CHARS);
  });

  test("multi-byte text is clamped without splitting a code point", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      checkout: { branch: "🚀".repeat(500) },
    });
    const data = parseEnvelope(run.stdout).data as {
      readonly checks: readonly { readonly area: string; readonly detail: string }[];
    };
    const detail = data.checks.find((entry) => entry.area === "repo")?.detail ?? "";
    expect(detail).not.toContain("\uFFFD");
    expect(Array.from(detail).length).toBeLessThanOrEqual(DOCTOR_MAX_DETAIL_CHARS);
  });

  test("every check has at most four unique sources and four unique reasons", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      provider: { credentials: [{ providerName: "provider-a", sourceKey: "S", ok: false }] },
    });
    const data = run.report as {
      readonly checks: readonly {
        readonly evidence: {
          readonly sources: readonly { readonly source: string }[];
          readonly reasons: readonly string[];
        };
      }[];
    };
    for (const check of data.checks) {
      expect(check.evidence.sources.length).toBeLessThanOrEqual(4);
      expect(new Set(check.evidence.sources.map((entry) => entry.source)).size).toBe(
        check.evidence.sources.length,
      );
      expect(check.evidence.reasons.length).toBeLessThanOrEqual(4);
      expect(new Set(check.evidence.reasons).size).toBe(check.evidence.reasons.length);
    }
  });

  test("no raw payload, credential, or planted secret appears in output", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      tracker: { read: READ_FAILED(500, { failureClass: "planted-doctor-secret-canary" }) },
    });
    expect(run.stdout).not.toContain("planted-doctor-secret-canary");
    expect(run.stderr).not.toContain("planted-doctor-secret-canary");
  });

  test("the recorder remains live (control)", async () => {
    const { runtime } = fakeDoctorRuntime();
    let reads = 0;
    const counted = {
      ...runtime,
      readStateStores: () => {
        reads += 1;
        return runtime.readStateStores();
      },
    };
    const run = await runCliWithRuntime(["doctor", "--json"], counted);
    expect(run.exitCode).toBe(0);
    expect(reads).toBe(1);
  });
});
