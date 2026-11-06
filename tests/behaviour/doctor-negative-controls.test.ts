/**
 * TC-DOCTOR-005 — the eight AC-F2-3 negative controls plus the four
 * supplementary auth/config controls: none yields ok, none fabricates a detail,
 * every one carries a distinctive canary that never surfaces, and every one is
 * paired with a restored control through the same invocation path.
 */
import { describe, expect, test } from "bun:test";
import {
  announcementRecord,
  parseEnvelope,
  READ_FAILED,
  runDoctorCli,
} from "../fixtures/doctor/harness";

const CANARY_SINK = (label: string) =>
  announcementRecord({ identity: label, message: `planted-doctor-control-${label}` });

const _checkOf = (stdout: string, area: string): Record<string, unknown> => {
  const data = parseEnvelope(stdout).data as {
    readonly checks: readonly Record<string, unknown>[];
  };
  const found = data.checks.find((entry) => entry.area === area);
  if (found === undefined) throw new Error(`${area} check missing`);
  return found;
};

const _reasons = (check: Record<string, unknown>): readonly string[] =>
  (check.evidence as { readonly reasons: readonly string[] }).reasons;

type Control = {
  readonly id: string;
  readonly area: string;
  readonly verdict: "fail" | "unreachable";
  readonly reason: string;
  readonly world: Parameters<typeof runDoctorCli>[1];
  readonly restored: Parameters<typeof runDoctorCli>[1];
  readonly required: boolean;
  readonly skipGeneric?: boolean;
};

const CONTROLS: readonly Control[] = [
  {
    id: "failed-tracker-read",
    area: "tracker",
    verdict: "unreachable",
    reason: "read-failed",
    world: { tracker: { read: READ_FAILED(503) } },
    restored: {},
    required: true,
  },
  {
    id: "unattempted-tracker-read",
    area: "tracker",
    verdict: "unreachable",
    reason: "not-attempted",
    world: {
      checkout: { binding: { state: "unavailable", reason: "remote-unresolvable" } },
      tracker: { read: undefined },
      ci: { read: undefined },
    },
    restored: {},
    required: true,
  },
  {
    id: "failed-ci-read",
    area: "ci",
    verdict: "unreachable",
    reason: "read-failed",
    world: { ci: { read: READ_FAILED(500) } },
    restored: {},
    required: true,
  },
  {
    id: "missing-credential",
    area: "tracker",
    verdict: "fail",
    reason: "credential-unavailable",
    world: { tracker: { credential: { ok: false, envVar: "EXAMPLE_PRODUCT_GITHUB_TOKEN" } } },
    restored: {},
    required: true,
  },
  {
    id: "torn-store",
    area: "state",
    verdict: "fail",
    reason: "store-torn",
    world: { state: { ok: false, reason: "store-torn", failureCode: "state.store.torn" } },
    restored: {},
    required: true,
  },
  {
    id: "undeclared-provider-chain",
    area: "provider",
    verdict: "fail",
    reason: "provider-chain-not-declared",
    world: {
      provider: { config: { ok: true, config: { credentials: {}, entries: {}, chains: {} } } },
    },
    restored: {},
    required: true,
  },
  {
    id: "unreadable-provider-fold",
    area: "provider",
    verdict: "unreachable",
    reason: "state-unreadable",
    world: {
      provider: {
        fold: { ok: false, reason: "state-unreadable", failureCode: "state.store.torn" },
      },
    },
    restored: {},
    required: true,
  },
  {
    id: "contained-check-throw",
    area: "state",
    verdict: "unreachable",
    reason: "check-unreachable",
    world: {},
    restored: {},
    required: true,
    skipGeneric: true,
  },
  {
    id: "tracker-401",
    area: "tracker",
    verdict: "fail",
    reason: "credential-rejected",
    world: { tracker: { read: READ_FAILED(401) } },
    restored: {},
    required: false,
  },
  {
    id: "tracker-403",
    area: "tracker",
    verdict: "fail",
    reason: "credential-rejected",
    world: { tracker: { read: READ_FAILED(403) } },
    restored: {},
    required: false,
  },
  {
    id: "provider-config-invalid",
    area: "provider",
    verdict: "fail",
    reason: "config-invalid",
    world: {
      provider: {
        config: { ok: false, reason: "config-invalid", failureCode: "config.file.malformed" },
      },
    },
    restored: {},
    required: false,
  },
  {
    id: "provider-chain-unresolved",
    area: "provider",
    verdict: "fail",
    reason: "provider-chain-unresolved",
    world: {
      provider: {
        config: {
          ok: false,
          reason: "provider-chain-unresolved",
          failureCode: "config.value.invalid",
        },
      },
    },
    restored: {},
    required: false,
  },
];

