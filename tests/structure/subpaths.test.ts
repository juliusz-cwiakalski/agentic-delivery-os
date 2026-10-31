/**
 * TC-SCAFFOLD-004 — declared subpaths exist, no extras, every export resolves
 * through `dist` once a build exists.
 */
import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

const ADAPTER_SUBPATHS = [
  "./gitlab",
  "./jira",
  "./github",
  "./azure",
  "./ci",
  "./registry",
  "./repo",
  "./file",
  "./host",
  "./session",
  "./legacy",
  "./credentials",
  "./provider-quota",
];

const EXPECTED: Record<string, Record<string, string>> = {
  core: {
    ".": "src/index.ts",
    "./contracts": "src/contracts/index.ts",
    "./state": "src/state/index.ts",
    "./branding": "src/branding/index.ts",
    "./provider": "src/provider/index.ts",
  },
  adapters: Object.fromEntries(
    ADAPTER_SUBPATHS.map((subpath) => [subpath, `src/${subpath.slice(2)}/index.ts`]),
  ),
  cli: { ".": "src/index.ts" },
  mcp: { ".": "src/index.ts" },
  opencode: { ".": "src/index.ts" },
  testkit: { ".": "src/index.ts" },
};

const manifestOf = (packageName: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(ROOT, "packages", packageName, "package.json"), "utf8")) as Record<
    string,
    unknown
  >;

type ExportsEntry = Record<string, string>;

test("every package declares exactly the expected subpaths and a source file exists", () => {
  const failures: string[] = [];
  for (const [packageName, expected] of Object.entries(EXPECTED)) {
    const exportsMap = (manifestOf(packageName).exports ?? {}) as Record<string, ExportsEntry>;
    const actualKeys = Object.keys(exportsMap).sort();
    const expectedKeys = Object.keys(expected).sort();
    for (const missing of expectedKeys.filter((key) => !actualKeys.includes(key))) {
      failures.push(`${packageName}: missing export ${missing}`);
    }
    for (const extra of actualKeys.filter((key) => !expectedKeys.includes(key))) {
      failures.push(`${packageName}: undeclared extra export ${extra}`);
    }
    for (const [subpath, source] of Object.entries(expected)) {
      if (!existsSync(join(ROOT, "packages", packageName, source))) {
        failures.push(`${packageName}: export ${subpath} has no placeholder source ${source}`);
      }
    }
  }
  expect(failures).toEqual([]);
});

test("every export entry is dist-targeted with a types condition and never points at src", () => {
  const failures: string[] = [];
  for (const [packageName, expected] of Object.entries(EXPECTED)) {
    const exportsMap = (manifestOf(packageName).exports ?? {}) as Record<string, ExportsEntry>;
    for (const subpath of Object.keys(expected)) {
      const entry = exportsMap[subpath] ?? {};
      const types = entry.types;
      const fallback = entry.default;
      if (typeof types !== "string" || !types.startsWith("./dist/") || !types.endsWith(".d.ts")) {
        failures.push(`${packageName}${subpath}: types must point at a .d.ts under dist/`);
      }
      if (
        typeof fallback !== "string" ||
        !fallback.startsWith("./dist/") ||
        !fallback.endsWith(".js")
      ) {
        failures.push(`${packageName}${subpath}: default must point at a .js under dist/`);
      }
      for (const target of [types, fallback]) {
        if (typeof target === "string" && target.includes("/src/")) {
          failures.push(`${packageName}${subpath}: export target ${target} leaks src`);
        }
      }
    }
  }
  expect(failures).toEqual([]);
});

const distIsBuilt = (): boolean =>
  Object.entries(EXPECTED).every(([packageName, expected]) => {
    const exportsMap = (manifestOf(packageName).exports ?? {}) as Record<string, ExportsEntry>;
    return Object.keys(expected).every((subpath) => {
      const types = exportsMap[subpath]?.types;
      return typeof types === "string" && existsSync(join(ROOT, "packages", packageName, types));
    });
  });

test("every declared subpath dynamically imports through its package name", async () => {
  if (!distIsBuilt()) {
    console.log(
      "TC-SCAFFOLD-004 dist half: build output absent; assertions activate after `pnpm build`.",
    );
    return;
  }
  const failures: string[] = [];
  for (const [packageName, expected] of Object.entries(EXPECTED)) {
    const name = String(manifestOf(packageName).name);
    for (const subpath of Object.keys(expected)) {
      const specifier = subpath === "." ? name : `${name}/${subpath.slice(2)}`;
      try {
        await import(specifier);
      } catch (error) {
        failures.push(`${specifier}: ${(error as Error).message}`);
      }
    }
  }
  expect(failures).toEqual([]);
});
