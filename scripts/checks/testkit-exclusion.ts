/**
 * TC-SCAFFOLD-033 — testkit is absent from every published dependency graph and
 * appears only in devDependencies.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const TESTKIT = "@delivery-os/testkit";
const FORBIDDEN_FIELDS = ["dependencies", "peerDependencies", "optionalDependencies"] as const;
const PACKAGE_NAMES = ["core", "adapters", "cli", "mcp", "opencode", "testkit"];

type Manifest = Record<string, Record<string, string> | undefined> & { name?: string };

const readManifest = (path: string): Manifest => JSON.parse(readFileSync(path, "utf8")) as Manifest;

export const validate = (root: string): string[] => {
  const failures: string[] = [];
  const paths = [join(root, "package.json")];
  for (const packageName of PACKAGE_NAMES) {
    paths.push(join(root, "packages", packageName, "package.json"));
  }
  const packagesDir = join(root, "packages");
  if (existsSync(packagesDir)) {
    for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
      if (entry.isDirectory() && !PACKAGE_NAMES.includes(entry.name)) {
        const path = join(packagesDir, entry.name, "package.json");
        if (existsSync(path)) paths.push(path);
      }
    }
  }

  for (const path of paths) {
    const manifest = readManifest(path);
    const label = path.replace(`${root}/`, "");
    for (const field of FORBIDDEN_FIELDS) {
      if (manifest[field] && TESTKIT in (manifest[field] as Record<string, string>)) {
        failures.push(`${label}: ${TESTKIT} must not appear in ${field}`);
      }
    }
  }

  const testkitManifest = readManifest(join(root, "packages/testkit/package.json"));
  for (const dependency of ["@delivery-os/core", "@delivery-os/adapters"]) {
    if (!(dependency in (testkitManifest.devDependencies ?? {}))) {
      failures.push(`packages/testkit: ${dependency} must be a devDependency`);
    }
  }
  return failures;
};

if (import.meta.main) {
  const failures = validate(process.cwd());
  if (failures.length > 0) {
    for (const message of failures) console.error(`FAIL testkit-exclusion: ${message}`);
    process.exit(1);
  }
  console.log("OK testkit-exclusion: testkit is dev-only and absent from every published graph");
}
