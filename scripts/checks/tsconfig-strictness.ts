/**
 * TC-SCAFFOLD-019 — the strict TypeScript flag set is asserted by name, package
 * configs extend the base without weakening it, and the solution references all
 * six packages.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

export const REQUIRED_FLAGS: Record<string, string | boolean> = {
  strict: true,
  noUncheckedIndexedAccess: true,
  exactOptionalPropertyTypes: true,
  noUnusedLocals: true,
  noUnusedParameters: true,
  noImplicitReturns: true,
  noFallthroughCasesInSwitch: true,
  noImplicitOverride: true,
  noUncheckedSideEffectImports: true,
  verbatimModuleSyntax: true,
  isolatedModules: true,
  declaration: true,
  declarationMap: true,
  forceConsistentCasingInFileNames: true,
  target: "ESNext",
  module: "ESNext",
  moduleResolution: "bundler",
};

export const PACKAGE_NAMES = ["core", "adapters", "cli", "mcp", "opencode", "testkit"];

const readJsonc = (path: string): Record<string, unknown> => {
  const result = ts.readConfigFile(path, ts.sys.readFile);
  if (result.error) {
    throw new Error(`${path}: ${ts.flattenDiagnosticMessageText(result.error.messageText, "\n")}`);
  }
  return result.config as Record<string, unknown>;
};

const equalValue = (actual: unknown, expected: string | boolean): boolean => {
  if (typeof expected === "boolean") return actual === expected;
  return typeof actual === "string" && actual.toLowerCase() === expected.toLowerCase();
};

const listFiles = (dir: string): string[] => {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...listFiles(path));
    else if (entry.name.endsWith(".ts")) results.push(path);
  }
  return results;
};

export const validate = (root: string): string[] => {
  const failures: string[] = [];
  const basePath = join(root, "tsconfig.base.json");
  if (!existsSync(basePath)) return ["tsconfig.base.json is missing"];

  const baseText = readFileSync(basePath, "utf8");
  const base = readJsonc(basePath);
  const options = (base.compilerOptions ?? {}) as Record<string, unknown>;

  for (const [flag, expected] of Object.entries(REQUIRED_FLAGS)) {
    if (!equalValue(options[flag], expected)) {
      failures.push(`tsconfig.base.json must set ${flag} to ${JSON.stringify(expected)}`);
    }
  }
  if (options.skipLibCheck !== true) {
    failures.push("tsconfig.base.json must record skipLibCheck: true as the single escape hatch");
  }
  if (!baseText.includes("skipLibCheck decision:")) {
    failures.push("tsconfig.base.json must record the skipLibCheck decision with its reason");
  }

  for (const packageName of PACKAGE_NAMES) {
    const path = join(root, "packages", packageName, "tsconfig.json");
    if (!existsSync(path)) {
      failures.push(`packages/${packageName}/tsconfig.json is missing`);
      continue;
    }
    const config = readJsonc(path);
    const packageOptions = (config.compilerOptions ?? {}) as Record<string, unknown>;
    if (typeof config.extends !== "string" || !config.extends.includes("tsconfig.base.json")) {
      failures.push(`packages/${packageName}/tsconfig.json must extend tsconfig.base.json`);
    }
    for (const key of Object.keys(REQUIRED_FLAGS)) {
      if (key in packageOptions) {
        failures.push(`packages/${packageName}/tsconfig.json overrides ${key} (weakening risk)`);
      }
    }
    if (packageOptions.composite !== true) {
      failures.push(`packages/${packageName}/tsconfig.json must set composite: true`);
    }
    if (packageOptions.outDir !== "dist") {
      failures.push(`packages/${packageName}/tsconfig.json must set outDir: dist`);
    }
    if (packageOptions.rootDir !== "src") {
      failures.push(`packages/${packageName}/tsconfig.json must set rootDir: src`);
    }
    const include = config.include;
    if (!Array.isArray(include) || !include.some((entry) => String(entry).includes("src/"))) {
      failures.push(`packages/${packageName}/tsconfig.json must include src/**`);
    }
  }

  const solutionPath = join(root, "tsconfig.json");
  if (!existsSync(solutionPath)) {
    failures.push("solution tsconfig.json is missing");
  } else {
    const solution = readJsonc(solutionPath);
    const references = (solution.references ?? []) as Array<{ path?: string }>;
    const paths = references.map((reference) => String(reference.path ?? "").replace(/^\.\//, ""));
    for (const packageName of PACKAGE_NAMES) {
      if (!paths.includes(`packages/${packageName}`)) {
        failures.push(`solution tsconfig.json does not reference packages/${packageName}`);
      }
    }
    if (paths.length !== PACKAGE_NAMES.length) {
      failures.push(
        `solution tsconfig.json must reference exactly six packages; got ${paths.length}`,
      );
    }
  }

  for (const packageName of PACKAGE_NAMES) {
    for (const file of listFiles(join(root, "packages", packageName, "src"))) {
      if (readFileSync(file, "utf8").includes("@ts-expect-error")) {
        failures.push(
          `${file.replace(`${root}/`, "")} uses @ts-expect-error (no escape hatches at scaffold)`,
        );
      }
    }
  }

  return failures;
};

if (import.meta.main) {
  const failures = validate(process.cwd());
  if (failures.length > 0) {
    for (const message of failures) console.error(`FAIL tsconfig-strictness: ${message}`);
    process.exit(1);
  }
  console.log(
    `OK tsconfig-strictness: ${Object.keys(REQUIRED_FLAGS).length} flags asserted, six package configs, solution references complete`,
  );
}
