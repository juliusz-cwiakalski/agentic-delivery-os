/**
 * TC-GATE-001 — the aggregate gate stays offline and ordered.
 *
 * The check chain keeps its five named steps, the GH-394 allowlist tripwire,
 * three trailing scans, gains no milestone or network step, and no
 * chain-reachable module imports the GitHub adapter. The new suites ride the
 * existing `bun test` discovery only.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  NAMED_CHECKS,
  validate as validateScriptSurface,
} from "../../scripts/checks/script-surface";

const ROOT = process.cwd();
const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

const manifest = (): { scripts?: Record<string, string> } =>
  JSON.parse(read("package.json")) as { scripts?: Record<string, string> };

const modules = [
  "scripts/checks/milestone-attachment.ts",
  "scripts/checks/milestone-attachment-runner.ts",
  "scripts/checks/milestone-attachment-github.ts",
] as const;

describe("TC-GATE-001 aggregate chain unchanged and ordered", () => {
  test("the five named checks, the tripwire and memory members, the two scan members, and the three trailing scans stay ordered", () => {
    const check = manifest().scripts?.check ?? "";
    const parts = check.split("&&").map((part) => part.trim());
    expect(
      parts
        .slice(0, NAMED_CHECKS.length)
        .map((part, index) => part.includes(NAMED_CHECKS[index] ?? "")),
    ).toEqual(NAMED_CHECKS.map(() => true));
    // Re-pinned (GH-394 review iter-2 F-7): the allowlist tripwire is a
    // deliberate chain member between check:boundaries and check:memory.
    expect(parts[NAMED_CHECKS.length]).toContain("scripts/checks/allowlist-tripwire.ts");
    const memoryIndex = parts.indexOf("pnpm check:memory");
    expect(memoryIndex).toBe(NAMED_CHECKS.length + 1);
    expect(parts[memoryIndex + 1]).toContain("pnpm check:forbidden-literals");
    expect(parts[memoryIndex + 2]).toContain("pnpm check:namespace-tree");
    for (const scan of [
      "scripts/checks/prompt-conformance.ts",
      "scripts/checks/help-guide-coverage.ts",
      "scripts/checks/exports-parity.ts",
    ]) {
      expect(parts.some((part) => part.includes(scan))).toBe(true);
    }
    expect(parts.length).toBe(NAMED_CHECKS.length + 1 + 1 + 2 + 3);
  });

  test("the chain contains no milestone token and no network command", () => {
    const check = manifest().scripts?.check ?? "";
    expect(check).not.toMatch(/milestone/i);
    expect(check).not.toMatch(/ticket-milestone|workflow_dispatch/);
    for (const forbidden of ["curl", "wget", "gh ", "http://", "https://", "node:http", "fetch("]) {
      expect(check).not.toContain(forbidden);
    }
  });

  test("no alternate aggregate exists and the script surface validates", () => {
    const scripts = manifest().scripts ?? {};
    for (const alternate of ["verify", "ci", "all", "validate", "precommit"]) {
      expect(alternate in scripts).toBe(false);
    }
    expect(validateScriptSurface(ROOT)).toEqual([]);
  });
});

describe("TC-GATE-001 no network-capable path is chain-reachable", () => {
  test("the core and runner import no network or process API", () => {
    for (const relative of modules.slice(0, 2)) {
      const text = read(relative);
      for (const forbidden of [
        "node:http",
        "node:https",
        "node:child_process",
        "fetch(",
        "octokit",
        "@octokit",
      ]) {
        expect(text, `${relative}: ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  test("the GitHub adapter is the only network-capable module and is not imported on a gate path", () => {
    expect(read(modules[2])).toMatch(/fetch\(/);
    expect(read(modules[0])).not.toContain("milestone-attachment-github");
    expect(read(modules[1])).not.toContain("milestone-attachment-github");
    for (const name of readdirSync(join(ROOT, "tests/checks"))) {
      if (!name.endsWith(".test.ts") || name === "milestone-gate.test.ts") continue;
      const text = read(`tests/checks/${name}`);
      expect(text, name).not.toContain('from "../../scripts/checks/milestone-attachment-github"');
    }
  });

  test("the new suites ride bun test discovery and no manifest script names them", () => {
    const scripts = manifest().scripts ?? {};
    const serialized = JSON.stringify(scripts);
    expect(serialized).not.toContain("milestone");
    expect(serialized).not.toContain("tests/checks");
    expect(scripts.test).toBe("bun test");
    expect(serialized).not.toContain("ticket-milestone-check.yml");
  });

  test("the workflow path is absent from the aggregate and every manifest script", () => {
    const text = JSON.stringify(manifest());
    expect(text).not.toContain("ticket-milestone-check.yml");
    expect(text).not.toContain("milestone-attachment");
  });
});
