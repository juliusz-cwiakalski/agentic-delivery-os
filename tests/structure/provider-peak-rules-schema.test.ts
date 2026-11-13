/**
 * TC-PAUSE-010 / TC-PAUSE-011 — peak-window rules as versioned per-profile
 * data (GH-294 F-2, DM-3, DEC-1, DEC-6; NFR-1 validation tail).
 *
 * The parsed value round-trips the declaration field-for-field through the
 * delivered provider-profiles loader, the grace maximum is derived data on the
 * parsed value (never a downstream clamp), validation is fail-closed and
 * classified naming the offending field, and the schema stays data-only.
 * The OQ-TP-1/OQ-TP-2 pins ride this suite: a non-UTC zone literal refuses,
 * an exact-duplicate window refuses, distinct overlaps validate without
 * arbitration.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import {
  type ProviderConfiguration,
  parseAndValidateProfileConfiguration,
  parseProfileConfiguration,
  parseProviderConfiguration,
} from "../../packages/core/src/provider/validate";

const ROOT = process.cwd();
const RULES_MODULE = "packages/core/src/provider/peak-rules.ts";
const CONTRACT_MODULE = "packages/core/src/contracts/provider-profile.ts";

const window = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  timezone: "UTC",
  startSecondsOfDay: 61200,
  endSecondsOfDay: 64800,
  multiplier: 2,
  bufferBeforeSeconds: 300,
  bufferAfterSeconds: 300,
  ...overrides,
});

const providersValues = (): Record<string, unknown> => ({
  provider: {
    entries: {
      "provider-a": { class: "subscription", enabled: true },
      "provider-b": { class: "subscription", enabled: true },
    },
    credentials: {},
    chains: {
      main: { entries: ["provider-a", "provider-b"], allowPaidFallback: false },
    },
    defaultChain: "main",
  },
});

const providers = (): ProviderConfiguration => {
  const parsed = parseProviderConfiguration(providersValues());
  if (!parsed.ok) throw new Error(`provider fixture must parse: ${parsed.error.detail}`);
  return parsed.config;
};

const branchWithProfile = (
  peakWindows: unknown,
  profileOverrides: Record<string, unknown> = {},
): Record<string, unknown> => {
  const values = providersValues();
  const provider = values.provider;
  if (typeof provider !== "object" || provider === null) {
    throw new Error("provider fixture must be an object");
  }
  return {
    ...values,
    provider: {
      ...provider,
      profiles: {
        tiers: { build: {} },
        profiles: {
          "profile-a": {
            tier: "build",
            providers: ["provider-a"],
            seats: { judgment: { model: "m-a", pacingClass: "judgment", capability: "text-only" } },
            ...(peakWindows === undefined ? {} : { peakWindows }),
            ...profileOverrides,
          },
        },
        preferenceChain: { base: "profile-a", fallbacks: [] },
      },
    },
  };
};

const twoWindowRules = (): Record<string, unknown> => ({
  graceSeconds: 120,
  windows: [
    window({
      startSecondsOfDay: 61200,
      endSecondsOfDay: 64800,
      multiplier: 2,
      bufferBeforeSeconds: 300,
      bufferAfterSeconds: 600,
    }),
    window({
      startSecondsOfDay: 1000,
      endSecondsOfDay: 3600,
      multiplier: 3,
      bufferBeforeSeconds: 450,
      bufferAfterSeconds: 150,
    }),
  ],
});

const parsedRulesOf = (branch: unknown) => {
  const parsed = parseProfileConfiguration(branch);
  if (!parsed.ok) throw new Error(`fixture must parse: ${parsed.error.detail}`);
  const profile = parsed.config.profiles["profile-a"];
  if (profile === undefined) throw new Error("fixture profile missing");
  return { profile, peakWindows: profile.peakWindows };
};

describe("TC-PAUSE-010 peak-window rules round-trip as versioned per-profile data", () => {
  test("the parsed rule value equals the declaration field-for-field", () => {
    const { peakWindows } = parsedRulesOf(branchWithProfile(twoWindowRules()));
    expect(peakWindows).toBeDefined();
    if (peakWindows === undefined) return;
    expect(peakWindows.graceSecondsDefault).toBe(120);
    expect(peakWindows.windows).toHaveLength(2);
    const [first, second] = peakWindows.windows;
    expect(first).toEqual({
      timezone: "UTC",
      startSecondsOfDay: 61200,
      endSecondsOfDay: 64800,
      multiplier: 2,
      bufferBeforeSeconds: 300,
      bufferAfterSeconds: 600,
    });
    expect(second).toEqual({
      timezone: "UTC",
      startSecondsOfDay: 1000,
      endSecondsOfDay: 3600,
      multiplier: 3,
      bufferBeforeSeconds: 450,
      bufferAfterSeconds: 150,
    });
  });

  test("the grace maximum is derived data on the parsed value: the smallest declared buffer", () => {
    const { peakWindows } = parsedRulesOf(branchWithProfile(twoWindowRules()));
    expect(peakWindows).toBeDefined();
    if (peakWindows === undefined) return;
    // min(300, 600, 450, 150) = 150 — the smallest protection across every
    // declared window edge bounds the applied grace (DEC-6).
    expect(peakWindows.graceSecondsMax).toBe(150);
  });

  test("rules are versioned with the profile: the parsed data rides the profile value", () => {
    const { profile } = parsedRulesOf(branchWithProfile(twoWindowRules()));
    // The rule data is a field of the parsed profile, additive to the
    // delivered branch — no side table, no second declaration.
    expect(Object.keys(profile)).toContain("peakWindows");
    expect(profile.peakWindows).toBeDefined();
  });

  test("absent rules parse as a closed absence, never a synthesized default window", () => {
    const { profile } = parsedRulesOf(branchWithProfile(undefined));
    expect(profile.peakWindows).toBeUndefined();
    expect(Object.keys(profile)).not.toContain("peakWindows");
  });

  test("the schema stays data-only: no clock, environment, or I/O in the rule module", () => {
    const source = readFileSync(join(ROOT, RULES_MODULE), "utf8");
    for (const banned of [
      "node:",
      "process.",
      "Bun.",
      "Date.now",
      "Math.random",
      "fetch(",
      "setTimeout",
      "readFileSync",
      "writeFileSync",
    ]) {
      expect(source.includes(banned), `${RULES_MODULE} must not contain ${banned}`).toBe(false);
    }
    // The schema vocabulary itself (the contract types) stays call-free.
    const contract = ts.createSourceFile(
      CONTRACT_MODULE,
      readFileSync(join(ROOT, CONTRACT_MODULE), "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const violations: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
        violations.push(`call/new at ${node.getStart(contract)}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(contract);
    expect(violations).toEqual([]);
  });
});

describe("TC-PAUSE-011 fail-closed validation refuses malformed rule declarations", () => {
  const refusalOf = (branch: unknown) => {
    const parsed = parseProfileConfiguration(branch);
    if (parsed.ok) throw new Error("expected the branch to refuse");
    return parsed.error;
  };

  const expectRefusal = (branch: unknown, expectedField: string): void => {
    const error = refusalOf(branch);
    expect(error.code).toBe("provider.profile.invalid");
    expect(error.field).toBe(expectedField);
  };

  test("window end at or before start refuses naming the end field", () => {
    expectRefusal(
      branchWithProfile({
        graceSeconds: 60,
        windows: [window({ startSecondsOfDay: 3600, endSecondsOfDay: 3600 })],
      }),
      "peakWindows.windows[0].endSecondsOfDay",
    );
    expectRefusal(
      branchWithProfile({
        graceSeconds: 60,
        windows: [window({ startSecondsOfDay: 3600, endSecondsOfDay: 3599 })],
      }),
      "peakWindows.windows[0].endSecondsOfDay",
    );
  });

  test("a window missing start or end refuses", () => {
    expectRefusal(
      branchWithProfile({
        graceSeconds: 60,
        windows: [window({ startSecondsOfDay: undefined })],
      }),
      "peakWindows.windows[0].startSecondsOfDay",
    );
    expectRefusal(
      branchWithProfile({
        graceSeconds: 60,
        windows: [window({ endSecondsOfDay: undefined })],
      }),
      "peakWindows.windows[0].endSecondsOfDay",
    );
  });

  test("a negative or missing buffer refuses", () => {
    expectRefusal(
      branchWithProfile({
        graceSeconds: 60,
        windows: [window({ bufferBeforeSeconds: -1 })],
      }),
      "peakWindows.windows[0].bufferBeforeSeconds",
    );
    expectRefusal(
      branchWithProfile({
        graceSeconds: 60,
        windows: [window({ bufferAfterSeconds: undefined })],
      }),
      "peakWindows.windows[0].bufferAfterSeconds",
    );
  });

  test("a missing graceSeconds default refuses", () => {
    expectRefusal(branchWithProfile({ windows: [window()] }), "peakWindows.graceSeconds");
  });

  test("a graceSeconds above the derived maximum is a validation error, never a clamp", () => {
    // min buffer is 300; requesting 301 exceeds the profile maximum.
    const error = refusalOf(branchWithProfile({ graceSeconds: 301, windows: [window()] }));
    expect(error.field).toBe("peakWindows.graceSeconds");
    expect(error.detail).toContain("never a clamp");
    expect(error.detail).toContain("300");
  });

  test("a graceSeconds equal to the derived maximum validates (bound is inclusive)", () => {
    const { peakWindows } = parsedRulesOf(
      branchWithProfile({ graceSeconds: 300, windows: [window()] }),
    );
    expect(peakWindows?.graceSecondsMax).toBe(300);
    expect(peakWindows?.graceSecondsDefault).toBe(300);
  });

  test("a non-numeric multiplier refuses", () => {
    expectRefusal(
      branchWithProfile({
        graceSeconds: 60,
        windows: [window({ multiplier: "expensive" })],
      }),
      "peakWindows.windows[0].multiplier",
    );
    expectRefusal(
      branchWithProfile({
        graceSeconds: 60,
        windows: [window({ multiplier: 0 })],
      }),
      "peakWindows.windows[0].multiplier",
    );
  });

  test("a malformed instant refuses", () => {
    expectRefusal(
      branchWithProfile({
        graceSeconds: 60,
        windows: [window({ startSecondsOfDay: 3600.5 })],
      }),
      "peakWindows.windows[0].startSecondsOfDay",
    );
    expectRefusal(
      branchWithProfile({
        graceSeconds: 60,
        windows: [window({ startSecondsOfDay: 86400 })],
      }),
      "peakWindows.windows[0].startSecondsOfDay",
    );
  });

  test("OQ-TP-1: a non-UTC zone literal refuses naming the timezone field", () => {
    expectRefusal(
      branchWithProfile({
        graceSeconds: 60,
        windows: [window({ timezone: "America/New_York" })],
      }),
      "peakWindows.windows[0].timezone",
    );
    const error = refusalOf(
      branchWithProfile({ graceSeconds: 60, windows: [window({ timezone: "Europe/Warsaw" })] }),
    );
    expect(error.detail).toContain("Europe/Warsaw");
    expect(error.detail).toContain("UTC");
  });

  test("OQ-TP-2: an exact-duplicate window (same start AND end) refuses as ambiguous", () => {
    expectRefusal(
      branchWithProfile({
        graceSeconds: 60,
        windows: [
          window(),
          window({ multiplier: 5, bufferBeforeSeconds: 900, bufferAfterSeconds: 900 }),
        ],
      }),
      "peakWindows.windows[1]",
    );
  });

  test("OQ-TP-2: distinct overlapping windows validate without arbitration", () => {
    // 17:00-19:00 and 18:00-20:00 overlap; multipliers are declared rule data
    // and are never reconciled at validation time (spec §7.3 stays deferred).
    const { peakWindows } = parsedRulesOf(
      branchWithProfile({
        graceSeconds: 60,
        windows: [
          window({ startSecondsOfDay: 61200, endSecondsOfDay: 68400, multiplier: 2 }),
          window({ startSecondsOfDay: 64800, endSecondsOfDay: 72000, multiplier: 5 }),
        ],
      }),
    );
    expect(peakWindows?.windows).toHaveLength(2);
  });

  test("the valid control passes with zero silent coercion", () => {
    const parsed = parseAndValidateProfileConfiguration(
      branchWithProfile(twoWindowRules()),
      providers(),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const peakWindows = parsed.config.profiles["profile-a"]?.peakWindows;
    // No coercion: the parsed values equal the declaration exactly.
    expect(peakWindows?.graceSecondsDefault).toBe(120);
    expect(peakWindows?.windows[0]?.multiplier).toBe(2);
    expect(peakWindows?.windows[1]?.multiplier).toBe(3);
  });

  test("an invalid rule set never reaches the watcher: the whole branch refuses", () => {
    const parsed = parseAndValidateProfileConfiguration(
      branchWithProfile({ graceSeconds: 60, windows: [] }),
      providers(),
    );
    // There is no run-with-partial-rules state: the loader returns no
    // configuration at all for a malformed rule declaration.
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error.field).toBe("peakWindows.windows");
  });
});
