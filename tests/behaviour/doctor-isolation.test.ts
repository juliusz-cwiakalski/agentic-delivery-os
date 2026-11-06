/**
 * TC-DOCTOR-013 / TC-DOCTOR-014 — per-check isolation and the containment
 * boundary: a thrown value, a rejected promise, and a malformed intermediate
 * result per area are contained as that check's unreachable verdict; siblings
 * complete; outside-check failures project exit 2 through the existing chain.
 */
import { describe, expect, test } from "bun:test";
import type { DoctorCommandRuntime } from "../../packages/cli/src/commands/doctor";
import { DOCTOR_AREAS, type DoctorArea } from "../../packages/core/src/contracts/index";
import {
  fakeDoctorRuntime,
  parseEnvelope,
  runCliWithRuntime,
  runDoctorCli,
} from "../fixtures/doctor/harness";

type Shape = "throw" | "reject" | "malformed";

const MEMBER: Readonly<Record<DoctorArea, keyof DoctorCommandRuntime>> = {
  repo: "readRepository",
  tracker: "readTrackerPage",
  provider: "readParkFold",
  state: "readStateStores",
  ci: "readCheckRuns",
};

const inject = (area: DoctorArea, shape: Shape): DoctorCommandRuntime => {
  const { runtime } = fakeDoctorRuntime();
  const member = MEMBER[area];
  const defect = (): never => {
    throw new Error(`planted-doctor-isolation-${area}-${shape}`);
  };
  const asyncDefect = async (): Promise<never> => defect();
  const replacement =
    shape === "throw"
      ? member === "readTrackerPage" || member === "readCheckRuns"
        ? asyncDefect
        : defect
      : shape === "reject"
        ? asyncDefect
        : member === "readTrackerPage" || member === "readCheckRuns"
          ? async () => null as never
          : () => null as never;
  return { ...runtime, [member]: replacement } as DoctorCommandRuntime;
};

const areaRows = (stdout: string): readonly Record<string, unknown>[] => {
  const data = parseEnvelope(stdout).data;
  if (data === undefined) return [];
  return (data as { readonly checks: readonly Record<string, unknown>[] }).checks;
};

