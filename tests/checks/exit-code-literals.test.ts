/**
 * TC-EXIT-002 — every forbidden exit-code form fails by mutation with file, line,
 * and literal; the projection module is the only permitted digit home.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { SCOPE_LABEL, scanRoot } from "../../scripts/checks/exit-code-literals";

const ROOT = process.cwd();
const PROJECTION = "packages/cli/src/projection.ts";
const tempRoots: string[] = [];

const makeTempRoot = (): string => {
  const root = mkdtempSync(join(tmpdir(), "exit-literals-"));
  tempRoots.push(root);
  cpSync(join(ROOT, "packages/cli/src"), join(root, "packages/cli/src"), { recursive: true });
  mkdirSync(join(root, "packages/core/src/contracts"), { recursive: true });
  cpSync(join(ROOT, "packages/core/src/contracts"), join(root, "packages/core/src/contracts"), {
    recursive: true,
  });
  return root;
};

const writeFile = (root: string, relative: string, content: string): void => {
  const path = join(root, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
};

const appendFile = (root: string, relative: string, content: string): void => {
  const path = join(root, relative);
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  writeFile(root, relative, `${existing}${content}`);
};

const messages = (failures: readonly string[]): string => failures.join("\n");

const gitStatus = (): string =>
  execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" });

afterEach(() => {
  for (const root of tempRoots) rmSync(root, { recursive: true, force: true });
  tempRoots.length = 0;
});

describe("TC-EXIT-002 delivered state", () => {
  test("the live tree is clean and the scope is reported", () => {
    const before = gitStatus();
    const report = scanRoot(ROOT);
    expect(report.failures).toEqual([]);
    expect(report.scannedFiles).toBeGreaterThan(0);
    expect(report.scope).toBe(SCOPE_LABEL);
    expect(report.scope).toContain("tests/** excluded");
    expect(gitStatus()).toBe(before);
  });
});

describe("TC-EXIT-002 forbidden forms", () => {
  test("(a) exitCode: 2 in a command module fails naming file, line, and literal", () => {
    const root = makeTempRoot();
    appendFile(
      root,
      "packages/cli/src/commands/probe.ts",
      "\nexport const exitCode: number = 2;\n",
    );
    const report = scanRoot(root);
    const text = messages(report.failures);
    expect(text).toContain("packages/cli/src/commands/probe.ts");
    expect(text).toContain("exitCode literal 2");
  });

  test("(a) an exitCode property assignment in a command module fails", () => {
    const root = makeTempRoot();
    appendFile(
      root,
      "packages/cli/src/commands/probe.ts",
      "\nexport const value = { exitCode: 2 };\n",
    );
    const report = scanRoot(root);
    expect(messages(report.failures)).toContain("exitCode literal 2");
  });

  test("(b) process.exit(1) fails", () => {
    const root = makeTempRoot();
    appendFile(root, "packages/cli/src/commands/probe.ts", "\nprocess.exit(1);\n");
    const report = scanRoot(root);
    expect(messages(report.failures)).toContain("process.exit(...) is forbidden");
  });

  test("(c) numeric 3 in the projection table fails", () => {
    const root = makeTempRoot();
    const projection = readFileSync(join(root, PROJECTION), "utf8").replace(
      '"platform-provider": 2',
      '"platform-provider": 3',
    );
    writeFile(root, PROJECTION, projection);
    const report = scanRoot(root);
    const text = messages(report.failures);
    expect(text).toContain(PROJECTION);
    expect(text).toContain("projection literal 3");
  });

  test("(d) exitCode: derived inside the projection module stays clean", () => {
    const root = makeTempRoot();
    appendFile(root, PROJECTION, "\nexport const metadata = { exitCode: derived };\n");
    const report = scanRoot(root);
    expect(report.failures).toEqual([]);
  });

  test("process.exit anywhere in the surface fails", () => {
    const root = makeTempRoot();
    appendFile(root, PROJECTION, "\nprocess.exit(0);\n");
    const report = scanRoot(root);
    expect(messages(report.failures)).toContain("process.exit(...) is forbidden");
  });
});
