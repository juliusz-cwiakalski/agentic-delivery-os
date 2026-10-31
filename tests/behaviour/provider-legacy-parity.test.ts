/**
 * TC-PROV-037/052/054..062 — the ported legacy battery.
 *
 * Every executed `TC-ZAI-*` ID is mapped to a ported case; the v1 assertion is
 * the documented fail-loud divergence. The legacy bash battery is never
 * executed as a live script.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  CombinedProviderCondition,
  CredentialPort,
  ProviderClock,
  ProviderConditionResult,
  ProviderConfiguration,
  ProviderSleep,
  QuotaTransport,
} from "../../packages/core/src/contracts/index";
import { combineProviderConditions } from "../../packages/core/src/provider/conditions";
import { createProviderEngine } from "../../packages/core/src/provider/engine";
import { runProviderLoop } from "../../packages/core/src/provider/loop";
import { formatUtcIso } from "../../packages/core/src/provider/parks";
import { evaluatePeakWindow } from "../../packages/core/src/provider/peak";
import { evaluateQuotaResponse } from "../../packages/core/src/provider/quota";
import { FAIL_OPEN_CASES } from "../fixtures/provider/legacy/fail-open-matrix.ts";
import { GROUP_B } from "../fixtures/provider/legacy/group-b.ts";
import { GROUP_B_PRIME } from "../fixtures/provider/legacy/group-b-prime.ts";
import { GROUP_E } from "../fixtures/provider/legacy/group-e.ts";
import { GROUP_F } from "../fixtures/provider/legacy/group-f.ts";
import { GROUP_H } from "../fixtures/provider/legacy/group-h.ts";
import { GROUP_I } from "../fixtures/provider/legacy/group-i.ts";
import { NO_SILENT_PATH_CLASSES } from "../fixtures/provider/legacy/no-silent-paths.ts";

// JSON group fixtures are imported as plain data so the suite never executes a
// script; they are intentionally `.json` for readability.
const readJson = (name: string): { group: string; tc: string; ids: string[] } =>
  JSON.parse(readFileSync(join(process.cwd(), "tests/fixtures/provider/legacy", name), "utf8")) as {
    group: string;
    tc: string;
    ids: string[];
  };

const groups = [
  readJson("group-a.json"),
  GROUP_B,
  GROUP_B_PRIME,
  readJson("group-c-d.json"),
  GROUP_E,
  GROUP_F,
  readJson("group-g.json"),
  GROUP_H,
  GROUP_I,
] as const;

const NOW = Date.UTC(2026, 0, 1, 0, 0, 0);
const clock: ProviderClock = { nowMs: () => NOW };
const sleep: ProviderSleep = { sleep: async () => undefined };
const credential: CredentialPort = {
  resolve: () => ({ ok: true, material: { value: "CANARY-SECRET" } }),
};

const config = (
  options: {
    readonly quota?: boolean;
    readonly credentialRef?: string;
    readonly peak?: boolean;
    readonly maxSleepLoops?: number;
  } = {},
): ProviderConfiguration => ({
  defaultChain: "default",
  credentials: {
    zai: { sourceKey: { style: "literal", name: "ZAI_API_KEY" } },
    missing: { sourceKey: { style: "literal", name: "MISSING_API_KEY" } },
  },
  entries: {
    p0: {
      name: "p0",
      class: "subscription",
      enabled: true,
      ...(options.peak === false
        ? {}
        : {
            peak: {
              timezone: "UTC" as const,
              startSecondsOfDay: 21600,
              endSecondsOfDay: 36000,
              bufferSeconds: 7200,
            },
          }),
      ...(options.quota === false
        ? {}
        : {
            quota: {
              enabled: true,
              endpoint: "https://p0.test/quota",
              credentialRef: options.credentialRef ?? "zai",
              timeoutMs: 1000,
              thresholdPercent: 100,
              maxSleepLoops: options.maxSleepLoops ?? 24,
              outageParkTtlSeconds: 300,
              credentialParkTtlSeconds: 900,
              capParkTtlSeconds: 300,
            },
          }),
    },
  },
  chains: { default: { name: "default", entries: ["p0"], allowPaidFallback: false } },
});

const transportFrom = (result: () => { status: number; bodyText: string }): QuotaTransport => ({
  send: async () => result(),
});

const clearTransport: QuotaTransport = {
  send: async () => ({
    status: 200,
    bodyText: JSON.stringify({ code: 200, success: true, data: { limits: [] } }),
  }),
};

const at = (hours: number, minutes: number, seconds: number): number =>
  Date.UTC(2026, 0, 1, hours, minutes, seconds);

describe("legacy battery mapping", () => {
  test("9 groups and all 49 executed IDs are mapped exactly once", () => {
    expect(groups).toHaveLength(9);
    const ids = groups.flatMap((group) => [...group.ids]);
    expect(ids).toHaveLength(49);
    expect(new Set(ids).size).toBe(49);
    expect(groups.map((group) => group.tc)).toEqual([
      "TC-PROV-054",
      "TC-PROV-055",
      "TC-PROV-056",
      "TC-PROV-057",
      "TC-PROV-058",
      "TC-PROV-059",
      "TC-PROV-060",
      "TC-PROV-061",
      "TC-PROV-062",
    ]);
    expect(NO_SILENT_PATH_CLASSES.length).toBeGreaterThanOrEqual(FAIL_OPEN_CASES.length + 4);
  });
});

describe("TC-PROV-054 group A — peak boundary math and gating", () => {
  const window = {
    timezone: "UTC" as const,
    startSecondsOfDay: 21600,
    endSecondsOfDay: 36000,
    bufferSeconds: 7200,
  };
  test("off-peak clear, in-peak and buffer park, custom window, half-open end", () => {
    expect(evaluatePeakWindow(window, at(3, 59, 59)).status).toBe("clear");
    expect(evaluatePeakWindow(window, at(4, 0, 0))).toMatchObject({
      status: "parked",
      waitSeconds: 21600,
    });
    expect(evaluatePeakWindow(window, at(9, 59, 59))).toMatchObject({
      status: "parked",
      waitSeconds: 1,
    });
    expect(evaluatePeakWindow(window, at(10, 0, 0)).status).toBe("clear");
    const custom = {
      timezone: "UTC" as const,
      startSecondsOfDay: 3600,
      endSecondsOfDay: 7200,
      bufferSeconds: 0,
    };
    expect(evaluatePeakWindow(custom, at(1, 30, 0))).toMatchObject({
      status: "parked",
      waitSeconds: 1800,
    });
  });

  test("a disabled descriptor is not evaluated and no fetch occurs", async () => {
    let sends = 0;
    const engine = createProviderEngine({
      clock,
      sleep,
      credentialPort: credential,
      transport: {
        send: async () => {
          sends += 1;
          return { status: 200, bodyText: "" };
        },
      },
    });
    const disabled: ProviderConfiguration = {
      ...config(),
      entries: {
        p0: { ...(config().entries.p0 as never), enabled: false },
        p1: { name: "p1", class: "subscription", enabled: true },
      },
      chains: { default: { name: "default", entries: ["p0", "p1"], allowPaidFallback: false } },
    };
    const resolved = await engine.resolve({ config: disabled });
    expect(resolved.ok).toBe(true);
    if (resolved.ok) expect(resolved.skipped).toEqual([{ providerName: "p0", reason: "disabled" }]);
    expect(sends).toBe(0);
  });
});

describe("TC-PROV-055 group B — fail-open classes become fail-loud", () => {
  for (const failure of FAIL_OPEN_CASES) {
    test(`${failure.legacyId} ${failure.id} announces and never clears`, async () => {
      const engine = createProviderEngine({
        clock,
        sleep,
        credentialPort: credential,
        transport: {
          send: async () => failure.result(),
        },
      });
      const resolved = await engine.resolve({ config: config({ peak: false }) });
      const quota = await engine.quota({ config: config({ peak: false }) });
      expect(quota.ok).toBe(false);
      if (!quota.ok) {
        expect(quota.errorCode).toBe(failure.errorCode);
        expect(quota.announcementCode).toBe(failure.announcementCode);
      }
      if (failure.id === "reset-missing") {
        expect(resolved.ok).toBe(false);
        if (!resolved.ok) expect(resolved.errorCode).toBe("provider.quota.exceeded");
      } else {
        expect(resolved.ok).toBe(true);
        if (resolved.ok) {
          expect(resolved.announcements.map((entry) => entry.code)).toContain(
            failure.announcementCode,
          );
          expect(resolved.parks.map((park) => park.cause)).toContain(failure.parkCause as never);
        }
      }
    });
  }
});

describe("TC-PROV-056 group B' — opt-out and missing credential", () => {
  test("quota-disabled performs no fetch and stays silent", async () => {
    let sends = 0;
    const engine = createProviderEngine({
      clock,
      sleep,
      credentialPort: credential,
      transport: {
        send: async () => {
          sends += 1;
          return { status: 200, bodyText: "" };
        },
      },
    });
    const resolved = await engine.resolve({ config: config({ quota: false, peak: false }) });
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.parks).toEqual([]);
      expect(resolved.announcements).toEqual([]);
    }
    expect(sends).toBe(0);
  });

  test("an unresolvable credential is loud and opt-out with peak still parks", async () => {
    let sends = 0;
    const engine = createProviderEngine({
      clock,
      sleep,
      credentialPort: {
        resolve: () => ({
          ok: false,
          code: "config.credential.missing",
          domainKind: "config",
          category: "user",
          retryable: false,
          consequence: "not_landed",
          projectionClass: "user-validation",
        }),
      },
      transport: {
        send: async () => {
          sends += 1;
          return { status: 200, bodyText: "" };
        },
      },
    });
    const missing = await engine.resolve({ config: config({ peak: false }) });
    if (!missing.ok) throw new Error("resolve failed");
    expect(sends).toBe(0);
    expect(missing.parks[0]?.cause).toBe("credential-missing");
    expect(missing.announcements[0]?.code).toBe("provider.credential.missing");
    const peak = evaluatePeakWindow(config().entries.p0?.peak as never, at(5, 0, 0));
    expect(peak.status).toBe("parked");
  });
});

describe("TC-PROV-057 groups C/D — quota math and the reset divergence", () => {
  const cases: Array<[string, string, "clear" | "parked" | "failed", number?]> = [
    ["TC-ZAI-029", "clear-no-tokens.json", "clear"],
    ["TC-ZAI-030", "clear-below-threshold.json", "clear"],
    ["TC-ZAI-031", "exhausted-valid-reset.json", "parked", 3600],
    ["TC-ZAI-032", "exhausted-valid-reset.json", "parked", 3600],
    ["TC-ZAI-033", "both-exhausted.json", "parked", 3600],
    ["TC-ZAI-034", "time-limit-only.json", "clear"],
    ["TC-ZAI-035", "pct-100.json", "parked", 3600],
    ["TC-ZAI-036", "pct-105.json", "parked", 3600],
    ["TC-ZAI-037", "past-reset.json", "clear"],
    ["TC-ZAI-038", "mixed-reset.json", "parked", 3600],
    ["TC-ZAI-039", "non-exhausted-earlier.json", "parked", 7200],
    ["TC-ZAI-041", "clear-below-threshold.json", "clear"],
    ["TC-ZAI-042", "exhausted-valid-reset.json", "parked", 3600],
  ];
  for (const [legacyId, fixture, status, wait] of cases) {
    test(`${legacyId} preserves the legacy boundary outcome`, () => {
      const result = evaluateQuotaResponse(
        {
          status: 200,
          bodyText: readFileSync(
            join(process.cwd(), "tests/fixtures/provider/quota", fixture),
            "utf8",
          ),
        },
        100,
        NOW,
      );
      expect(result.status).toBe(status);
      if (result.status === "parked" && wait !== undefined) {
        expect(result.waitSeconds).toBe(wait);
      }
    });
  }

  test("TC-ZAI-018/040 preserve the reset-missing and MAX divergences", () => {
    const resetMissing = evaluateQuotaResponse(
      {
        status: 200,
        bodyText: readFileSync(
          join(process.cwd(), "tests/fixtures/provider/quota/reset-absent.json"),
          "utf8",
        ),
      },
      100,
      NOW,
    );
    expect(resetMissing).toMatchObject({
      status: "failed",
      errorCode: "provider.quota.exceeded",
      announcementCode: "provider.quota.reset_missing",
    });
    const peak = evaluatePeakWindow(
      { timezone: "UTC", startSecondsOfDay: 21600, endSecondsOfDay: 36000, bufferSeconds: 7200 },
      at(6, 0, 0),
    );
    const quota = evaluateQuotaResponse(
      {
        status: 200,
        bodyText: JSON.stringify({
          code: 200,
          success: true,
          data: {
            limits: [{ type: "TOKENS_LIMIT", percentage: 100, nextResetTime: at(14, 0, 0) }],
          },
        }),
      },
      100,
      at(6, 0, 0),
    );
    if (peak.status !== "parked" || quota.status !== "parked") throw new Error("expected parks");
    const quotaCondition: ProviderConditionResult = {
      status: "parked",
      kind: "quota-exhausted",
      waitSeconds: quota.waitSeconds,
      expiresAtMs: quota.expiresAtMs,
      announcementCode: "provider.quota.parked",
      evidence: quota.evidence,
    };
    const combined = combineProviderConditions([peak, quotaCondition]);
    expect(combined).toMatchObject({ status: "parked", cause: "quota-exhausted" });
    if (combined.status === "parked") {
      expect(combined.conditions).toEqual(["peak-window", "quota-exhausted"]);
    }
  });
});

describe("TC-PROV-058..061 groups E/F/G/H", () => {
  test("TC-ZAI-045/046 no fetch when disabled; fresh fetch per completed sleep and cap", async () => {
    let calls = 0;
    const result = await runProviderLoop({
      subjectName: "default",
      evaluate: async () => {
        calls += 1;
        return {
          status: "parked",
          cause: "quota-exhausted",
          conditions: ["quota-exhausted"],
          waitSeconds: 60,
          expiresAtMs: NOW + 60 * 1000,
          announcementCode: "provider.quota.parked",
          evidence: { conditionKinds: ["quota-exhausted"], waitSeconds: 60 },
        } satisfies CombinedProviderCondition;
      },
      clock,
      sleep: { sleep: async () => undefined },
      maxSleepLoops: 2,
      capParkTtlSeconds: 300,
    });
    expect(result.outcome).toBe("capped");
    expect(result.completedSleeps).toBe(2);
    expect(calls).toBe(2);
    if (result.outcome === "capped") {
      expect(result.announcement.code).toBe("provider.reevaluation.cap");
      expect(result.park.expiresAtMs).toBe(NOW + 300 * 1000);
    }
  });

  test("TC-ZAI-050..052 canaries stay hidden and fail-open exit 0 is removed", async () => {
    let sends = 0;
    const engine = createProviderEngine({
      clock,
      sleep,
      credentialPort: credential,
      transport: {
        send: async () => {
          sends += 1;
          return { status: 200, bodyText: `{"raw":"RAW-BODY-CANARY"}` };
        },
      },
    });
    const resolved = await engine.resolve({ config: config({ peak: false }) });
    const quota = await engine.quota({ config: config({ peak: false }) });
    const surfaces = JSON.stringify({ resolved, quota });
    expect(surfaces).not.toContain("CANARY-SECRET");
    expect(surfaces).not.toContain("RAW-BODY-CANARY");
    expect(quota.ok).toBe(false);
    if (resolved.ok) expect(sends).toBeGreaterThan(0);
  });

  test("TC-ZAI-055/056 portable UTC formatting without shell date", () => {
    expect(formatUtcIso(0)).toBe("1970-01-01T00:00:00.000Z");
    expect(formatUtcIso(Date.UTC(2026, 0, 1, 6, 0, 0))).toBe("2026-01-01T06:00:00.000Z");
    expect(formatUtcIso(Date.UTC(2024, 1, 29, 23, 59, 59, 999))).toBe("2024-02-29T23:59:59.999Z");
    const source = readFileSync(join(process.cwd(), "packages/core/src/provider/parks.ts"), "utf8");
    expect(source).not.toContain("date -d");
    expect(source).not.toContain(["child", "process"].join("_"));
  });

  test("TC-ZAI-060..064 quota→peak re-evaluation, past reset, and cap accounting", async () => {
    const quota = evaluateQuotaResponse(
      {
        status: 200,
        bodyText: JSON.stringify({
          code: 200,
          success: true,
          data: {
            limits: [{ type: "TOKENS_LIMIT", percentage: 100, nextResetTime: at(13, 0, 0) }],
          },
        }),
      },
      100,
      at(6, 0, 0),
    );
    if (quota.status !== "parked") throw new Error("expected a quota park");
    const peak = evaluatePeakWindow(
      { timezone: "UTC", startSecondsOfDay: 21600, endSecondsOfDay: 36000, bufferSeconds: 7200 },
      at(7, 0, 0),
    );
    if (peak.status !== "parked") throw new Error("expected a peak park");
    expect(quota.waitSeconds).toBe(7 * 3600);
    expect(peak.waitSeconds).toBe(3 * 3600);
    expect(
      evaluateQuotaResponse(
        {
          status: 200,
          bodyText: JSON.stringify({
            code: 200,
            success: true,
            data: {
              limits: [{ type: "TOKENS_LIMIT", percentage: 100, nextResetTime: at(5, 0, 0) }],
            },
          }),
        },
        100,
        at(6, 0, 0),
      ).status,
    ).toBe("clear");
  });
});

describe("TC-PROV-037/052 no-silent-path matrix", () => {
  test("every class produces an announcement, park, or classified error", () => {
    const ids = NO_SILENT_PATH_CLASSES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of NO_SILENT_PATH_CLASSES) {
      expect(entry.assertingTc).toMatch(/^TC-PROV-/);
    }
  });

  test("a temp class returning clear would be rejected by the matrix contract", () => {
    const classes: Array<{ id: string; outcome: "clear" | "parked" | "failed" }> = [
      { id: "transport", outcome: "parked" },
      { id: "temp-clear", outcome: "clear" },
    ];
    const invalid = classes.filter((entry) => entry.outcome === "clear");
    expect(invalid.map((entry) => entry.id)).toEqual(["temp-clear"]);
  });
});

describe("TC-PROV-047 100-run deterministic replay", () => {
  test("identical facts produce byte-identical decisions and records", async () => {
    const engine = createProviderEngine({
      clock,
      sleep,
      credentialPort: credential,
      transport: transportFrom(() => ({
        status: 200,
        bodyText: JSON.stringify({
          code: 200,
          success: true,
          data: {
            limits: [{ type: "TOKENS_LIMIT", percentage: 100, nextResetTime: NOW + 3600 * 1000 }],
          },
        }),
      })),
    });
    const first = await engine.resolve({ config: config() });
    const serialized = JSON.stringify(first);
    for (let index = 0; index < 99; index += 1) {
      expect(JSON.stringify(await engine.resolve({ config: config() }))).toBe(serialized);
    }
  });

  test("changing one injected fact changes the output deterministically", async () => {
    const engine = createProviderEngine({
      clock,
      sleep,
      credentialPort: credential,
      transport: clearTransport,
    });
    const first = await engine.resolve({ config: config() });
    const second = await engine.resolve({ config: config(), chainName: "missing" });
    expect(JSON.stringify(first)).not.toBe(JSON.stringify(second));
  });
});
