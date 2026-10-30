/**
 * TC-SCAFFOLD-030 — exactly six package manifests, all private, no publishConfig
 * override, and a private root manifest.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const EXPECTED = [
  "@delivery-os/adapters",
  "@delivery-os/cli",
  "@delivery-os/core",
  "@delivery-os/mcp",
  "@delivery-os/opencode",
  "@delivery-os/testkit",
];

const failures: string[] = [];
const fail = (message: string): void => {
  failures.push(message);
};

const rootManifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as Record<
  string,
  unknown
>;
if (rootManifest.private !== true) fail("root package.json must declare private: true (boolean)");

const packagesDir = join(ROOT, "packages");
const manifests = readdirSync(packagesDir, { withFileTypes: true })
  .filter(
    (entry) => entry.isDirectory() && existsSync(join(packagesDir, entry.name, "package.json")),
  )
  .map((entry) => ({
    dir: entry.name,
    manifest: JSON.parse(
      readFileSync(join(packagesDir, entry.name, "package.json"), "utf8"),
    ) as Record<string, unknown>,
  }));

if (manifests.length !== 6) {
  fail(`expected exactly six package manifests; found ${manifests.length}`);
}
const names = manifests.map((entry) => String(entry.manifest.name)).sort();
if (JSON.stringify(names) !== JSON.stringify(EXPECTED)) {
  fail(`package names must be exactly ${JSON.stringify(EXPECTED)}; got ${JSON.stringify(names)}`);
}

for (const { dir, manifest } of manifests) {
  if (manifest.private !== true) {
    fail(
      `packages/${dir}: private must be the boolean true; got ${JSON.stringify(manifest.private)}`,
    );
  }
  if (manifest.publishConfig !== undefined) {
    fail(`packages/${dir}: publishConfig is not permitted pre-freeze`);
  }
}

// Committed manifest set must match the working tree (no stray untracked package).
const trackedManifests = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "packages/*/package.json"],
  { cwd: ROOT, encoding: "utf8" },
)
  .split("\n")
  .filter((line) => line.length > 0);
if (trackedManifests.length !== names.length) {
  fail(
    `committed package manifests (${trackedManifests.length}) do not match the manifest set (${names.length})`,
  );
}

if (failures.length > 0) {
  for (const message of failures) console.error(`FAIL manifest-privacy: ${message}`);
  process.exit(1);
}
console.log(`OK manifest-privacy: ${names.length} private package manifests and a private root`);
