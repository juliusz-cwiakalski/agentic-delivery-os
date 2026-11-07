/**
 * TC-PROFILE-016..019 — the three vendor watch mappings normalize fixture
 * payloads into the secret-free snapshot vocabulary and never classify a
 * malformed, non-auth, or credential class as clear.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  normalizeCodingPlanWindows,
  normalizeDeepseekBalance,
  normalizeOpenAiUsage,
} from "../../packages/adapters/src/provider-quota/index";

const ROOT = process.cwd();
const NOW = 1_700_000_000_000;

const readFixture = (relative: string): string => {
  const path = join(ROOT, "tests/fixtures/provider/watch", relative);
  if (!existsSync(path)) throw new Error(`missing fixture ${relative}`);
  return readFileSync(path, "utf8");
};

describe("TC-PROFILE-016 coding-plan weekly and rolling windows", () => {
  test("both windows normalize with the engine limit shape and reset instants", () => {
    const result = normalizeCodingPlanWindows({
      status: 200,
      bodyText: readFixture("coding-plan/nominal.json"),
      nowMs: NOW,
    });
    expect(result.status).toBe("clear");
    if (result.status !== "clear") return;
    expect(result.snapshot.mapping).toBe("coding-plan-windows");
    expect(result.snapshot.limits).toEqual([
      { type: "WEEKLY_LIMIT", percentage: 61, resetEpochMs: 1700003600000 },
      { type: "ROLLING_LIMIT", percentage: 12, resetEpochMs: 1700000600000 },
    ]);
    expect(result.snapshot.sourceSummary).toBe("weekly 61%, rolling 12%");
    expect(JSON.stringify(result.snapshot)).not.toContain("usedPercent");
  });

  test("a threshold crossing parks at the earliest reset", () => {
    const result = normalizeCodingPlanWindows({
      status: 200,
      bodyText: readFixture("coding-plan/boundary.json"),
      nowMs: NOW,
      thresholdPercent: 100,
    });
    expect(result.status).toBe("parked");
    if (result.status !== "parked") return;
    expect(result.condition).toBe("quota-exhausted");
    expect(result.expiresAtMs).toBe(1700000600000);
    expect(result.waitSeconds).toBe(600);
  });
});

describe("TC-PROFILE-017 DeepSeek balance against a configured floor", () => {
  test("above and at the floor are clear", () => {
    for (const file of ["deepseek/above.json", "deepseek/at.json"]) {
      const result = normalizeDeepseekBalance({
        status: 200,
        bodyText: readFixture(file),
        floor: 5,
      });
      expect(result.status, file).toBe("clear");
    }
  });

  test("below the floor is the exhaustion class with an honest recovery condition", () => {
    const result = normalizeDeepseekBalance({
      status: 200,
      bodyText: readFixture("deepseek/below.json"),
      floor: 5,
    });
    expect(result.status).toBe("failed");
    if (result.status !== "failed") return;
    expect(result.errorCode).toBe("provider.quota.exceeded");
    expect(result.announcementCode).toBe("provider.quota.reset_missing");
    expect(result.failureClass).toBe("below-floor:top-up");
  });
});

describe("TC-PROFILE-018 OpenAI usage windows and park expiry", () => {
  test("declared windows and percentages normalize like quota limits", () => {
    const result = normalizeOpenAiUsage({
      status: 200,
      bodyText: readFixture("openai/nominal.json"),
      nowMs: NOW,
    });
    expect(result.status).toBe("clear");
    if (result.status !== "clear") return;
    expect(result.snapshot.limits.map((limit) => limit.type)).toEqual([
      "OPENAI_5H_LIMIT",
      "OPENAI_WEEKLY_LIMIT",
    ]);
    expect(result.snapshot.sourceSummary).toBe("5h 12%, weekly 61%");
  });

  test("a crossing window supplies the absolute park expiry from the window end", () => {
    const result = normalizeOpenAiUsage({
      status: 200,
      bodyText: readFixture("openai/crossing.json"),
      nowMs: NOW,
      thresholdPercent: 100,
    });
    expect(result.status).toBe("parked");
    if (result.status !== "parked") return;
    expect(result.expiresAtMs).toBe(1700000600000);
    expect(result.condition).toBe("quota-exhausted");
  });

  test("a crossing window with no reset is a classified reset-missing failure", () => {
    const result = normalizeOpenAiUsage({
      status: 200,
      bodyText: readFixture("openai/no-reset.json"),
      nowMs: NOW,
      thresholdPercent: 100,
    });
    expect(result.status).toBe("failed");
    if (result.status !== "failed") return;
    expect(result.announcementCode).toBe("provider.quota.reset_missing");
  });
});

describe("TC-PROFILE-019 malformed vendor classes are never clear", () => {
  const cases = [
    {
      name: "malformed-json",
      run: () =>
        normalizeCodingPlanWindows({ status: 200, bodyText: "not json", nowMs: NOW }),
    },
    {
      name: "wrong-types",
      run: () =>
        normalizeCodingPlanWindows({
          status: 200,
          bodyText: readFixture("malformed/wrong-types.json"),
          nowMs: NOW,
        }),
    },
    {
      name: "missing-window",
      run: () =>
        normalizeCodingPlanWindows({
          status: 200,
          bodyText: readFixture("coding-plan/malformed.json"),
          nowMs: NOW,
        }),
    },
    {
      name: "http-401",
      run: () =>
        normalizeCodingPlanWindows({ status: 401, bodyText: "", nowMs: NOW }),
    },
    {
      name: "http-403",
      run: () =>
        normalizeCodingPlanWindows({ status: 403, bodyText: "", nowMs: NOW }),
    },
    {
      name: "http-500",
      run: () =>
        normalizeOpenAiUsage({ status: 500, bodyText: "", nowMs: NOW }),
    },
  ];

  for (const entry of cases) {
    test(`${entry.name} is a classified failure, never clear`, () => {
      const result = entry.run();
      expect(result.status).not.toBe("clear");
      if (result.status !== "failed") return;
      expect(result.errorCode.length).toBeGreaterThan(0);
      expect(result.announcementCode.length).toBeGreaterThan(0);
    });
  }

  test("HTTP 401/403 are credential classes and 5xx is an outage class", () => {
    const unauthorized = normalizeOpenAiUsage({ status: 401, bodyText: "", nowMs: NOW });
    expect(unauthorized.status === "failed" && unauthorized.errorCode).toBe(
      "provider.auth.rejected",
    );
    const outage = normalizeOpenAiUsage({ status: 500, bodyText: "", nowMs: NOW });
    expect(outage.status === "failed" && outage.errorCode).toBe("provider.outage");
  });

  test("a missing fixture fails naming it rather than weakening the assertion", () => {
    expect(() => readFixture("coding-plan/absent.json")).toThrow("missing fixture coding-plan/absent.json");
  });

  test("globalThis.fetch is never reached by the pure mappings", () => {
    const original = globalThis.fetch;
    let reached = false;
    globalThis.fetch = (() => {
      reached = true;
      throw new Error("fetch reached");
    }) as typeof globalThis.fetch;
    try {
      normalizeOpenAiUsage({ status: 200, bodyText: readFixture("openai/nominal.json"), nowMs: NOW });
      normalizeCodingPlanWindows({ status: 200, bodyText: readFixture("coding-plan/nominal.json"), nowMs: NOW });
      normalizeDeepseekBalance({ status: 200, bodyText: readFixture("deepseek/above.json"), floor: 5 });
      expect(reached).toBe(false);
    } finally {
      globalThis.fetch = original;
    }
  });
});
