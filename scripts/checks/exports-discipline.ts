/**
 * TC-SCAFFOLD-028 — exports discipline: every target resolves under `dist/`,
 * never `src`, and every entry carries a `types` condition.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const PUBLISHABLE = ["core", "adapters", "cli", "mcp", "opencode"];
const ALLOWED_FILES = /^(dist(\/.*)?|README(\.md)?|LICENSE(\.md)?|CHANGELOG(\.md)?)$/;

type ExportValue = string | Record<string, ExportValue>;

type Manifest = {
  name: string;
  type?: string;
  files?: string[];
  exports?: Record<string, ExportValue>;
  main?: string;
  module?: string;
  types?: string;
};

const readManifest = (root: string, packageName: string): Manifest =>
  JSON.parse(readFileSync(join(root, "packages", packageName, "package.json"), "utf8")) as Manifest;

const collectLeaves = (value: ExportValue, leaves: string[]): void => {
  if (typeof value === "string") {
    leaves.push(value);
    return;
  }
  for (const nested of Object.values(value)) collectLeaves(nested, leaves);
};

export const validate = (root: string): string[] => {
  const failures: string[] = [];
  for (const packageName of PUBLISHABLE) {
    const manifest = readManifest(root, packageName);
    const label = `packages/${packageName}`;
    if (manifest.type !== "module") failures.push(`${label}: type must be "module"`);

    const files = manifest.files ?? [];
    if (!files.includes("dist")) failures.push(`${label}: files must include "dist"`);
    for (const entry of files) {
      if (!ALLOWED_FILES.test(entry))
        failures.push(`${label}: files entry ${entry} is not dist/readme/license`);
    }

    for (const [subpath, entry] of Object.entries(manifest.exports ?? {})) {
      if (typeof entry === "string") {
        failures.push(
          `${label}${subpath}: export must be a conditions object with a types condition`,
        );
        continue;
      }
      const types = entry.types;
      if (typeof types !== "string" || !types.startsWith("./dist/") || !types.endsWith(".d.ts")) {
        failures.push(`${label}${subpath}: types condition must point at a .d.ts under dist/`);
      }
      const leaves: string[] = [];
      collectLeaves(entry, leaves);
      for (const leaf of leaves) {
        if (!leaf.startsWith("./dist/")) {
          failures.push(`${label}${subpath}: target ${leaf} is not under dist/`);
        }
        if (leaf.includes("/src/")) {
          failures.push(`${label}${subpath}: target ${leaf} leaks src/`);
        }
        if (!existsSync(join(root, "packages", packageName, leaf))) {
          failures.push(`${label}${subpath}: target ${leaf} does not exist (run pnpm build)`);
        }
      }
    }

    for (const field of ["main", "module", "types"] as const) {
      const target = manifest[field];
      if (target === undefined) continue;
      if (!target.startsWith("./dist/") || target.includes("/src/")) {
        failures.push(`${label}: ${field} must point under dist/`);
      }
      if (!existsSync(join(root, "packages", packageName, target))) {
        failures.push(`${label}: ${field} target ${target} does not exist`);
      }
    }
  }
  return failures;
};

if (import.meta.main) {
  const failures = validate(process.cwd());
  if (failures.length > 0) {
    for (const message of failures) console.error(`FAIL exports-discipline: ${message}`);
    process.exit(1);
  }
  console.log("OK exports-discipline: 5 publishables, all targets dist/+types, no src targets");
}