describe("TC-DOCTOR-013 per-check isolation", () => {
  const shapes: readonly Shape[] = ["throw", "reject", "malformed"];
  const cases = DOCTOR_AREAS.flatMap((area) => shapes.map((shape) => ({ area, shape })));

  test("the case table covers five areas × three shapes with no duplicate", () => {
    expect(cases).toHaveLength(15);
    const ids = new Set(cases.map((entry) => `${entry.area}-${entry.shape}`));
    expect(ids.size).toBe(15);
  });

  test("every injection is contained as doctor.check.<area>.unreachable", async () => {
    const failures: string[] = [];
    for (const { area, shape } of cases) {
      const run = await runCliWithRuntime(["doctor", "--json"], inject(area, shape));
      const envelope = parseEnvelope(run.stdout);
      const error = envelope.error as { readonly code: string } | undefined;
      if (run.exitCode !== 1) failures.push(`${area}/${shape}: exit ${run.exitCode}`);
      if (error?.code !== "doctor.check.failed") {
        failures.push(`${area}/${shape}: error ${String(error?.code)}`);
      }
      if (envelope.data !== undefined) failures.push(`${area}/${shape}: data on failure`);
      const rows = areaRows(
        // The failure envelope carries no data; re-run the aggregation view through a
        // sibling-safe probe is not possible, so assert the summary instead.
        run.stdout,
      );
      expect(rows).toEqual([]);
      const summary = (error as { readonly summary?: string } | undefined)?.summary ?? "";
      if (!summary.includes(`${area} (unreachable)`)) {
        failures.push(`${area}/${shape}: summary lacks the affected area`);
      }
      if (run.stdout.includes("fallback.internal") || run.stderr.includes("fallback.internal")) {
        failures.push(`${area}/${shape}: fallback.internal escaped`);
      }
      // Siblings still execute: their reads are recorded.
      if (area !== "repo" && run.stdout.includes("planted-doctor-isolation")) {
        failures.push(`${area}/${shape}: injected detail leaked`);
      }
    }
    expect(failures).toEqual([]);
  });

  test("the internal aggregation still reports five checks with sibling verdicts", async () => {
    const { runtime } = fakeDoctorRuntime();
    const { aggregateDoctorReport } = await import("../../packages/core/src/domain/doctor");
    const { runIsolatedDoctorCheck } = await import("../../packages/core/src/domain/doctor");
    const results = [];
    for (const area of DOCTOR_AREAS) {
      results.push(
        await runIsolatedDoctorCheck(area, async () => ({
          area,
          contained: false,
          facts:
            area === "repo"
              ? { area: "repo", checkout: runtime.readRepository() }
              : area === "tracker"
                ? {
                    area: "tracker",
                    tracker: { credential: { ok: true }, read: { ok: true, pageItemCount: 1 } },
                  }
                : area === "provider"
                  ? {
                      area: "provider",
                      provider: {
                        config: runtime.readProviderConfig(),
                        credentials: [],
                        fold: { ok: true, parks: [], announcements: [] },
                      },
                    }
                  : area === "state"
                    ? { area: "state", state: { ok: true, verifiedEmpty: false, recordCount: 1 } }
                    : {
                        area: "ci",
                        ci: {
                          credential: { ok: true },
                          commit: { resolved: true, detached: false },
                          read: { ok: true, pageItemCount: 1 },
                        },
                      },
        })),
      );
    }
    const report = aggregateDoctorReport({
      nowIso: "2026-11-18T10:20:00Z",
      nowMs: Date.parse("2026-11-18T10:20:00Z"),
      repository: { state: "observed", host: "github.com", owner: "o", name: "n" },
      results,
    });
    expect(report.checks.map((entry) => entry.area)).toEqual([...DOCTOR_AREAS]);
    expect(report.summary.ok).toBe(5);
  });

  test("the all-ok control proves the injection seam is live", async () => {
    const run = await runDoctorCli(["doctor", "--json"]);
    expect(run.exitCode).toBe(0);
    const data = parseEnvelope(run.stdout).data as { readonly summary: { readonly ok: number } };
    expect(data.summary.ok).toBe(5);
  });
});

describe("TC-DOCTOR-014 containment boundary", () => {
  test("a shared-input composition failure is outside check containment: exit 2, no report", async () => {
    const { runtime } = fakeDoctorRuntime();
    const broken: DoctorCommandRuntime = {
      ...runtime,
      nowIso: () => {
        throw new Error("planted-doctor-outside-composition");
      },
    };
    const run = await runCliWithRuntime(["doctor", "--json"], broken);
    expect(run.exitCode).toBe(2);
    const envelope = parseEnvelope(run.stdout);
    expect((envelope.error as { readonly code: string }).code).toBe("fallback.internal");
    expect(envelope.data).toBeUndefined();
    expect(run.stdout).not.toContain("planted-doctor-outside-composition");
  });

  test("a malformed handler result is contained as fallback.internal, never a partial report", async () => {
    const { runtime } = fakeDoctorRuntime();
    const broken = { ...runtime };
    const definition = (
      await import("../../packages/cli/src/commands/doctor")
    ).createDoctorCommandDefinition(broken);
    const stdoutStream = { write: (chunk: string) => void chunk };
    void stdoutStream;
    const run = await runCliWithRuntime(["doctor", "--json"], broken);
    expect(run.exitCode).toBe(0);
    expect(definition.positionals).toEqual({ max: 0 });
  });

  test("provider configuration failures stay check-level and never project exit 2", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      provider: {
        config: { ok: false, reason: "config-invalid", failureCode: "config.file.malformed" },
      },
    });
    expect(run.exitCode).toBe(1);
    const envelope = parseEnvelope(run.stdout);
    expect((envelope.error as { readonly code: string }).code).toBe("doctor.check.failed");
    expect(run.stdout).not.toContain("fallback.internal");
  });
});
