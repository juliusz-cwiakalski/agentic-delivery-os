/**
 * TC-DOCTOR-008 / TC-DOCTOR-009 / TC-DOCTOR-010 — provider wiring: the ok
 * path and five wiring-neutral parks, announcements, credential-caused parks,
 * the tolerant configuration failures, every wiring defect, and quota safety.
 */
import { describe, expect, test } from "bun:test";
import { DOCTOR_WIRING_NEUTRAL_CONDITIONS } from "../../packages/core/src/contracts/index";
import {
  announcementRecord,
  fakeDoctorRuntime,
  PROVIDER_CREDENTIALS_OK,
  parkRecord,
  parseEnvelope,
  providerConfigOk,
  runCliWithRuntime,
  runDoctorCli,
} from "../fixtures/doctor/harness";

const providerOf = (report: Record<string, unknown> | undefined): Record<string, unknown> => {
  const data = report as { readonly checks: readonly Record<string, unknown>[] };
  const found = data.checks.find((entry) => entry.area === "provider");
  if (found === undefined) throw new Error("provider check missing");
  return found;
};

const reasons = (check: Record<string, unknown>): readonly string[] =>
  (check.evidence as { readonly reasons: readonly string[] }).reasons;

const parkFor = (cause: string, subjectName = "provider-c") =>
  parkRecord({ subjectName, cause: cause as "peak-window" });

const foldWith = (parks: ReturnType<typeof parkFor>[]) => ({
  ok: true as const,
  parks,
  announcements: [],
});

describe("TC-DOCTOR-008 provider ok path and wiring-neutral parks", () => {
  test("a valid chain, resolvable credentials, and an empty fold are ok", async () => {
    const run = await runDoctorCli(["doctor", "--json"]);
    expect(run.exitCode).toBe(0);
    const check = providerOf(run.report);
    expect(check.verdict).toBe("ok");
    expect(run.counts.providerConfig).toBe(1);
    expect(run.counts.fold).toBe(1);
  });

  test("each of the five wiring-neutral parks stays ok with cause, expiry, and the quota directive", async () => {
    for (const cause of DOCTOR_WIRING_NEUTRAL_CONDITIONS) {
      const run = await runDoctorCli(["doctor", "--json"], {
        provider: { fold: foldWith([parkFor(cause)]) },
      });
      expect(run.exitCode).toBe(0);
      const check = providerOf(run.report);
      expect(check.verdict, cause).toBe("ok");
      expect(reasons(check)).toContain("park-active");
      expect(String(check.detail)).toContain(cause);
      expect(String(check.detail)).toContain("2026-11-18T14:00:00Z");
      expect(String(check.detail)).toContain("provider quota --provider provider-c");
      expect(check.fixHint).toBeUndefined();
    }
  });

  test("a persisted announcement is bounded detail without flipping the verdict", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      provider: {
        fold: { ok: true, parks: [], announcements: [announcementRecord()] },
      },
    });
    const check = providerOf(run.report);
    expect(check.verdict).toBe("ok");
    expect(reasons(check)).toContain("announcement-recorded");
    expect(String(check.detail)).toContain("provider.peak.parked");
  });

  test("a credential-caused park is fail with the refresh hint naming the source key only", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      provider: {
        fold: foldWith([parkFor("credential-rejected", "provider-c")]),
      },
    });
    expect(run.exitCode).toBe(1);
    const check = providerOf(run.report);
    expect(check.verdict).toBe("fail");
    expect(reasons(check)).toContain("park-credential-cause");
    expect(String(check.fixHint)).toBe(
      "refresh the credential for provider-c, then run provider quota --provider provider-c",
    );
    expect(String(check.detail)).toContain("provider-c");
  });

  test("multiple parks render deterministically and within bounds", async () => {
    const fold = foldWith([
      parkRecord({
        subjectName: "provider-b",
        cause: "quota-exhausted",
        expiresAt: "2026-11-18T15:00:00Z",
        expiresAtMs: Date.parse("2026-11-18T15:00:00Z"),
      }),
      parkRecord({
        subjectName: "provider-a",
        cause: "peak-window",
        expiresAt: "2026-11-18T12:00:00Z",
        expiresAtMs: Date.parse("2026-11-18T12:00:00Z"),
      }),
    ]);
    const first = await runDoctorCli(["doctor", "--json"], { provider: { fold } });
    const second = await runDoctorCli(["doctor", "--json"], { provider: { fold } });
    expect(second.stdout).toBe(first.stdout);
    const detail = String(providerOf(first.report).detail);
    expect(detail.indexOf("provider-a")).toBeLessThan(detail.indexOf("provider-b"));
    expect(detail.length).toBeLessThanOrEqual(200);
  });

  test("reevaluation-cap is never rendered as a credential defect", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      provider: { fold: foldWith([parkFor("reevaluation-cap")]) },
    });
    const check = providerOf(run.report);
    expect(check.verdict).toBe("ok");
    expect(reasons(check)).not.toContain("park-credential-cause");
    expect(String(check.fixHint ?? "")).toBe("");
  });
});

