/**
 * TC-PROV-011/012/013 — UTC peak boundary matrix, declarative custom windows,
 * and MAX combination with quota.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import type { ProviderConditionResult, ProviderPeakWindow } from "../../packages/core/src/contracts/index";
import { combineProviderConditions } from "../../packages/core/src/provider/conditions";
import { evaluatePeakWindow } from "../../packages/core/src/provider/peak";
import { parseProviderConfiguration } from "../../packages/core/src/provider/validate";

const ROOT = process.cwd();
const at = (hours: number, minutes: number, seconds: number): number =>
  Date.UTC(2026, 0, 1, hours, minutes, seconds);
const zai: ProviderPeakWindow = {
  timezone: "UTC",
  startSecondsOfDay: 21600,
  endSecondsOfDay: 36000,
  bufferSeconds: 7200,
};
const parked = (waitSeconds: number, expiresAtMs: number): ProviderConditionResult => ({
  status: "parked",
  kind: "quota-exhausted",
  waitSeconds,
  expiresAtMs,
  announcementCode: "provider.quota.parked",
  evidence: { conditionKinds: ["quota-exhausted"], waitSeconds },
});

describe("TC-PROV-011 peak boundary and buffer matrix", () => {
  test("the four boundary instants match the half-open window", () => {
    const clearBefore = evaluatePeakWindow(zai, at(3, 59, 59));
    expect(clearBefore).toEqual({ status: "clear" });
    const start = evaluatePeakWindow(zai, at(4, 0, 0));
    expect(start.status).toBe("parked");
    if (start.status === "parked") {
      expect(start.waitSeconds).toBe(21600);
      expect(start.expiresAtMs).toBe(at(10, 0, 0));
      expect(start.kind).toBe("peak-window");
      expect(start.announcementCode).toBe("provider.peak.parked");
    }
    const nearEnd = evaluatePeakWindow(zai, at(9, 59, 59));
    expect(nearEnd.status).toBe("parked");
    if (nearEnd.status === "parked") expect(nearEnd.waitSeconds).toBe(1);
    expect(evaluatePeakWindow(zai, at(10, 0, 0))).toEqual({ status: "clear" });
  });

  test("a buffer crossing midnight clamps to the day boundary", () => {
    const window: ProviderPeakWindow = {
      timezone: "UTC",
      startSecondsOfDay: 3600,
      endSecondsOfDay: 7200,
      bufferSeconds: 7200,
    };
    const result = evaluatePeakWindow(window, at(0, 30, 0));
    expect(result.status).toBe("parked");
    if (result.status === "parked") {
      expect(result.waitSeconds).toBe(5400);
      expect(result.expiresAtMs).toBe(at(2, 0, 0));
    }
  });
});

describe("TC-PROV-012 custom window is declarative", () => {
  test("the fixture values drive the result and no vendor constant is hardcoded", () => {
    const parsed = parseProviderConfiguration(
      parse(readFileSync(join(ROOT, "tests/fixtures/provider/config/peak-custom.yaml"), "utf8")),
    );
    if (!parsed.ok) throw new Error("peak-custom fixture did not parse");
    const window = parsed.config.entries.custom?.peak;
    if (window === undefined) throw new Error("peak-custom fixture has no peak");
    expect(evaluatePeakWindow(window, at(0, 45, 0))).toMatchObject({
      status: "parked",
      waitSeconds: 4500,
    });
    expect(evaluatePeakWindow(window, at(1, 29, 0))).toMatchObject({
      status: "parked",
      waitSeconds: 1860,
    });
    expect(evaluatePeakWindow(window, at(2, 0, 0))).toEqual({ status: "clear" });

    const source = readFileSync(join(ROOT, "packages/core/src/provider/peak.ts"), "utf8");
    for (const forbidden of ["21600", "36000", "7200", "api.z.ai", "zai"]) {
      expect(source, forbidden).not.toContain(forbidden);
    }
  });
});

describe("TC-PROV-013 peak and quota combine by MAX", () => {
  test("the later expiry determines the single cause and both kinds stay visible", () => {
    const now = at(6, 0, 0);
    const peak = evaluatePeakWindow(zai, now);
    if (peak.status !== "parked") throw new Error("expected a peak park");
    const combined = combineProviderConditions([
      peak,
      parked(30000, now + 30000 * 1000),
    ]);
    expect(combined.status).toBe("parked");
    if (combined.status !== "parked") return;
    expect(combined.waitSeconds).toBe(30000);
    expect(combined.expiresAtMs).toBe(now + 30000 * 1000);
    expect(combined.conditions).toEqual(["peak-window", "quota-exhausted"]);
    expect(combined.cause).toBe("quota-exhausted");

    const swapped = combineProviderConditions([
      peak,
      parked(1000, now + 1000 * 1000),
    ]);
    expect(swapped.status).toBe("parked");
    if (swapped.status === "parked") {
      expect(swapped.cause).toBe("peak-window");
      expect(swapped.expiresAtMs).toBe(peak.expiresAtMs);
    }
  });

  test("a failed condition fails loud and keeps the closed condition kinds", () => {
    const combined = combineProviderConditions([
      {
        status: "failed",
        kind: "quota-exhausted",
        errorCode: "provider.quota.exceeded",
        announcementCode: "provider.quota.reset_missing",
        evidence: { conditionKinds: ["quota-exhausted"] },
      },
    ]);
    expect(combined.status).toBe("failed");
    if (combined.status === "failed") {
      expect(combined.errorCode).toBe("provider.quota.exceeded");
      expect(combined.conditions).toEqual(["quota-exhausted"]);
    }
  });
});
