/**
 * Boundary fixture harness (chg-GH-170-test-plan.md §4 contract).
 *
 * Materialises a throwaway workspace in `mkdtemp`, copies the PRODUCTION
 * `.dependency-cruiser.cjs` verbatim, symlinks fixture packages under a temp
 * `node_modules/@delivery-os/`, cruises clean, injects the probe, and re-cruises.
 * Nothing is ever written into the live tree.
 */
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export const REPO_ROOT = process.cwd();
const DEPCRUISE = join(REPO_ROOT, "node_modules/.bin/depcruise");

export type PackageName = "core" | "adapters" | "cli" | "mcp" | "opencode" | "testkit";

export const ADAPTER_SUBPATHS = [
  "gitlab",
  "jira",
  "github",
  "azure",
  "ci",
  "registry",
  "repo",
  "file",
  "host",
  "session",
  "legacy",
  "credentials",
];

export type Violation = { rule: string; from: string; to: string };
export type CruiseResult = { status: number; violations: Violation[] };

const writeFiles = (root: string, files: Record<string, string>): void => {
  for (const [relative, content] of Object.entries(files)) {
    const path = join(root, relative);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
};

const manifestFor = (packageName: PackageName): string => {
  const base = {
    version: "0.0.0",
    type: "module",
  };
  if (packageName === "core") {
    return JSON.stringify({
      name: "@delivery-os/core",
      ...base,
      // Production shape: package-name specifiers resolve through `exports` to
      // built `dist` targets (never `src`), so the fixture world must too.
      exports: {
        ".": "./dist/index.js",
        "./contracts": "./dist/contracts/index.js",
        "./state": "./dist/state/index.js",
        "./branding": "./dist/branding/index.js",
        "./provider": "./dist/provider/index.js",
      },
      imports: {
        "#contracts": "./src/contracts/index.ts",
        "#domain/*": "./src/domain/*.ts",
        "#app/*": "./src/app/*.ts",
        "#config/*": "./src/config/*.ts",
        "#branding/*": "./src/branding/*.ts",
        "#state/*": "./src/state/*.ts",
      },
    });
  }
  if (packageName === "adapters") {
    return JSON.stringify({
      name: "@delivery-os/adapters",
      ...base,
      exports: Object.fromEntries(
        ADAPTER_SUBPATHS.map((subpath) => [`./${subpath}`, `./dist/${subpath}/index.js`]),
      ),
      imports: {
        "#registry": "./src/registry/index.ts",
        "#io/*": "./src/io/*.ts",
      },
    });
  }
  return JSON.stringify({
    name: `@delivery-os/${packageName}`,
    ...base,
    exports: { ".": "./dist/index.js" },
  });
};

const placeholder = (packageName: string, modulePath: string): string =>
  `/** Fixture placeholder: ${packageName}/${modulePath}. */\nexport type Placeholder = {\n  readonly module: "${packageName}/${modulePath}";\n};\n`;

const distPlaceholder = (packageName: string, modulePath: string): string =>
  `/** Fixture build placeholder: ${packageName}/${modulePath}. */\nexport {};\n`;

/**
 * Materialise the `dist` targets every fixture manifest exports. The production
 * tree resolves package-name imports through `exports` → `dist`; a fixture
 * workspace without `dist` would only ever exercise the pre-build path.
 */
export const distFilesFor = (packageName: PackageName): Record<string, string> => {
  const files: Record<string, string> = {};
  if (packageName === "core") {
    for (const modulePath of ["index", "contracts/index", "state/index", "branding/index", "provider/index"]) {
      files[`packages/core/dist/${modulePath}.js`] = distPlaceholder("core", modulePath);
    }
  } else if (packageName === "adapters") {
    for (const subpath of ADAPTER_SUBPATHS) {
      files[`packages/adapters/dist/${subpath}/index.js`] = distPlaceholder("adapters", subpath);
    }
  } else {
    files[`packages/${packageName}/dist/index.js`] = distPlaceholder(packageName, "index");
  }
  return files;
};

export const baseFilesFor = (packageName: PackageName): Record<string, string> => {
  const files: Record<string, string> = {};
  if (packageName === "core") {
    for (const tier of ["contracts", "state", "branding", "domain", "app", "config", "provider"]) {
      files[`packages/core/src/${tier}/index.ts`] = placeholder("core", tier);
    }
    files["packages/core/src/index.ts"] = placeholder("core", "index");
  } else if (packageName === "adapters") {
    for (const subpath of ADAPTER_SUBPATHS) {
      files[`packages/adapters/src/${subpath}/index.ts`] = placeholder("adapters", subpath);
    }
    files["packages/adapters/src/index.ts"] = placeholder("adapters", "index");
  } else {
    files[`packages/${packageName}/src/index.ts`] = placeholder(packageName, "index");
  }
  return files;
};

export const materializeWorkspace = (
  packages: PackageName[],
  extraFiles: Record<string, string> = {},
): string => {
  const root = mkdtempSync(join(tmpdir(), "boundary-fixture-"));
  writeFileSync(
    join(root, "package.json"),
    `${JSON.stringify({ name: "boundary-fixture", private: true, type: "module" })}\n`,
  );
  cpSync(join(REPO_ROOT, ".dependency-cruiser.cjs"), join(root, ".dependency-cruiser.cjs"));
  for (const packageName of packages) {
    mkdirSync(join(root, "packages", packageName, "src"), { recursive: true });
    writeFileSync(join(root, "packages", packageName, "package.json"), manifestFor(packageName));
    writeFiles(root, baseFilesFor(packageName));
    writeFiles(root, distFilesFor(packageName));
  }
  mkdirSync(join(root, "node_modules/@delivery-os"), { recursive: true });
  for (const packageName of packages) {
    symlinkSync(
      join(root, "packages", packageName),
      join(root, "node_modules/@delivery-os", packageName),
      "dir",
    );
  }
  writeFiles(root, extraFiles);
  return root;
};

export const writeProbe = (root: string, probe: string, source: string): void => {
  writeFiles(root, { [probe]: source });
};

export const cruise = (root: string): CruiseResult => {
  const result = spawnSync(DEPCRUISE, ["--config", join(root, ".dependency-cruiser.cjs"), "."], {
    cwd: root,
    encoding: "utf8",
    timeout: 120_000,
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const violations: Violation[] = [];
  const pattern = /^\s*(?:error|warn)\s+([A-Za-z0-9_-]+):\s+(.+?)\s+→\s+(.+?)\s*$/gm;
  for (const match of output.matchAll(pattern)) {
    violations.push({ rule: match[1] as string, from: match[2] as string, to: match[3] as string });
  }
  return { status: result.status ?? 1, violations };
};

export const cleanup = (root: string): void => {
  rmSync(root, { recursive: true, force: true });
};

export const filesUnder = (root: string, relativeDir: string): string[] => {
  const directory = join(root, relativeDir);
  if (!existsSync(directory)) return [];
  const results: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relative = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) results.push(...filesUnder(root, relative));
    else results.push(relative);
  }
  return results;
};
