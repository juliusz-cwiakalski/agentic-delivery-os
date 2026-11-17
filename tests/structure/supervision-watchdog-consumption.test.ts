/**
 * TC-SUP-030 / TC-SUP-032 (structure half) — the delivered bound, verdict
 * family, and classification are consumed, not reimplemented (GH-295 AC-F4-1,
 * NFR-1, DEC-1).
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DAEMON_DEFAULT_LOCK_STALENESS_MS,
  DAEMON_LANE_LIVENESS_CLASSIFICATIONS,
  SUPERVISION_CLAIM_LIVENESS_BOUND_MS,
  SUPERVISION_CORROBORATION_BOUND_MS,
  SUPERVISION_STATES,
  WATCHDOG_PROBES,
  WATCHDOG_STALL_HEARTBEAT_MS,
  WATCHDOG_VERDICTS,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const SUPERVISE_MODULES = [
  "packages/core/src/contracts/supervise.ts",
  "packages/core/src/domain/supervise.ts",
  "packages/core/src/app/supervise.ts",
] as const;

const textOf = (file: string): string =>
  existsSync(join(ROOT, file)) ? readFileSync(join(ROOT, file), "utf8") : "";

describe("TC-SUP-030 the corroboration bound and verdict family are imported", () => {
  test("the supervision bound resolves to the delivered stall bound", () => {
    expect(SUPERVISION_CORROBORATION_BOUND_MS).toBe(WATCHDOG_STALL_HEARTBEAT_MS);
    expect(SUPERVISION_CLAIM_LIVENESS_BOUND_MS).toBe(DAEMON_DEFAULT_LOCK_STALENESS_MS);
  });

  test("no supervision module carries the bound as a literal", () => {
    const violations: string[] = [];
    for (const file of SUPERVISE_MODULES) {
      const text = textOf(file);
      if (/300_000|300000/u.test(text)) violations.push(file);
    }
    expect(violations).toEqual([]);
  });

  test("the probe implementations are not redeclared in the supervise tier", () => {
    const violations: string[] = [];
    for (const file of SUPERVISE_MODULES) {
      const text = textOf(file);
      for (const probe of WATCHDOG_PROBES) {
        if (new RegExp(`(function|const)\\s+${probe}\\b`, "u").test(text)) {
          violations.push(`${file}: ${probe}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test("the delivered verdict vocabulary is unchanged and the tri-state is a mapping", () => {
    expect([...WATCHDOG_VERDICTS]).toEqual(["ok", "refused", "stalled", "progressing"]);
    expect([...DAEMON_LANE_LIVENESS_CLASSIFICATIONS]).toEqual([
      "progressing",
      "stalled",
      "unknown",
    ]);
    // A declared mapping is not a renamed copy: the sets are distinct.
    expect([...SUPERVISION_STATES]).not.toEqual([...WATCHDOG_VERDICTS]);
  });
});

describe("TC-SUP-032 there is one predicate home", () => {
  test("the domain calls the delivered lane classification", () => {
    const domain = textOf("packages/core/src/domain/supervise.ts");
    expect(domain).toContain('from "./daemon-lane.js"');
    expect(domain).toContain("classifyLaneProgress(");
  });

  test("no second advancing or stale predicate is declared", () => {
    const domain = textOf("packages/core/src/domain/supervise.ts");
    for (const pattern of [/function\s+isStale/u, /function\s+isAdvancing/u, /const\s+isStale/u]) {
      expect(pattern.test(domain)).toBe(false);
    }
  });

  test("the delivered watchdog contract module is untouched by this change", () => {
    const contract = textOf("packages/core/src/contracts/watchdog.ts");
    expect(contract).toContain("export const WATCHDOG_STALL_HEARTBEAT_MS = 300_000 as const;");
    expect(contract).toContain('["preflight", "teardown", "liveness"] as const');
  });
});
