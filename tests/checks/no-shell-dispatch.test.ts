/**
 * TC-SHELL-002 — the static no-shell invariant is green on the live tree, its
 * surface list cannot rot, and each rule fails BY NAME on a planted reference
 * while the legitimate controls report nothing (GH-347 AC-F9-5, NFR-5).
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  DISPATCH_FLOW_SURFACE,
  missingSurfaceFiles,
  NO_SHELL_ALLOWLIST,
  scan,
  scanSource,
} from "../../scripts/checks/no-shell-dispatch";

const ROOT = process.cwd();

describe("TC-SHELL-002 the static no-shell invariant", () => {
  test("the live tree is clean and every declared surface file exists", () => {
    expect(missingSurfaceFiles(ROOT)).toEqual([]);
    expect(DISPATCH_FLOW_SURFACE.length).toBeGreaterThan(0);
    expect(scan(ROOT)).toEqual([]);
    // The allowlist is declared empty: a violation can never be silenced.
    expect(NO_SHELL_ALLOWLIST).toEqual([]);
  });

  test("R1 reports a script-path literal by rule and file", () => {
    const violations = scanSource(
      "planted.ts",
      'const script = "scripts/deliver-ticket.sh";\nexport { script };\n',
    );
    expect(violations.map((violation) => violation.rule)).toContain("script-path literal");
    expect(violations[0]?.file).toBe("planted.ts");
    expect(violations[0]?.line).toBe(1);
  });

  test("R2 reports shell: true", () => {
    const violations = scanSource(
      "planted.ts",
      "const options = { shell: true };\nexport { options };\n",
    );
    expect(violations.map((violation) => violation.rule)).toContain("shell-enabled spawn");
  });

  test("R3 reports a child-process exec import by name", () => {
    const violations = scanSource(
      "planted.ts",
      'import { execSync } from "node:child_process";\nexport const run = () => execSync("true");\n',
    );
    expect(violations.map((violation) => violation.rule)).toContain("shell-exec import");
  });

  test("R4 reports a child-process spawn without shell:false", () => {
    const violations = scanSource(
      "planted.ts",
      'import { spawn } from "node:child_process";\nexport const run = () => spawn("x", [], { cwd: "/" });\n',
    );
    expect(violations.map((violation) => violation.rule)).toContain(
      "child-process spawn without shell:false",
    );
  });

  test("the false-positive controls report nothing", () => {
    const controls = [
      // A member access shaped like a script path is not a literal.
      'const facts = { head: { sha: "abc" } };\nexport const sha = facts.head.sha;\n',
      // A RegExp.exec call is not a child-process call.
      'const pattern = /x/u;\nexport const found = pattern.exec("x");\n',
      // A port object's .spawn( is not a child-process call.
      'export const run = (ports: { spawn: (x: string) => void }) => ports.spawn("x");\n',
      // shell: false is accepted.
      'import { spawn } from "node:child_process";\nexport const run = () => spawn("x", [], { shell: false });\n',
      // A scripts/ reference in a comment is not a literal.
      "// see scripts/checks/no-shell-dispatch.ts\nexport const ok = 1;\n",
    ];
    for (const source of controls) {
      expect(scanSource("control.ts", source), source.slice(0, 40)).toEqual([]);
    }
  });

  test("a planted reference is reported through the temp-workspace scan", () => {
    const root = mkdtempSync(join(ROOT, "tmp", "tmpdir", "no-shell-control-"));
    try {
      mkdirSync(join(root, "surface"), { recursive: true });
      writeFileSync(
        join(root, "surface", "planted.ts"),
        'export const script = "tools/deliver-ticket";\n',
      );
      const violations = scan(root, ["surface/planted.ts"]);
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        rule: "script-path literal",
        file: "surface/planted.ts",
        line: 1,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
