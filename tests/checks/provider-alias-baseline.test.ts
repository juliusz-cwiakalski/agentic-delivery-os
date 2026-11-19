/**
 * GH-350 TC-MOUNT-008 — the alias help baseline carries exactly one added
 * `provider` line and every other cell is byte-unchanged.
 *
 * The rendered alias help is compared cell by cell against the working-tree
 * fixture and against the pre-change baseline materialised from git. The
 * working fixture's `capturedFrom` (8a1f77ad) predates the fixture's
 * introduction (40dc45a4), so the file cannot be materialised from that
 * commit; the comparison therefore names the last pre-change commit that
 * carries the file, `d1fff222` (GH-346), whose own `capturedFrom` is the same
 * ancestor. The provenance cell is compared against the same materialised copy,
 * so "the note gained exactly the GH-350 clause" is an assertion rather than a
 * hope. A materialisation failure fails the case by name rather than skipping
 * the comparison.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { helpEntryFor } from "../../packages/cli/src/help";

const ROOT = process.cwd();
const BASELINE = "tests/fixtures/entrypoint/alias-baseline.json";
const ALIAS_ENTRY = "packages/cli/bin/delivery-os.ts";
/**
 * The last commit that changed the alias baseline before GH-350. Recorded
 * rather than derived because `git show <capturedFrom>:<path>` cannot
 * materialise a file introduced after that commit; an unreachable commit fails
 * this case by name.
 */
const PRE_CHANGE_BASELINE = "d1fff222279eb4926a92c3b612b98aa34c18d4f3";
const GH350_CLAUSE =
  " Regenerated deliberately on 2026-11-19 for GH-350's twenty-seventh family (`provider`); only the help cell's Commands list gained one line, and every other cell is byte-unchanged.";

type Cell = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

type Baseline = {
  readonly capturedFrom: string;
  readonly capturedFromOriginal: string;
  readonly captureProvenanceNote: string;
  readonly capturedCommand: string;
  readonly cells: {
    readonly version: Cell;
    readonly help: Cell;
    readonly invalidOverrideStatusJson: Cell;
  };
};

const working = JSON.parse(readFileSync(join(ROOT, BASELINE), "utf8")) as Baseline;

const materialise = (commit: string): Baseline => {
  const result = spawnSync("git", ["show", `${commit}:${BASELINE}`], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (result.status !== 0 || result.stdout.trim().length === 0) {
    throw new Error(
      `the pre-change baseline cannot be materialised from ${commit} (${String(result.status)}): ${result.stderr}`,
    );
  }
  return JSON.parse(result.stdout) as Baseline;
};

const captured = ((): (() => Baseline) => {
  let cached: Baseline | undefined;
  return () => {
    cached ??= materialise(PRE_CHANGE_BASELINE);
    return cached;
  };
})();

const environment = (): Record<string, string> => ({
  PATH: process.env.PATH ?? "",
  HOME: process.env.HOME ?? "",
  TMPDIR: process.env.TMPDIR ?? "",
});

const runAlias = (argv: readonly string[], extra: Record<string, string> = {}): Cell => {
  const result = spawnSync("bun", [ALIAS_ENTRY, ...argv], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...environment(), ...extra },
  });
  return {
    exitCode: result.status ?? -1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
};

const stableEnvelope = (text: string): unknown => {
  const parsed = JSON.parse(text) as Record<string, unknown>;
  const { runId: _runId, timing: _timing, ...rest } = parsed;
  return rest;
};

const COMMANDS = "Commands:\n";

const splitHelp = (text: string): { readonly prefix: string; readonly rows: readonly string[] } => {
  const index = text.indexOf(COMMANDS);
  if (index < 0) throw new Error("the help cell carries no Commands section");
  const prefix = text.slice(0, index + COMMANDS.length);
  const rows = text
    .slice(index + COMMANDS.length)
    .trimEnd()
    .split("\n");
  return { prefix, rows };
};

describe("TC-MOUNT-008 the alias baseline delta is exactly one provider line", () => {
  test("the rendered alias help and version cells match the working-tree fixture", () => {
    expect({ ...runAlias(["--version"]) }).toEqual({ ...working.cells.version });
    expect({ ...runAlias(["--help"]) }).toEqual({ ...working.cells.help });
    const containment = runAlias(["status", "--json"], {
      DELIVERY_OS_WORKING_NAME: "bad/name",
    });
    expect(containment.exitCode).toBe(working.cells.invalidOverrideStatusJson.exitCode);
    expect(stableEnvelope(containment.stdout)).toEqual(
      stableEnvelope(working.cells.invalidOverrideStatusJson.stdout),
    );
    expect(containment.stderr).toBe(working.cells.invalidOverrideStatusJson.stderr);
  });

  test("every cell except the help Commands list is byte-identical to the pre-change baseline", () => {
    // The ancestry chain is unchanged: the pre-change baseline and the working
    // baseline name the same capturedFrom.
    expect(working.capturedFrom).toBe(captured().capturedFrom);
    expect(working.capturedFrom).toBe("8a1f77adb3b2d8f95fd9c3766b071642e3af5a7b");
    expect(working.capturedFromOriginal).toBe(captured().capturedFromOriginal);
    expect(working.capturedCommand).toBe(captured().capturedCommand);
    expect(JSON.stringify(working.cells.version)).toBe(JSON.stringify(captured().cells.version));
    expect(JSON.stringify(working.cells.invalidOverrideStatusJson)).toBe(
      JSON.stringify(captured().cells.invalidOverrideStatusJson),
    );
    expect(working.cells.help.exitCode).toBe(captured().cells.help.exitCode);
    expect(working.cells.help.stderr).toBe(captured().cells.help.stderr);
  });

  test("the Commands list gained exactly one provider line at the tail", () => {
    const before = splitHelp(captured().cells.help.stdout);
    const after = splitHelp(working.cells.help.stdout);
    expect(after.prefix).toBe(before.prefix);
    expect(after.rows).toHaveLength(before.rows.length + 1);
    expect(after.rows.slice(0, before.rows.length)).toEqual([...before.rows]);
    const summary = helpEntryFor(["provider"])?.summary;
    expect(summary).toBeDefined();
    const added = after.rows.at(-1) ?? "";
    expect(added).toBe(`  provider  ${summary ?? ""}`);
    expect(before.rows).toHaveLength(26);
    expect(after.rows).toHaveLength(27);
  });

  test("the provenance note gained exactly the GH-350 clause", () => {
    expect(working.captureProvenanceNote).toBe(
      `${captured().captureProvenanceNote}${GH350_CLAUSE}`,
    );
  });

  test("capturedFrom is an ancestor of HEAD and was not advanced", () => {
    const head = spawnSync("git", ["rev-parse", "HEAD"], {
      cwd: ROOT,
      encoding: "utf8",
    }).stdout.trim();
    expect(working.capturedFrom).not.toBe(head);
    const ancestry = spawnSync(
      "git",
      ["merge-base", "--is-ancestor", working.capturedFrom, "HEAD"],
      { cwd: ROOT, encoding: "utf8" },
    );
    expect(ancestry.status).toBe(0);
  });
});
