/**
 * GH-346 TC-BIN-068 / 069 — the compiled process edge.
 *
 * The argument slice and grammar are compared against the source entry over the
 * same argv, and the re-entry entry path is asserted as a VALUE: a compiled
 * probe reports the virtual argv entry and the real executable path, and the
 * production rule maps the first to the second. No `$bunfs/` value is ever
 * persisted or handed to a spawn.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveReentryEntryPath } from "../../packages/cli/src/bin-launcher";
import { compileArtifact } from "../../scripts/build-binary";

const ROOT = process.cwd();
const scratch = mkdtempSync(join(ROOT, "tmp/tmpdir/gh346-artifact-grammar-"));
const cwd = join(scratch, "cwd");
const home = join(scratch, "home");

type RunResult = {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
};

const run = (command: string, args: readonly string[], workingDirectory: string): RunResult => {
  const result = spawnSync(command, [...args], {
    cwd: workingDirectory,
    env: { HOME: home, TMPDIR: join(scratch, "tmp"), PATH: process.env.PATH ?? "" },
    encoding: "utf8",
    timeout: 120_000,
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
};

/** Drop the per-run envelope fields a byte comparison cannot pin. */
const stableStdout = (text: string): string => {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const { runId: _runId, timing: _timing, ...rest } = parsed;
    const data = rest.data;
    if (typeof data === "object" && data !== null && !Array.isArray(data)) {
      const { generatedAt: _generatedAt, ...stableData } = data as Record<string, unknown>;
      return JSON.stringify({ ...rest, data: stableData });
    }
    return JSON.stringify(rest);
  } catch {
    return text;
  }
};

let artifact = "";
let probe = "";

beforeAll(() => {
  for (const directory of [cwd, home, join(scratch, "tmp")]) {
    mkdirSync(directory, { recursive: true });
  }
  artifact = compileArtifact({
    root: ROOT,
    outDirectory: join(scratch, "artifact"),
    now: () => new Date("2026-11-18T12:00:00Z"),
  }).path;
  const probeSource = join(scratch, "argv-probe.ts");
  writeFileSync(
    probeSource,
    "console.log(JSON.stringify({ argv: process.argv, execPath: process.execPath }));\n",
  );
  probe = compileArtifact({
    root: ROOT,
    outDirectory: join(scratch, "probe"),
    entryPath: probeSource,
  }).path;
});

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

describe("TC-BIN-068 the compiled argument slice and grammar are equivalent", () => {
  test("each argv cell resolves exactly as the source entry does", () => {
    const matrix: readonly (readonly string[])[] = [
      ["--help"],
      ["phase", "list", "GH-346", "--json"],
      ["phase", "list", "GH-346"],
      ["status", "--json"],
      ["blockers", "list", "--json"],
      ["queue", "--help"],
    ];
    for (const argv of matrix) {
      const compiled = run(artifact, argv, cwd);
      const source = run("bun", [join(ROOT, "packages/cli/bin/jaiship.ts"), ...argv], cwd);
      expect({ argv, status: compiled.status }).toEqual({ argv, status: source.status });
      expect({ argv, stdout: stableStdout(compiled.stdout) }).toEqual({
        argv,
        stdout: stableStdout(source.stdout),
      });
      expect({ argv, stderr: compiled.stderr }).toEqual({ argv, stderr: source.stderr });
    }
  });

  test("--version stays a successful one-line read in the compiled arm", () => {
    const compiled = run(artifact, ["--version"], cwd);
    expect(compiled.status).toBe(0);
    expect(compiled.stdout.trim().split("\n")).toHaveLength(1);
    expect(compiled.stdout).toContain("(build ");
  });

  test("the user argument slice contains exactly the user arguments", () => {
    const compiled = run(artifact, ["phase", "list", "GH-346", "--json"], cwd);
    expect(JSON.parse(compiled.stdout).data.changeRef).toBe("GH-346");
    const positioned = run(artifact, ["phase", "list", "GH-346"], cwd);
    expect(positioned.stdout).toContain("GH-346");
    expect(positioned.stdout).not.toContain("$bunfs");
  });
});

describe("TC-BIN-069 re-entry names the real executable, never a bundle path", () => {
  test("a compiled run maps its virtual argv entry to process.execPath", () => {
    const output = run(probe, ["ignored"], cwd);
    expect(output.status).toBe(0);
    const facts = JSON.parse(output.stdout) as {
      readonly argv: readonly string[];
      readonly execPath: string;
    };
    const argvEntry = facts.argv[1];
    expect(argvEntry?.startsWith("/$bunfs/")).toBe(true);
    expect(facts.execPath).toBe(probe);
    expect(resolveReentryEntryPath({ argvEntry, execPath: facts.execPath })).toBe(probe);
    expect(resolveReentryEntryPath({ argvEntry, execPath: facts.execPath })).not.toContain(
      "$bunfs",
    );
    expect(
      resolveReentryEntryPath({
        argvEntry: join(ROOT, "packages/cli/bin/jaiship.ts"),
        execPath: "/runtime/bun",
      }),
    ).toBe(join(ROOT, "packages/cli/bin/jaiship.ts"));
  });

  test("both bins supply the resolved path and no bundle root is persisted", () => {
    for (const name of ["jaiship", "delivery-os"]) {
      const source = readFileSync(join(ROOT, "packages/cli/bin", `${name}.ts`), "utf8");
      expect(source).toContain("resolveReentryEntryPath(");
      expect(source).toContain("argvEntry: process.argv[1]");
      expect(source).toContain("execPath: process.execPath");
      expect(source).not.toContain("$bunfs");
    }
    const offenders: string[] = [];
    const walk = (relative: string): void => {
      for (const entry of readdirSync(join(ROOT, relative), { withFileTypes: true })) {
        const next = `${relative}/${entry.name}`;
        if (entry.isDirectory()) {
          if (entry.name === "dist" || entry.name === "node_modules") continue;
          walk(next);
        } else if (entry.name.endsWith(".ts")) {
          if (readFileSync(join(ROOT, next), "utf8").includes("$bunfs")) offenders.push(next);
        }
      }
    };
    walk("packages");
    // The one declared detection site is the rule that recognizes the marker;
    // no other file persists or forwards it.
    expect(offenders).toEqual(["packages/cli/src/bin-launcher.ts"]);
  });
});
