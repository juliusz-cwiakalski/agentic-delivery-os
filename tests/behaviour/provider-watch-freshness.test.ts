/**
 * GH-350 TC-WFRESH-001..-009 (behaviour arms) — watch observation freshness:
 * the per-target bound and its refusal, the exact first-stale predicate, the
 * watch-only stale state with its three additive fields, the evidence-bounded
 * park clamp, the live zero-age posture, zero writes, and clock-only freshness.
 *
 * Every case injects the clock, the credential port, the transport, the mapping
 * port, and the observation instant; no case reads the ambient clock, a live
 * home, a network, or the repository's own configuration.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createProviderWatchMappings } from "../../packages/adapters/src/provider-quota/index";
import { resolveConfig } from "../../packages/core/src/config/index";
import type {
  CredentialPort,
  ProviderConfiguration,
  ProviderWatchTarget,
  QuotaTransport,
  QuotaTransportResult,
} from "../../packages/core/src/contracts/index";
import { PROVIDER_WATCH_CONDITIONS } from "../../packages/core/src/contracts/index";
import {
  clampWatchParkExpiry,
  createProviderWatchStatus,
  isWatchObservationStale,
  PROVIDER_WATCH_DEFAULT_MAX_AGE_SECONDS,
  watchObservationAgeSeconds,
} from "../../packages/core/src/provider/quota";
import { fileFacts } from "../fixtures/config/facts";

const NOW = 1_700_000_000_000;
const ROOT = process.cwd();
const CANARY = "CANARY-WATCH-SECRET";

const nominalBody = (): string =>
  readFileSync(join(ROOT, "tests/fixtures/provider/watch/coding-plan/nominal.json"), "utf8");

const credentials: ProviderConfiguration["credentials"] = {
  cp: { sourceKey: { style: "literal", name: "CP_KEY" } },
};

const target = (overrides: Partial<ProviderWatchTarget> = {}): ProviderWatchTarget => ({
  mapping: "coding-plan-windows",
  endpoint: "https://coding-plan.example/quota",
  credentialRef: "cp",
  thresholdPercent: 100,
  ...overrides,
});

const readerWith = (options: {
  readonly nowMs?: () => number;
  readonly response?: () => QuotaTransportResult | "throw";
  readonly resolvable?: boolean;
  readonly observedAtMs?: number;
}) => {
  const credentialPort: CredentialPort = {
    resolve: () =>
      options.resolvable === false
        ? {
            ok: false,
            code: "config.credential.missing",
            domainKind: "config",
            category: "user",
            retryable: false,
            consequence: "not_landed",
            projectionClass: "user-validation",
          }
        : { ok: true, material: { value: CANARY } },
  };
  const transport: QuotaTransport = {
    send: async () => {
      const answer = options.response?.() ?? { status: 200, bodyText: nominalBody() };
      if (answer === "throw") throw new Error("transport failure");
      return answer;
    },
  };
  return {
    reader: createProviderWatchStatus({
      clock: { nowMs: options.nowMs ?? (() => NOW) },
      credentialPort,
      transport,
      mappings: createProviderWatchMappings(),
    }),
    observed: options.observedAtMs,
  };
};

const viewOf = async (
  options: Parameters<typeof readerWith>[0],
  overrides?: Partial<ProviderWatchTarget>,
) => {
  const { reader, observed } = readerWith(options);
  const result = await reader.status({
    targets: { t: target(overrides) },
    credentials,
    ...(observed === undefined ? {} : { observedAtMs: observed }),
  });
  if (!result.ok) throw new Error(`${result.code}: ${result.summary}`);
  const view = result.providers[0];
  if (view === undefined) throw new Error("no view");
  return view;
};

const boundaryConfig = (maxAgeSeconds?: unknown) => ({
  provider: {
    profiles: {
      watch: {
        t: {
          mapping: "coding-plan-windows",
          endpoint: "https://coding-plan.example/quota",
          credentialRef: "cp",
          ...(maxAgeSeconds === undefined ? {} : { maxAgeSeconds }),
        },
      },
    },
  },
});

/* -------------------------------- TC-WFRESH-001 --------------------------- */

