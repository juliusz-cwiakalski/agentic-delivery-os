/**
 * TC-HARNESS-005 (structural half) / TC-HARNESS-004 (constant half) — the window
 * is pinned data with no configuration key that widens or narrows it.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PRODUCTION_CATALOG } from "../../packages/core/src/config/catalog";
import {
  HARNESS_SUPPORTED_VERSION_WINDOW,
  HARNESS_VERSION_WINDOW_RULE,
} from "../../packages/core/src/contracts/index";
import {
  evaluateHarnessVersion,
  normalizeHarnessVersion,
} from "../../packages/core/src/domain/index";

const ROOT = process.cwd();
const WINDOW_SOURCE = "packages/core/src/domain/harness-version-window.ts";
const CONTRACTS_SOURCE = "packages/core/src/contracts/harness.ts";

describe("TC-HARNESS-005 the pinned window", () => {
  test("the constant is exactly the rule's value at delivery", () => {
    expect([...HARNESS_SUPPORTED_VERSION_WINDOW.minors]).toEqual(["2.3", "2.2"]);
    expect(HARNESS_SUPPORTED_VERSION_WINDOW.rule).toBe(
      "current-minor-at-delivery-plus-one-previous-minor",
    );
    expect(HARNESS_VERSION_WINDOW_RULE).toBe(
      "the current minor line at delivery time plus one previous minor",
    );
  });

  test("the constant carries its revisit note beside the literal", () => {
    const source = readFileSync(join(ROOT, CONTRACTS_SOURCE), "utf8");
    const start = source.indexOf("HARNESS_SUPPORTED_VERSION_WINDOW = {");
    expect(start).toBeGreaterThan(-1);
    const comment = source
      .slice(Math.max(0, start - 900), start)
      .replace(/\*/gu, " ")
      .replace(/\s+/gu, " ");
    expect(comment).toContain("Re-evaluate when the harness minor advances");
    expect(comment).toContain("2.2");
    expect(comment).toContain("2.1");
  });

  test("the typed harness branch declares no window member", () => {
    const harness = PRODUCTION_CATALOG.harness as unknown as {
      readonly fields: Readonly<Record<string, unknown>>;
    };
    const keys = Object.keys(harness.fields).sort();
    expect(keys).toEqual(["environment", "execution", "kind", "mode", "stores"]);
    for (const key of keys) {
      expect(key.toLowerCase()).not.toContain("window");
      expect(key.toLowerCase()).not.toContain("supportedversion");
    }
  });

  test("the window module reads no configuration and no ambient value", () => {
    const source = readFileSync(join(ROOT, WINDOW_SOURCE), "utf8");
    expect(source).not.toContain("process.env");
    expect(source).not.toContain("#config/");
    expect(source).not.toContain("ConfigValue");
    expect(source).not.toContain("readFileSync");
  });

  test("widening the window data flips an out-of-window line (V-18) and unbounded data accepts (V-19)", () => {
    expect(normalizeHarnessVersion("opencode v2.4.0")).toBe("2.4.0");
    expect(evaluateHarnessVersion("opencode v2.4.0").verdict).toBe("outside");
    expect(evaluateHarnessVersion("opencode v2.4.0", ["2.4", "2.3", "2.2"]).verdict).toBe("inside");
    expect(evaluateHarnessVersion("opencode v9.9.9").verdict).toBe("outside");
    expect(evaluateHarnessVersion("opencode v9.9.9", ["9.9"]).verdict).toBe("inside");
  });
});