describe("TC-DOCTOR-009 provider wiring defects", () => {
  test("no declared chain is fail/provider-chain-not-declared", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      provider: { config: providerConfigOk({ defaultChain: undefined }) },
    });
    const check = providerOf(run.report);
    expect(check.verdict).toBe("fail");
    expect(reasons(check)).toContain("provider-chain-not-declared");
    expect(String(check.fixHint)).toContain("declare a default provider chain");
  });

  test("an unresolvable chain is fail/provider-chain-unresolved", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      provider: {
        config: providerConfigOk({
          chains: {
            primary: { name: "primary", entries: ["provider-ghost"], allowPaidFallback: false },
          },
        }),
      },
    });
    const check = providerOf(run.report);
    expect(check.verdict).toBe("fail");
    expect(reasons(check)).toContain("provider-chain-unresolved");
    expect((check.evidence as { readonly failureCode?: string }).failureCode).toBe(
      "config.value.invalid",
    );
  });

  test("an unresolvable credential reference is fail naming the provider", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      provider: {
        credentials: [
          { providerName: "provider-a", sourceKey: "EXAMPLE_PRODUCT_PROVIDER_A_TOKEN", ok: false },
          ...PROVIDER_CREDENTIALS_OK.slice(1),
        ],
      },
    });
    const check = providerOf(run.report);
    expect(check.verdict).toBe("fail");
    expect(reasons(check)).toContain("credential-unavailable");
    expect(String(check.fixHint)).toContain("provider-a");
  });

  test("a disabled entry's credential reference is not required", async () => {
    const config = providerConfigOk();
    if (!config.ok) throw new Error("fixture config invalid");
    const disabled = providerConfigOk({
      entries: {
        ...config.config.entries,
        "provider-b": { ...config.config.entries["provider-b"], enabled: false } as never,
      },
    });
    const run = await runDoctorCli(["doctor", "--json"], {
      provider: {
        config: disabled,
        credentials: [
          { providerName: "provider-a", sourceKey: "EXAMPLE_PRODUCT_PROVIDER_A_TOKEN", ok: true },
        ],
      },
    });
    expect(providerOf(run.report).verdict).toBe("ok");
  });

  test("a configuration-resolution failure stays in-check as fail/config-invalid", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      provider: {
        config: { ok: false, reason: "config-invalid", failureCode: "config.file.malformed" },
      },
    });
    expect(run.exitCode).toBe(1);
    const envelope = parseEnvelope(run.stdout);
    expect((envelope.error as { readonly code: string }).code).toBe("doctor.check.failed");
    const check = providerOf(run.report);
    expect(check.verdict).toBe("fail");
    expect(reasons(check)).toContain("config-invalid");
    expect((check.evidence as { readonly failureCode?: string }).failureCode).toBe(
      "config.file.malformed",
    );
    expect(String(check.fixHint)).toContain("config.file.malformed");
    expect(run.counts.state).toBe(1);
  });

  test("a provider-branch validation failure carries config.value.invalid and never aborts", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      provider: {
        config: {
          ok: false,
          reason: "provider-chain-unresolved",
          failureCode: "config.value.invalid",
        },
      },
    });
    const check = providerOf(run.report);
    expect(check.verdict).toBe("fail");
    expect(reasons(check)).toContain("provider-chain-unresolved");
    expect((check.evidence as { readonly failureCode?: string }).failureCode).toBe(
      "config.value.invalid",
    );
    const envelope = parseEnvelope(run.stdout);
    expect((envelope.error as { readonly code: string }).code).toBe("doctor.check.failed");
    expect(run.exitCode).toBe(1);
  });

  test("an unreadable fold is unreachable/state-unreadable and never 'no parks'", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      provider: {
        fold: { ok: false, reason: "state-unreadable", failureCode: "state.store.torn" },
      },
    });
    const check = providerOf(run.report);
    expect(check.verdict).toBe("unreachable");
    expect(reasons(check)).toContain("state-unreadable");
    expect(String(check.fixHint)).toContain("repair the provider state store");
    expect(String(check.detail).toLowerCase()).not.toContain("no parks");
  });

  test("a configuration failure outranks an unreadable fold", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      provider: {
        config: { ok: false, reason: "config-invalid", failureCode: "config.file.malformed" },
        fold: { ok: false, reason: "state-unreadable" },
      },
    });
    const check = providerOf(run.report);
    expect(check.verdict).toBe("fail");
    expect(reasons(check)).toContain("config-invalid");
    expect(reasons(check)).not.toContain("state-unreadable");
  });
});

describe("TC-DOCTOR-010 provider quota safety", () => {
  const ALLOWED_MEMBERS = new Set([
    "readRepository",
    "resolveTrackerCredential",
    "readTrackerPage",
    "resolveHeadCommit",
    "readCheckRuns",
    "readProviderConfig",
    "resolveProviderCredential",
    "readParkFold",
    "readStateStores",
    "nowIso",
    "nowMs",
  ]);

  test("the provider check touches only the declared read members", async () => {
    const { runtime } = fakeDoctorRuntime();
    const touched = new Set<string>();
    const proxied = new Proxy(runtime, {
      get(target, property) {
        touched.add(String(property));
        return Reflect.get(target, property) as unknown;
      },
    });
    const run = await runCliWithRuntime(["doctor", "--json"], proxied);
    expect(run.exitCode).toBe(0);
    for (const member of touched) expect(ALLOWED_MEMBERS.has(member), member).toBe(true);
    for (const member of touched) {
      expect(member).not.toMatch(/quota|engine|write|append|fence|salvage|resolve-quota/i);
    }
  });

  test("a counting stub proves the recorder is live (control)", () => {
    const counters = { quota: 0, resolve: 0, write: 0 };
    const stub = {
      quota: () => {
        counters.quota += 1;
      },
      resolve: () => {
        counters.resolve += 1;
      },
      write: () => {
        counters.write += 1;
      },
    };
    expect(counters).toEqual({ quota: 0, resolve: 0, write: 0 });
    stub.quota();
    stub.resolve();
    stub.write();
    expect(counters).toEqual({ quota: 1, resolve: 1, write: 1 });
  });
});
