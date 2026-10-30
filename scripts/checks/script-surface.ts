/**
 * TC-SCAFFOLD-021 — five named checks exist at root and in all six packages,
 * exactly one aggregate `check` chains them in order, and no alternate aggregate
 * or bypass flag exists.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const NAMED_CHECKS = ["lint", "format:check", "typecheck", "test", "check:boundaries"];
export const ALTERNATE_AGGREGATES = ["verify", "ci", "all", "validate", "precommit"];
const PACKAGE_NAMES = ["core", "adapters", "cli", "mcp", "opencode", "testkit"];

const readScripts = (manifestPath: string): Record<string, string> => {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    scripts?: Record<string, string>;
  };
  return manifest.scripts ?? {};
};

const checkSurfaceAt = (
  label: string,
  scripts: Record<string, string>,
  failures: string[],
): void => {
  for (const name of NAMED_CHECKS) {
    const command = scripts[name];
    if (typeof command !== "string" || command.trim().length === 0) {
      failures.push(`${label}: missing or empty script ${name}`);
    }
  }
  const aggregate = scripts.check;
  if (typeof aggregate !== "string" || aggregate.trim().length === 0) {
    failures.push(`${label}: missing aggregate script check`);
  } else {
    let cursor = -1;
    for (const name of NAMED_CHECKS) {
      const index = aggregate.indexOf(name, cursor + 1);
      if (index <= cursor) {
        failures.push(
          `${label}: aggregate check must chain ${name} in order (lint → format:check → typecheck → test → check:boundaries)`,
        );
        break;
      }
      cursor = index;
    }
    for (const bypass of [
      "|| true",
      "--no-verify",
      "--passWithNoTests",
      "--filter",
      "continue-on-error",
    ]) {
      if (aggregate.includes(bypass)) {
        failures.push(`${label}: aggregate check contains bypass construct ${bypass}`);
      }
    }
  }
  for (const alternate of ALTERNATE_AGGREGATES) {
    if (alternate in scripts) {
      failures.push(`${label}: alternate aggregate script ${alternate} is not permitted`);
    }
  }
};

export const validate = (root: string): string[] => {
  const failures: string[] = [];
  const packagesDir = join(root, "packages");
  const manifests = existsSync(packagesDir)
    ? readdirSync(packagesDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name !== "node_modules")
        .map((entry) => entry.name)
        .filter((name) => PACKAGE_NAMES.includes(name))
    : [];

  checkSurfaceAt("root", readScripts(join(root, "package.json")), failures);
  for (const packageName of PACKAGE_NAMES) {
    const manifestPath = join(packagesDir, packageName, "package.json");
    if (!manifests.includes(packageName) || !existsSync(manifestPath)) {
      failures.push(`packages/${packageName}: missing package manifest`);
      continue;
    }
    checkSurfaceAt(`packages/${packageName}`, readScripts(manifestPath), failures);
  }
  return failures;
};

if (import.meta.main) {
  const failures = validate(process.cwd());
  if (failures.length > 0) {
    for (const message of failures) console.error(`FAIL script-surface: ${message}`);
    process.exit(1);
  }
  console.log(
    `OK script-surface: ${NAMED_CHECKS.length} named checks at root + 6 packages, one aggregate in order`,
  );
}