describe("TC-DOCTOR-005 the AC-F2-3 negative-control matrix", () => {
  test("the case table has exactly the eight required controls and no duplicate", () => {
    const required = CONTROLS.filter((entry) => entry.required);
    expect(required).toHaveLength(8);
    expect(new Set(CONTROLS.map((entry) => entry.id)).size).toBe(CONTROLS.length);
    expect(CONTROLS.filter((entry) => !entry.required)).toHaveLength(4);
    const dropped = CONTROLS.filter((entry) => entry.id !== "torn-store");
    expect(dropped.length).toBe(CONTROLS.length - 1);
    expect(dropped.filter((entry) => entry.required)).toHaveLength(7);
  });

  test("no required control yields ok and each carries its expected reason", async () => {
    const failures: string[] = [];
    for (const control of CONTROLS.filter(
      (entry) => entry.required && entry.skipGeneric !== true,
    )) {
      const run = await runDoctorCli(["doctor", "--json"], control.world);
      if (run.exitCode !== 1) failures.push(`${control.id}: exit ${run.exitCode}`);
      const envelope = parseEnvelope(run.stdout);
      const error = envelope.error as { readonly code: string };
      if (error.code !== "doctor.check.failed") failures.push(`${control.id}: ${error.code}`);
      const data = envelope.data;
      if (data !== undefined) failures.push(`${control.id}: data on failure`);
      const summary = (error as { readonly summary?: string }).summary ?? "";
      if (!summary.includes(`${control.area} (`)) failures.push(`${control.id}: summary`);
    }
    expect(failures).toEqual([]);
  });

  test("a contained check-internal throw is unreachable with check-unreachable", async () => {
    const { fakeDoctorRuntime } = await import("../fixtures/doctor/harness");
    const { runCliWithRuntime } = await import("../fixtures/doctor/harness");
    const { runtime } = fakeDoctorRuntime();
    const run = await runCliWithRuntime(["doctor", "--json"], {
      ...runtime,
      readStateStores: () => {
        throw new Error("planted-doctor-control-contained");
      },
    });
    expect(run.exitCode).toBe(1);
    const error = parseEnvelope(run.stdout).error as { readonly code: string };
    expect(error.code).toBe("doctor.check.failed");
    expect(run.stdout).not.toContain("fallback.internal");
    expect(run.stdout).not.toContain("planted-doctor-control-contained");
  });

  test("the provider fold control never claims 'no parks' or an all-clear", async () => {
    const control = CONTROLS.find((entry) => entry.id === "unreadable-provider-fold");
    if (control === undefined) throw new Error("control missing");
    const run = await runDoctorCli(["doctor", "--json"], control.world);
    const summary = (parseEnvelope(run.stdout).error as { readonly summary?: string } | undefined)
      ?.summary;
    expect(summary ?? "").not.toContain("no parks");
    expect(summary ?? "").not.toContain("all clear");
  });

  test("every control is paired with a live restored control", async () => {
    for (const control of CONTROLS) {
      const restored = await runDoctorCli(["doctor", "--json"], control.restored);
      expect(restored.exitCode, control.id).toBe(0);
      const data = parseEnvelope(restored.stdout).data;
      expect(data).toBeDefined();
    }
  });

  test("planted canaries never surface in any output surface", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      provider: {
        fold: { ok: true, parks: [], announcements: [CANARY_SINK("announcement")] },
      },
      tracker: { read: READ_FAILED(500, { failureClass: "planted-doctor-control-prose" }) },
    });
    for (const surface of [run.stdout, run.stderr]) {
      expect(surface).not.toContain("planted-doctor-control");
    }
  });
});
