/**
 * GH-301 layout invariants (TC-MEMLAY-001, TC-MEMLAY-002 step 1, TC-MEMLAY-003).
 *
 * The live committed tree is the assertion target; the negative mutant copies
 * it to a temporary root and adds an invented area. The coverage half of
 * TC-MEMLAY-002 lives in `tests/checks/memory-lint-index.test.ts` where the
 * evaluator is delivered.
 */
import { describe, expect, test } from "bun:test";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isRecordFileName } from "../fixtures/memory/tree";

const ROOT = process.cwd();
const MEMORY = ".ai/memory";
const AREAS = ["agents", "lessons", "tacit", "preferences", "guilds", "retro"];

const isDirectory = (path: string): boolean =>
  statSync(path, { throwIfNoEntry: false })?.isDirectory() === true;

/** Return every canonical-layout defect naming the offending path. */
export const layoutViolations = (root: string): string[] => {
  const violations: string[] = [];
  const memory = join(root, MEMORY);
  const top = readdirSync(memory, { withFileTypes: true });
  const files = top
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
  const dirs = top
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (!files.includes("README.md")) violations.push(`${MEMORY}/README.md is missing`);
  for (const area of AREAS) {
    if (!dirs.includes(area)) violations.push(`${MEMORY}/${area}/ is missing`);
  }
  for (const name of files) {
    if (name !== "README.md") violations.push(`${MEMORY}/${name}: unexpected top-level file`);
  }
  for (const name of dirs) {
    if (!AREAS.includes(name)) violations.push(`${MEMORY}/${name}/: unexpected area`);
  }
  if (dirs.includes("external"))
    violations.push(`${MEMORY}/external/: external/quarantine area must be absent`);
  for (const agent of readdirSync(join(memory, "agents"), { withFileTypes: true })) {
    if (!agent.isDirectory()) continue;
    if (!statSync(join(memory, "agents", agent.name, "README.md"), { throwIfNoEntry: false })) {
      violations.push(`${MEMORY}/agents/${agent.name}/README.md is missing`);
    }
  }
  for (const guild of readdirSync(join(memory, "guilds"), { withFileTypes: true })) {
    if (!guild.isDirectory()) continue;
    if (!statSync(join(memory, "guilds", guild.name, "README.md"), { throwIfNoEntry: false })) {
      violations.push(`${MEMORY}/guilds/${guild.name}/README.md is missing`);
    }
  }
  const emptyAreas = ["lessons", "tacit", "preferences", "guilds"];
  for (const area of emptyAreas) {
    const entries = readdirSync(join(memory, area)).filter((name) => name !== ".gitkeep");
    if (
      entries.length === 0 &&
      !statSync(join(memory, area, ".gitkeep"), { throwIfNoEntry: false })
    ) {
      violations.push(`${MEMORY}/${area}/.gitkeep is missing`);
    }
  }
  if (
    !files.includes("README.md") ||
    !statSync(join(memory, "retro", "INDEX.md"), { throwIfNoEntry: false })
  ) {
    violations.push(`${MEMORY}/retro/INDEX.md is missing`);
  }
  return violations;
};

const indexPathColumn = (root: string): string[] => {
  const readme = readFileSync(join(root, MEMORY, "README.md"), "utf8");
  const start = readme.indexOf("\n## Index\n");
  const section = start === -1 ? "" : readme.slice(start + 1);
  const rows = section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && !/^\|[\s:|-]+\|$/.test(line));
  return rows
    .slice(1)
    .map((line) => {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());
      return (cells[0] ?? "").replace(/^`|`$/g, "");
    })
    .filter((path) => path.length > 0);
};

describe("TC-MEMLAY canonical memory tree", () => {
  test("TC-MEMLAY-001 the committed tree equals the canonical layout", () => {
    expect(layoutViolations(ROOT)).toEqual([]);
  });

  test("TC-MEMLAY-002 placeholders and directories are never records or index targets", () => {
    const paths = indexPathColumn(ROOT);
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(path.includes(".gitkeep")).toBe(false);
      expect(isDirectory(join(ROOT, MEMORY, path))).toBe(false);
    }
    expect(isRecordFileName(".gitkeep")).toBe(false);
  });

  test("TC-MEMLAY-003 an invented area fails the same layout assertion", () => {
    expect(layoutViolations(ROOT)).toEqual([]);
    const tempRoot = mkdtempSync(join(tmpdir(), "gh301-layout-"));
    try {
      cpSync(join(ROOT, MEMORY), join(tempRoot, MEMORY), { recursive: true });
      mkdirSync(join(tempRoot, MEMORY, "external"), { recursive: true });
      writeFileSync(join(tempRoot, MEMORY, "external", "README.md"), "# fleet\n");
      const violations = layoutViolations(tempRoot);
      expect(violations.some((entry) => entry.includes("external"))).toBe(true);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
    expect(statSync(join(ROOT, MEMORY, "external"), { throwIfNoEntry: false })).toBeUndefined();
  });
});
