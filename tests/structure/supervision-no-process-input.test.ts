/**
 * TC-SUP-014 — the classification input shape declares no process-derived field,
 * structurally (GH-295 NFR-2, DEC-4, AC-F2-1, AC-F4-1).
 *
 * The guard extends the delivered coordinator no-CPU marker set instead of
 * forking it: every delivered marker is asserted to be present in this list.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { SUPERVISION_CLASSIFICATION_INPUT_FIELDS } from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const CONTRACT = "packages/core/src/contracts/supervise.ts";

/** The supervise modules the scan covers; absent files are simply not scanned. */
const SUPERVISE_MODULES = [
  "packages/core/src/contracts/supervise.ts",
  "packages/core/src/domain/supervise.ts",
  "packages/core/src/domain/supervise-text.ts",
  "packages/core/src/app/supervise.ts",
  "packages/cli/src/commands/supervise.ts",
] as const;

/**
 * The process-shaped markers no supervision module may contain. `pid` and the
 * CPU markers extend the delivered coordinator set by inclusion, never a fork.
 */
export const SUPERVISION_PROCESS_MARKERS = [
  "pid",
  "ppid",
  "process.start",
  "starttime",
  "cpuUsage",
  "cpuPercent",
  "cpu_percent",
  "os.cpus",
  "loadavg",
  "process.cpu",
  "%cpu",
  "ps -o",
  "getrusage",
  "usage.cpu",
  "kill(",
  "child_process",
  "SIGTERM",
  "SIGKILL",
  "spawn(",
  "execFile(",
] as const;

const declaredTypeMembers = (file: string, typeName: string): string[] => {
  const path = join(ROOT, file);
  if (!existsSync(path)) return [];
  const source = ts.createSourceFile(
    file,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const members: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isTypeAliasDeclaration(node) && node.name.text === typeName) {
      const type = node.type;
      if (ts.isTypeLiteralNode(type)) {
        for (const member of type.members) {
          if (ts.isPropertySignature(member) && ts.isIdentifier(member.name)) {
            members.push(member.name.text);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return members;
};

describe("TC-SUP-014 the artifact-only input shape is exact", () => {
  test("the declared shape has exactly the artifact-only members", () => {
    const members = declaredTypeMembers(CONTRACT, "SupervisionClassificationInput");
    expect(members).toEqual([...SUPERVISION_CLASSIFICATION_INPUT_FIELDS]);
  });

  test("no declared member is process-shaped", () => {
    for (const field of SUPERVISION_CLASSIFICATION_INPUT_FIELDS) {
      const lowered = field.toLowerCase();
      expect(SUPERVISION_PROCESS_MARKERS.some((marker) => lowered.includes(marker))).toBe(false);
    }
  });

  test("a pid member added to the shape fails with the field named", () => {
    const mutated = [...SUPERVISION_CLASSIFICATION_INPUT_FIELDS, "processIdentifier", "pid"];
    expect(mutated).not.toEqual([...SUPERVISION_CLASSIFICATION_INPUT_FIELDS]);
    expect(mutated.filter((field) => SUPERVISION_PROCESS_MARKERS.includes(field))).toEqual(["pid"]);
  });
});

describe("TC-SUP-014 the supervise tier carries no process marker", () => {
  test("no supervise module contains a process-shaped marker", () => {
    const violations: string[] = [];
    for (const file of SUPERVISE_MODULES) {
      const path = join(ROOT, file);
      if (!existsSync(path)) continue;
      const text = readFileSync(path, "utf8").toLowerCase();
      for (const marker of SUPERVISION_PROCESS_MARKERS) {
        if (text.includes(marker.toLowerCase())) violations.push(`${file}: marker ${marker}`);
      }
    }
    expect(violations).toEqual([]);
  });

  test("the delivered coordinator guard's marker list is covered by this list, not forked", () => {
    const delivered = readFileSync(
      join(ROOT, "tests/structure/coordinator-no-cpu.test.ts"),
      "utf8",
    );
    const block = delivered.match(/const CPU_MARKERS = \[([\s\S]*?)\];/u);
    expect(block).not.toBeNull();
    const markers = [...(block?.[1] ?? "").matchAll(/"([^"]+)"/gu)].map(
      (match) => match[1] as string,
    );
    expect(markers.length).toBeGreaterThan(0);
    const own = SUPERVISION_PROCESS_MARKERS.map((entry) => entry.toLowerCase());
    for (const marker of markers) {
      expect(
        own.some((entry) => marker.toLowerCase().includes(entry)),
        marker,
      ).toBe(true);
    }
  });

  test("no state-tier supervise module exists (the fold appends through delivered paths)", () => {
    const stateFiles = readdirSync(join(ROOT, "packages/core/src/state"));
    expect(stateFiles.filter((file) => file.includes("supervise"))).toEqual([]);
  });
});
