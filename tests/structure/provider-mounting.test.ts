/**
 * GH-350 TC-MOUNT-004..007 — the mount's structural truth: the declarative set
 * is exactly 27 with `provider` last, the composition filter drops an extra
 * family and keeps the declared keys, the pin set is derived from the fixture,
 * every listed file carries a 27 pin, the tails shift one place, and the
 * stale-detector class is widened to `2[3456]` (AC-F8-4, AC-F8-5; TDR-0061).
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PROMPT_REQUIRED_COMMANDS,
  selectPromptRequiredProgram,
} from "../../packages/cli/src/entrypoint";
import { allHelpEntries, renderRootHelp } from "../../packages/cli/src/help";
import { resolveBrandIdentity } from "../../packages/core/src/branding";
import { MOUNTED_FAMILIES, PINNING_FILES } from "../fixtures/metrics/mounting";

const ROOT = process.cwd();

const brandOf = (workingName: string) => {
  const resolved = resolveBrandIdentity({ workingName });
  if (!resolved.ok) throw new Error(`the resolver rejected ${workingName}`);
  return resolved.value;
};

const familyRows = (text: string): readonly string[] => {
  const rows: string[] = [];
  for (const line of text.split("\n")) {
    const match = /^ {2}([a-z][a-z0-9-]*) {2}\S/u.exec(line);
    if (match?.[1] !== undefined) rows.push(match[1]);
  }
  return rows;
};

describe("TC-MOUNT-005 the declarative set is exactly 27 with provider last", () => {
  test("the set equals the mounted fixture element for element", () => {
    expect(MOUNTED_FAMILIES).toHaveLength(27);
    expect([...PROMPT_REQUIRED_COMMANDS]).toEqual([...MOUNTED_FAMILIES]);
    expect(PROMPT_REQUIRED_COMMANDS).toHaveLength(27);
  });

  test("provider is last, install 26th and supervise 25th by index", () => {
    expect(PROMPT_REQUIRED_COMMANDS.at(-1)).toBe("provider");
    expect(PROMPT_REQUIRED_COMMANDS.at(-2)).toBe("install");
    expect(PROMPT_REQUIRED_COMMANDS.at(-3)).toBe("supervise");
    expect(PROMPT_REQUIRED_COMMANDS.at(-4)).toBe("metrics");
    expect(PROMPT_REQUIRED_COMMANDS.indexOf("install")).toBe(25);
    expect(PROMPT_REQUIRED_COMMANDS.indexOf("supervise")).toBe(24);
    expect(PROMPT_REQUIRED_COMMANDS.filter((name) => name === "provider")).toHaveLength(1);
  });

  test("both bins render the same 27 family rows in the same order", () => {
    const alias = familyRows(renderRootHelp(brandOf("delivery-os")));
    const primary = familyRows(renderRootHelp(brandOf("jaiship")));
    expect(alias).toHaveLength(27);
    expect(primary).toEqual(alias);
    expect(alias.at(-2)).toBe("install");
    expect(alias.at(-1)).toBe("provider");
  });
});

describe("TC-MOUNT-004 the composition guard only advertises the declared set", () => {
  const synthesise = (extra: readonly string[]) => {
    const commands: Record<string, { handler: () => { data: Record<string, never> } }> = {};
    for (const name of [...PROMPT_REQUIRED_COMMANDS, ...extra]) {
      commands[name] = { handler: () => ({ data: {} }) };
    }
    return { commands };
  };

  test("an extra synthetic family is dropped and the selected keys equal the declared set", () => {
    const selected = selectPromptRequiredProgram(synthesise(["synthetic-extra", "config"]));
    expect(Object.keys(selected.commands)).toEqual([...PROMPT_REQUIRED_COMMANDS]);
    expect(Object.keys(selected.commands)).not.toContain("synthetic-extra");
    expect(Object.keys(selected.commands)).not.toContain("config");
    expect(Object.keys(selected.commands)).toHaveLength(27);
  });

  test("a missing declared family throws by name instead of shipping a partial surface", () => {
    const partial = synthesise([]);
    const withoutProvider = Object.fromEntries(
      Object.entries(partial.commands).filter(([name]) => name !== "provider"),
    );
    expect(() => selectPromptRequiredProgram({ commands: withoutProvider })).toThrow(
      /prompt-required command "provider" is not composed/u,
    );
  });
});

describe("TC-MOUNT-006 every PINNING_FILES entry reads 27 and the set is derived", () => {
  const countPins = (path: string): string[] => {
    const text = readFileSync(join(ROOT, path), "utf8");
    const findings: string[] = [];
    const current = text
      .split("\n")
      .filter(
        (line) =>
          !line.includes("MOUNTED_FAMILIES") &&
          !line.includes("BASE_FAMILIES") &&
          !line.includes("STEER_MOUNTED_FAMILIES") &&
          !line.includes("-> 27") &&
          !line.includes("→ 27") &&
          !line.includes("2[3456]") &&
          !line.includes("toHaveLength\\("),
      )
      .join("\n");
    if (!/toHaveLength\(27\)|\.toBe\(\s*27\s*,?\s*\)/su.test(text)) {
      findings.push(`${path}: no family-count pin 27`);
    }
    if (/toHaveLength\(26\)|\.toBe\(\s*26\s*,?\s*\)/su.test(current)) {
      findings.push(`${path}: current-value pin 26 survives`);
    }
    return findings;
  };

  test("the fixture's pin set is exactly the declared fifteen", () => {
    expect(PINNING_FILES).toHaveLength(15);
    for (const expected of [
      "tests/structure/supervision-mounting.test.ts",
      "tests/structure/install-conformance.test.ts",
      "tests/behaviour/install-family-surface.test.ts",
      "tests/behaviour/entrypoint-two-bins.test.ts",
      "tests/behaviour/ceremony-cli.test.ts",
    ]) {
      expect(PINNING_FILES).toContain(expected);
    }
  });

  test("every listed file exists and carries a 27 pin with no current 26", () => {
    const findings: string[] = [];
    for (const path of PINNING_FILES) {
      if (!existsSync(join(ROOT, path))) findings.push(`${path}: listed file does not exist`);
      findings.push(...countPins(path));
    }
    expect(findings).toEqual([]);
  });

  test("dropping a listed suite from the fixture is visible to the membership check", () => {
    const derived = PINNING_FILES.filter((path) => path !== "tests/behaviour/ceremony-cli.test.ts");
    expect(PINNING_FILES).toContain("tests/behaviour/ceremony-cli.test.ts");
    expect(derived).not.toContain("tests/behaviour/ceremony-cli.test.ts");
    expect(derived).toHaveLength(14);
  });
});

describe("TC-MOUNT-007 the tails shift one place and the stale class widens", () => {
  const read = (path: string): string => readFileSync(join(ROOT, path), "utf8");

  test("no pinning suite asserts install as the last family", () => {
    const failures: string[] = [];
    for (const path of PINNING_FILES) {
      const text = read(path);
      if (/\.at\(-1\)\)\.toBe\("install"\)/u.test(text)) {
        failures.push(`${path}: asserts install last`);
      }
      if (/families\.at\(-1\)[^\n]*startsWith\("install/u.test(text)) {
        failures.push(`${path}: asserts install last family line`);
      }
    }
    expect(failures).toEqual([]);
  });

  test("operators, metrics (23 of 27), install and provider hold the shifted tail", () => {
    expect(read("tests/structure/supervision-mounting.test.ts")).toContain(
      "install at the penultimate family line among 27 families",
    );
    expect(read("tests/structure/metrics-mounting.test.ts")).toContain(
      "metrics mounts at 23 of 27",
    );
    expect(read("tests/structure/install-conformance.test.ts")).toContain(
      'expect(PROMPT_REQUIRED_COMMANDS.at(-1)).toBe("provider")',
    );
    expect(read("tests/behaviour/install-family-surface.test.ts")).toContain(
      'expect(families.at(-1)).toBe("provider")',
    );
  });

  test("every suite that carried a stale detector names the widened set", () => {
    const failures: string[] = [];
    for (const path of PINNING_FILES) {
      const text = read(path);
      if (text.includes("2[345]")) failures.push(`${path}: stale class is not widened`);
      if (text.includes("toHaveLength\\(2[")) {
        if (!text.includes("2[3456]")) failures.push(`${path}: stale class is not 2[3456]`);
      }
      if (text.includes("stale family-count pin") && !text.includes("2[3456]")) {
        // The steer suite scans an explicit digit list instead of a character
        // class; it must name 26 as a surviving count all the same.
        if (!text.includes("[22, 23, 24, 25, 26]")) {
          failures.push(`${path}: stale detector does not cover 26`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  test("the provider family and its seven members are in the static inventory", () => {
    const paths = allHelpEntries()
      .filter((entry) => entry.path[0] === "provider")
      .map((entry) => entry.path.join(" "));
    expect(paths).toEqual([
      "provider",
      "provider resolve",
      "provider quota",
      "provider parks list",
      "provider profile resolve",
      "provider watch status",
      "provider simulate",
      "provider migrate legacy",
    ]);
  });
});