describe("TC-WFRESH-001 maxAgeSeconds has one declared default and one declared validation", () => {
  test("the declared default and the two accepted values", async () => {
    expect(PROVIDER_WATCH_DEFAULT_MAX_AGE_SECONDS).toBe(900);
    expect((await viewOf({})).maxAgeSeconds).toBe(900);
    expect((await viewOf({}, { maxAgeSeconds: 900 })).maxAgeSeconds).toBe(900);
    expect((await viewOf({}, { maxAgeSeconds: 1 })).maxAgeSeconds).toBe(1);
  });

  test("zero, negative and fractional bounds refuse config.value.invalid naming the key", async () => {
    for (const bound of [0, -1, 900.5]) {
      const { reader } = readerWith({});
      const result = await reader.status({
        targets: { t: target({ maxAgeSeconds: bound }) },
        credentials,
      });
      expect(result.ok, String(bound)).toBe(false);
      if (result.ok) continue;
      expect(result.code, String(bound)).toBe("config.value.invalid");
      expect(result.summary, String(bound)).toContain("provider.profiles.watch.t.maxAgeSeconds");
      expect(result.summary, String(bound)).toContain("positive integer");
    }
  });

  test("a coerced string is refused by the configuration schema", () => {
    const result = resolveConfig({
      sources: [fileFacts("project-committed", boundaryConfig("900"), 6)],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("config.value.invalid");
  });

  test("an omitted bound carries no defaults-layer origin; a declared one names its layer", () => {
    const omitted = resolveConfig({
      sources: [fileFacts("project-committed", boundaryConfig(), 6)],
    });
    expect(omitted.ok).toBe(true);
    if (!omitted.ok) return;
    expect(omitted.value.origins["provider.profiles.watch.t.maxAgeSeconds"]).toBeUndefined();
    const declared = resolveConfig({
      sources: [fileFacts("project-committed", boundaryConfig(120), 6)],
    });
    expect(declared.ok).toBe(true);
    if (!declared.ok) return;
    expect(declared.value.origins["provider.profiles.watch.t.maxAgeSeconds"]).toEqual({
      layer: "project-committed",
      file: "fixtures/project-committed.yaml",
      line: 6,
    });
  });
});

/* -------------------------------- TC-WFRESH-002 --------------------------- */

describe("TC-WFRESH-002 the predicate is stale exactly at ageSeconds >= maxAgeSeconds under floor", () => {
  test("899s/899.999s/0/negative are fresh; 900s/900.999s/901s are stale", async () => {
    const cells: readonly [number, "fresh" | "stale"][] = [
      [899_000, "fresh"],
      [899_999, "fresh"],
      [900_000, "stale"],
      [900_999, "stale"],
      [901_000, "stale"],
      [0, "fresh"],
      [-5_000, "fresh"],
    ];
    for (const [ageMs, expected] of cells) {
      const view = await viewOf({ observedAtMs: NOW - ageMs });
      const stale = view.condition === "watch-stale";
      expect(stale, String(ageMs)).toBe(expected === "stale");
      expect(view.ageSeconds, String(ageMs)).toBe(Math.max(0, Math.floor(ageMs / 1_000)));
    }
  });

  test("the two helpers agree with the view", () => {
    expect(watchObservationAgeSeconds({ nowMs: NOW, observedAtMs: NOW - 899_999 })).toBe(899);
    expect(watchObservationAgeSeconds({ nowMs: NOW, observedAtMs: NOW + 5_000 })).toBe(0);
    expect(isWatchObservationStale({ ageSeconds: 899, maxAgeSeconds: 900 })).toBe(false);
    expect(isWatchObservationStale({ ageSeconds: 900, maxAgeSeconds: 900 })).toBe(true);
  });
});

/* -------------------------------- TC-WFRESH-003 --------------------------- */

describe("TC-WFRESH-003 a stale reading is a third named state with the three additive fields", () => {
  test("a would-be clear reading and a would-be outage reading both report watch-stale", async () => {
    const clearArm = await viewOf({ observedAtMs: NOW - 1_200_000 });
    expect(clearArm.condition).toBe("watch-stale");
    expect(clearArm).toMatchObject({
      name: "t",
      observedAt: "2023-11-14T21:53:20.000Z",
      ageSeconds: 1200,
      maxAgeSeconds: 900,
      checkedAt: "2023-11-14T22:13:20.000Z",
    });
    expect(clearArm.source).toBe("observed at 2023-11-14T21:53:20.000Z; max age 900s");
    expect(clearArm.source).not.toMatch(/outage|credential|transport|authorization/iu);

    const outageArm = await viewOf({ observedAtMs: NOW - 1_200_000, response: () => "throw" });
    expect(outageArm.condition).toBe("watch-stale");
    expect(outageArm.source).not.toContain("transport failure");
  });
});

/* -------------------------------- TC-WFRESH-004 --------------------------- */

describe("TC-WFRESH-004 watch-stale is watch-only at the view", () => {
  test("a stale view carries no park and no announcement and stays inside its field set", async () => {
    const view = await viewOf({ observedAtMs: NOW - 1_200_000 });
    expect(Object.keys(view)).toEqual([
      "name",
      "condition",
      "source",
      "checkedAt",
      "observedAt",
      "ageSeconds",
      "maxAgeSeconds",
    ]);
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain("announcement");
    expect(serialized).not.toContain("park");
    expect(PROVIDER_WATCH_CONDITIONS as readonly string[]).toContain("watch-stale");
  });
});

/* -------------------------------- TC-WFRESH-005 --------------------------- */

describe("TC-WFRESH-005 a derived park never outlives its evidence", () => {
  test("clamp when the natural expiry is past the bound, equal at it, and untouched before it", () => {
    const bound = NOW - 300_000 + 900_000;
    const clamped = clampWatchParkExpiry({
      naturalExpiryMs: NOW + 3_600_000,
      observedAtMs: NOW - 300_000,
      maxAgeSeconds: 900,
      nowMs: NOW,
    });
    expect(clamped).toBe(bound);
    expect(clamped).toBeGreaterThan(NOW);

    const equal = clampWatchParkExpiry({
      naturalExpiryMs: bound,
      observedAtMs: NOW - 300_000,
      maxAgeSeconds: 900,
      nowMs: NOW,
    });
    expect(equal).toBe(bound);

    const natural = clampWatchParkExpiry({
      naturalExpiryMs: NOW + 60_000,
      observedAtMs: NOW - 300_000,
      maxAgeSeconds: 900,
      nowMs: NOW,
    });
    expect(natural).toBe(NOW + 60_000);
  });
});

/* -------------------------------- TC-WFRESH-006 --------------------------- */

describe("TC-WFRESH-006 once the bound has passed no park exists and the reading is stale", () => {
  test("a bound at now - 1s and a bound exactly at now both yield no park", async () => {
    for (const observedAtMs of [NOW - 901_000, NOW - 900_000]) {
      const expiry = clampWatchParkExpiry({
        naturalExpiryMs: NOW + 3_600_000,
        observedAtMs,
        maxAgeSeconds: 900,
        nowMs: NOW,
      });
      expect(expiry, String(observedAtMs)).toBeUndefined();
      const view = await viewOf({ observedAtMs });
      expect(view.condition).toBe("watch-stale");
      expect(view).not.toHaveProperty("expiresAtMs");
    }
  });
});

/* -------------------------------- TC-WFRESH-007 --------------------------- */

describe("TC-WFRESH-007 the live composition observes at read time", () => {
  test("observedAt equals checkedAt, age is 0, and the five delivered conditions are never stale", async () => {
    const arms: readonly [string, Parameters<typeof readerWith>[0]][] = [
      ["clear", {}],
      ["provider-outage", { response: () => "throw" }],
      ["credential-missing", { resolvable: false }],
      ["credential-rejected", { response: () => ({ status: 401, bodyText: "" }) }],
      [
        "quota-exhausted",
        {
          response: () => ({
            status: 200,
            bodyText: JSON.stringify({
              code: 200,
              success: true,
              data: {
                limits: [{ type: "TOKENS_LIMIT", percentage: 100, nextResetTime: NOW + 3_600_000 }],
              },
            }),
          }),
        },
      ],
    ];
    for (const [label, options] of arms) {
      const view = await viewOf(options);
      expect(view.observedAt, label).toBe(view.checkedAt);
      expect(view.ageSeconds, label).toBe(0);
      expect(view.maxAgeSeconds, label).toBe(900);
      expect(view.condition, label).not.toBe("watch-stale");
    }
    const clear = await viewOf({});
    expect(clear.condition).toBe("clear");
  });
});

/* -------------------------------- TC-WFRESH-008 --------------------------- */

describe("TC-WFRESH-008 the watch path writes nothing and adds no cache or timer", () => {
  test("two reads are identical and the reader accepts no store", async () => {
    const { reader } = readerWith({});
    const a = await reader.status({ targets: { t: target() }, credentials });
    const b = await reader.status({ targets: { t: target() }, credentials });
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    // The reader is constructed from four seams and no store (the structural
    // scan in provider-watch-contract asserts the type carries none).
    expect(createProviderWatchStatus.length).toBe(1);
  });
});

/* -------------------------------- TC-WFRESH-009 --------------------------- */

describe("TC-WFRESH-009 freshness is a function of the injected clock and the supplied instant", () => {
  test("advancing the clock by 600s moves the age from 300 to 900 and the state to stale", async () => {
    const observedAtMs = NOW - 300_000;
    const statusAt = async (nowMs: number) => {
      const reader = createProviderWatchStatus({
        clock: { nowMs: () => nowMs },
        credentialPort: { resolve: () => ({ ok: true, material: { value: "" } }) },
        transport: { send: async () => ({ status: 200, bodyText: nominalBody() }) },
        mappings: createProviderWatchMappings(),
      });
      return reader.status({ targets: { t: target() }, credentials, observedAtMs });
    };
    const early = await statusAt(NOW);
    const late = await statusAt(NOW + 600_000);
    expect(early.ok && late.ok).toBe(true);
    if (!early.ok || !late.ok) return;
    expect(early.providers[0]?.ageSeconds).toBe(300);
    expect(early.providers[0]?.condition).not.toBe("watch-stale");
    expect(late.providers[0]?.ageSeconds).toBe(900);
    expect(late.providers[0]?.condition).toBe("watch-stale");
    expect((late.providers[0]?.ageSeconds ?? 0) - (early.providers[0]?.ageSeconds ?? 0)).toBe(600);
  });
});
