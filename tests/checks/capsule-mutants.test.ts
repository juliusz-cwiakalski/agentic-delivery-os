/**
 * TC-CAP-058 — execute every named guard mutant MUT-CAP-01..44.
 *
 * Each mutant mutates an exact source fragment in an isolated copy of the
 * repository, runs its declared narrow suite, and must make that suite fail.
 * The live tree is never mutated.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { CAPSULE_MUTANTS } from "../fixtures/capsule/mutants";

const ROOT = process.cwd();

const makeCopy = (): string => {
  const copy = mkdtempSync(join(tmpdir(), "gh240-mutants-"));
  for (const directory of ["packages", "tests", "scripts"]) {
    cpSync(join(ROOT, directory), join(copy, directory), { recursive: true });
  }
  for (const file of ["package.json", "bunfig.toml", "tsconfig.json", "tsconfig.base.json"]) {
    cpSync(join(ROOT, file), join(copy, file));
  }
  // A real node_modules keeps non-workspace dependencies symlinked to the
  // installed tree, while @delivery-os/* resolves to the copied packages so a
  // mutated dist is actually the module under test.
  const nodeModules = join(copy, "node_modules");
  mkdirSync(nodeModules, { recursive: true });
  for (const entry of readdirSync(join(ROOT, "node_modules"))) {
    if (entry === "@delivery-os") continue;
    symlinkSync(join(ROOT, "node_modules", entry), join(nodeModules, entry));
  }
  mkdirSync(join(nodeModules, "@delivery-os"));
  for (const packageName of ["core", "adapters", "cli", "mcp", "opencode", "testkit"]) {
    symlinkSync(
      join(copy, "packages", packageName),
      join(nodeModules, "@delivery-os", packageName),
    );
    // Workspace symlinks may be absolute in the source checkout; repoint the
    // copied package's own @delivery-os links at the copied packages.
    const packageModules = join(copy, "packages", packageName, "node_modules");
    if (!lstatSync(packageModules).isDirectory()) continue;
    rmSync(join(packageModules, "@delivery-os"), { recursive: true, force: true });
    mkdirSync(join(packageModules, "@delivery-os"), { recursive: true });
    for (const target of ["core", "adapters", "cli", "mcp", "opencode", "testkit"]) {
      symlinkSync(join(copy, "packages", target), join(packageModules, "@delivery-os", target));
    }
  }
  mkdirSync(join(copy, "tmp"), { recursive: true });
  return copy;
};

const runSuite = (copy: string, suite: string) => {
  const result = spawnSync(process.execPath, ["test", suite], {
    cwd: copy,
    encoding: "utf8",
    timeout: 120_000,
    env: { ...process.env, TMPDIR: join(copy, "tmp") },
  });
  return {
    status: result.status,
    output: `${result.stdout ?? ""}\n${result.stderr ?? ""}`,
  };
};

describe("TC-CAP-058 mutant execution", () => {
  test("the registry enumerates exactly the 44 named ids", () => {
    expect(CAPSULE_MUTANTS.length).toBe(44);
    expect(new Set(CAPSULE_MUTANTS.map((mutant) => mutant.id)).size).toBe(44);
    for (let index = 1; index <= 44; index += 1) {
      expect(CAPSULE_MUTANTS.map((mutant) => mutant.id)).toContain(
        `MUT-CAP-${String(index).padStart(2, "0")}`,
      );
    }
  });

  test("every mutant kills its declared suite for the declared reason", () => {
    const copy = makeCopy();
    const survivors: string[] = [];
    const wrongReason: string[] = [];
    try {
      const baseline = runSuite(copy, "tests/behaviour/capsule-reader.test.ts");
      expect(baseline.status).toBe(0);
      for (const mutant of CAPSULE_MUTANTS) {
        const targets = [
          mutant.file,
          ...(mutant.distFile === undefined ? [] : [mutant.distFile]),
        ].map((file) => ({ file, path: join(copy, file), original: "" }));
        let anchored = true;
        for (const target of targets) {
          target.original = readFileSync(target.path, "utf8");
          const find =
            target.file === mutant.distFile && mutant.distFind !== undefined
              ? mutant.distFind
              : mutant.find;
          if (!target.original.includes(find)) {
            wrongReason.push(`${mutant.id}: mutation anchor not found in ${target.file}`);
            anchored = false;
          }
        }
        if (!anchored) continue;
        for (const target of targets) {
          const isDist = target.file === mutant.distFile;
          const find = isDist && mutant.distFind !== undefined ? mutant.distFind : mutant.find;
          const replace =
            isDist && mutant.distReplace !== undefined ? mutant.distReplace : mutant.replace;
          writeFileSync(
            target.path,
            mutant.all === true
              ? target.original.split(find).join(replace)
              : target.original.replace(find, replace),
          );
        }
        try {
          const result = runSuite(copy, mutant.suite);
          if (result.status === 0) {
            survivors.push(mutant.id);
            continue;
          }
          if (!result.output.includes("(fail)")) {
            wrongReason.push(`${mutant.id}: suite failed without a named test failure`);
            continue;
          }
          if (!result.output.includes(mutant.signal)) {
            wrongReason.push(`${mutant.id}: failure did not name "${mutant.signal}"`);
          }
        } finally {
          for (const target of targets) writeFileSync(target.path, target.original);
        }
      }
    } finally {
      rmSync(dirname(join(copy, "x")), { recursive: true, force: true });
      rmSync(copy, { recursive: true, force: true });
    }
    expect({ survivors, wrongReason }).toEqual({ survivors: [], wrongReason: [] });
  }, 600_000);
});
