/**
 * TC-DOCTOR-001 — `doctor` runs with no positionals and no command flags, the
 * parser rejects extra input before any read, `--json` is the global output
 * switch, and the handler is write-free and exit-free.
 */
import { describe, expect, test } from "bun:test";
import { DOCTOR_AREAS } from "../../packages/core/src/contracts/index";
import {
  doctorProgram,
  fakeDoctorRuntime,
  parseEnvelope,
  runDoctorCli,
} from "../fixtures/doctor/harness";
import { SYNTHETIC_BRAND } from "../golden/helpers";

const envelopeData = (stdout: string): Record<string, unknown> => {
  const envelope = parseEnvelope(stdout);
  return envelope.data as Record<string, unknown>;
};

describe("TC-DOCTOR-001 command surface", () => {
  test("the definition declares no flags and zero positionals", () => {
    const { runtime } = fakeDoctorRuntime();
    const definition = doctorProgram(runtime);
    expect(definition.flags).toEqual([]);
    expect(definition.positionals).toEqual({ max: 0 });
    expect(definition.humanText).toBeDefined();
    expect(definition.exitProjection).toBeUndefined();
  });

  test("doctor runs all five checks once and returns one human report", async () => {
    const run = await runDoctorCli(["doctor"]);
    expect(run.exitCode).toBe(0);
    expect(run.stderr).toBe("");
    const lines = run.stdout.trimEnd().split("\n");
    expect(lines).toHaveLength(1 + 5);
    expect(lines.slice(1).map((line) => line.split(/\s+/)[0])).toEqual([...DOCTOR_AREAS]);
    expect(run.counts.repo).toBe(1);
    expect(run.counts.tracker).toBe(1);
    expect(run.counts.ci).toBe(1);
  });

  test("--json emits exactly one envelope with the five-check report", async () => {
    const run = await runDoctorCli(["doctor", "--json"]);
    expect(run.exitCode).toBe(0);
    const envelope = parseEnvelope(run.stdout);
    expect(Object.keys(envelope).sort()).toEqual([
      "data",
      "exitCode",
      "runId",
      "schemaVersion",
      "timing",
    ]);
    const data = envelopeData(run.stdout);
    expect(data.schemaVersion).toBe("delivery.doctor.v1");
    const checks = data.checks as readonly { readonly area: string }[];
    expect(checks.map((entry) => entry.area)).toEqual([...DOCTOR_AREAS]);
    expect(run.stderr).toBe("");
  });

  test("an extra positional is rejected before any source read", async () => {
    const run = await runDoctorCli(["doctor", "extra", "--json"]);
    expect(run.exitCode).toBe(1);
    const envelope = parseEnvelope(run.stdout);
    expect((envelope.error as { readonly code: string }).code).toBe("fallback.invocation");
    expect(envelope.data).toBeUndefined();
    expect(Object.values(run.counts).every((count) => count === 0)).toBe(true);
  });

  test("--fix-hints and an unknown flag are rejected with zero reads", async () => {
    for (const argv of [
      ["doctor", "--fix-hints", "--json"],
      ["doctor", "--json", "--fix-hints"],
      ["doctor", "--limit", "5", "--json"],
    ]) {
      const run = await runDoctorCli(argv);
      expect(run.exitCode).toBe(1);
      const envelope = parseEnvelope(run.stdout);
      expect((envelope.error as { readonly code: string }).code).toBe("fallback.invocation");
      expect(envelope.data).toBeUndefined();
      expect(Object.values(run.counts).every((count) => count === 0)).toBe(true);
    }
  });

  test("the handler returns data or a classified failure without exit choices", async () => {
    const { runtime } = fakeDoctorRuntime();
    const definition = doctorProgram(runtime);
    const ok = await definition.handler({
      command: "doctor",
      flags: {},
      argv: ["doctor"],
      positionals: [],
      brand: SYNTHETIC_BRAND,
    });
    expect(ok).toHaveProperty("data");

    const failing = fakeDoctorRuntime({ checkout: { clean: false } });
    const failed = await doctorProgram(failing.runtime).handler({
      command: "doctor",
      flags: {},
      argv: ["doctor"],
      positionals: [],
      brand: SYNTHETIC_BRAND,
    });
    expect(failed).toHaveProperty("error");
    expect(failed).not.toHaveProperty("data");
    const error = (failed as { readonly error: { readonly code: string; readonly kind: string } })
      .error;
    expect(error.kind).toBe("doctor");
    expect(error.code).toBe("doctor.check.failed");
  });

  test("a failing check yields the classified error envelope, exit 1, no data", async () => {
    const run = await runDoctorCli(["doctor", "--json"], { checkout: { clean: false } });
    expect(run.exitCode).toBe(1);
    const envelope = parseEnvelope(run.stdout);
    expect(envelope.data).toBeUndefined();
    const error = envelope.error as { readonly code: string; readonly summary?: string };
    expect(error.code).toBe("doctor.check.failed");
    expect(error.summary ?? "").toContain("repo (fail)");
    expect(error.summary ?? "").toContain("commit or discard the uncommitted changes");
  });

  test("positive control after rejections returns the five-check report", async () => {
    await runDoctorCli(["doctor", "extra", "--json"]);
    const run = await runDoctorCli(["doctor", "--json"]);
    expect(run.exitCode).toBe(0);
    const data = envelopeData(run.stdout);
    expect((data.checks as readonly unknown[]).length).toBe(5);
  });
});
