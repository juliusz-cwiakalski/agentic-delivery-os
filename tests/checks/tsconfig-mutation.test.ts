/**
 * TC-SCAFFOLD-020 — removing any asserted strict flag (or weakening a package
 * config) fails the strictness check by name, and each probe is real: it fails
 * tsc with the flag on and passes with the flag off.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import {
  PACKAGE_NAMES,
  REQUIRED_FLAGS,
  validate,
} from "../../scripts/checks/tsconfig-strictness";

const ROOT = process.cwd();
const TSC = join(ROOT, "node_modules/typescript/bin/tsc");
const PROBES = [
  "noUncheckedIndexedAccess",
  "exactOptionalPropertyTypes",
  "noUnusedLocals",
  "noImplicitReturns",
  "noFallthroughCasesInSwitch",
  "noUncheckedSideEffectImports",
] as const;

const makeConfigTree = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "tsconfig-mutation-"));
  cpSync(join(ROOT, "tsconfig.base.json"), join(dir, "tsconfig.base.json"));
  cpSync(join(ROOT, "tsconfig.json"), join(dir, "tsconfig.json"));
  for (const packageName of PACKAGE_NAMES) {
    mkdirSync(join(dir, "packages", packageName, "src"), { recursive: true });
    cpSync(
      join(ROOT, "packages", packageName, "tsconfig.json"),
      join(dir, "packages", packageName, "tsconfig.json"),
    );
    writeFileSync(
      join(dir, "packages", packageName, "src/index.ts"),
      "export type Placeholder = { readonly a: string };\n",
    );
  }
  return dir;
};

const readBase = (dir: string): Record<string, unknown> => {
  const result = ts.readConfigFile(join(dir, "tsconfig.base.json"), ts.sys.readFile);
  return result.config as Record<string, unknown>;
};

const writeBase = (dir: string, config: Record<string, unknown>): void => {
  writeFileSync(join(dir, "tsconfig.base.json"), JSON.stringify(config, null, 2));
};

describe("strictness check catches every removed flag", () => {
  test("live tree passes", () => {
    expect(validate(ROOT)).toEqual([]);
  });

  for (const flag of Object.keys(REQUIRED_FLAGS)) {
    test(`removing ${flag} fails by name`, () => {
      const dir = makeConfigTree();
      try {
        const base = readBase(dir);
        const options = { ...(base.compilerOptions as Record<string, unknown>) };
        delete options[flag];
        writeBase(dir, { ...base, compilerOptions: options });
        const failures = validate(dir);
        expect(failures.some((message) => message.includes(flag))).toBe(true);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }

  test("a package override weakening a flag fails", () => {
    const dir = makeConfigTree();
    try {
      const packageConfigPath = join(dir, "packages/core/tsconfig.json");
      const packageConfig = JSON.parse(readFileSync(packageConfigPath, "utf8")) as {
        compilerOptions: Record<string, unknown>;
      };
      packageConfig.compilerOptions.strict = false;
      writeFileSync(packageConfigPath, JSON.stringify(packageConfig, null, 2));
      expect(validate(dir).some((message) => message.includes("overrides strict"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

const runProbe = (dir: string, flag: string, enabled: boolean): number => {
  const configPath = join(dir, "tsconfig.probe.json");
  writeFileSync(
    configPath,
    JSON.stringify({
      compilerOptions: {
        target: "ESNext",
        module: "ESNext",
        moduleResolution: "bundler",
        strict: false,
        strictNullChecks: true,
        noEmit: true,
        types: [],
        lib: ["ESNext"],
        [flag]: enabled,
      },
      files: ["probe.ts"],
    }),
  );
  return spawnSync("bun", [TSC, "-p", configPath], { cwd: dir, encoding: "utf8" }).status ?? 1;
};

describe("each probe is real, not vacuous", () => {
  for (const flag of PROBES) {
    test(`${flag} probe fails with the flag on and passes with it off`, () => {
      const dir = mkdtempSync(join(tmpdir(), `tsconfig-probe-${flag}-`));
      try {
        writeFileSync(
          join(dir, "probe.ts"),
          readFileSync(join(ROOT, "tests/fixtures/tsconfig", `${flag}.ts`), "utf8"),
        );
        expect(runProbe(dir, flag, true)).not.toBe(0);
        expect(runProbe(dir, flag, false)).toBe(0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }, 60_000);
  }
});
