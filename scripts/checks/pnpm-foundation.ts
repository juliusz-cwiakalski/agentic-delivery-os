/**
 * TC-SCAFFOLD-002 — pnpm pin, single lockfile, no isolation-weakening settings.
 *
 * Repository invariant check. Exits non-zero and names every offending field.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const EXPECTED_PACKAGES = [
  "@delivery-os/core",
  "@delivery-os/adapters",
  "@delivery-os/cli",
  "@delivery-os/mcp",
  "@delivery-os/opencode",
  "@delivery-os/testkit",
];

const failures: string[] = [];
const fail = (message: string): void => {
  failures.push(message);
};

const readJson = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;

const rootManifest = readJson(join(ROOT, "package.json"));

// 1. Exact `pnpm@x.y.z` packageManager pin.
const packageManager = rootManifest.packageManager;
if (typeof packageManager !== "string" || !/^pnpm@\d+\.\d+\.\d+$/.test(packageManager)) {
  fail(
    `package.json packageManager must be an exact pnpm@x.y.z pin (no range, no latest); got ${JSON.stringify(packageManager)}`,
  );
}

// 2. Exactly one committed lockfile.
// Tracked plus untracked-but-not-ignored: identical to `git ls-files` in CI,
// and a truthful pre-commit view of the files that will be committed.
const tracked = execFileSync(
  "git",
  ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
  {
    cwd: ROOT,
    encoding: "utf8",
  },
)
  .split("\u0000")
  .filter((entry) => entry.length > 0);
const lockfiles = tracked.filter((entry) => /(^|\/)pnpm-lock\.yaml$/.test(entry));
if (lockfiles.length !== 1) {
  fail(`expected exactly one committed pnpm-lock.yaml; found ${JSON.stringify(lockfiles)}`);
}
if (lockfiles.length > 0) {
  try {
    execFileSync("git", ["check-ignore", "-q", lockfiles[0] as string], { cwd: ROOT });
    fail(`${lockfiles[0]} is git-ignored; the lockfile must be committed`);
  } catch {
    // Not ignored — expected.
  }
}

// 3. Workspace definition lists `packages/*` and, once package manifests exist,
//    exactly the six ADR-0003 packages and no others.
const workspacePath = join(ROOT, "pnpm-workspace.yaml");
if (!existsSync(workspacePath)) {
  fail("pnpm-workspace.yaml is missing");
} else {
  const workspace = readFileSync(workspacePath, "utf8");
  if (!/packages\s*:/.test(workspace) || !/["']?packages\/\*["']?/.test(workspace)) {
    fail("pnpm-workspace.yaml must declare the `packages/*` glob");
  }
}
const packagesDir = join(ROOT, "packages");
const packageNames: string[] = [];
if (existsSync(packagesDir)) {
  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(packagesDir, entry.name, "package.json");
    if (!existsSync(manifestPath)) continue;
    const manifest = readJson(manifestPath);
    packageNames.push(String(manifest.name));
  }
}
if (packageNames.length > 0) {
  const actual = [...packageNames].sort();
  const expected = [...EXPECTED_PACKAGES].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(
      `workspace must contain exactly the six ADR-0003 packages; expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

// 4. No isolation-weakening settings.
const forbiddenSettings = [
  /hoist-pattern/,
  /shamefully-hoist/,
  /node-linker/,
  /prefer-frozen-lockfile\s*=\s*false/,
  /frozen-lockfile\s*=\s*false/,
  /strict-peer-dependencies\s*=\s*false/,
];
const settingSources = ["pnpm-workspace.yaml", ".npmrc", "pnpmfile.cjs", ".pnpmfile.cjs"].filter(
  (name) => existsSync(join(ROOT, name)),
);
for (const source of settingSources) {
  const content = readFileSync(join(ROOT, source), "utf8");
  for (const pattern of forbiddenSettings) {
    if (pattern.test(content)) {
      fail(`${source} contains an isolation-weakening setting matching ${pattern}`);
    }
  }
}

// Root manifest privacy.
if (rootManifest.private !== true) {
  fail("root package.json must declare private: true");
}

if (failures.length > 0) {
  for (const message of failures) console.error(`FAIL pnpm-foundation: ${message}`);
  process.exit(1);
}
console.log(
  `OK pnpm-foundation: ${packageManager}, one lockfile, ${packageNames.length === 0 ? "workspace glob only (packages land in P1)" : `${packageNames.length} packages`}`,
);
