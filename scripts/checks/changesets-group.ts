/**
 * TC-SCAFFOLD-032 — the changesets fixed group covers exactly the five
 * publishables, and testkit can never be versioned or published.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const FIXED_GROUP = [
  "@delivery-os/adapters",
  "@delivery-os/cli",
  "@delivery-os/core",
  "@delivery-os/mcp",
  "@delivery-os/opencode",
];

type Config = {
  fixed?: string[][];
  ignore?: string[];
  privatePackages?: { version?: boolean; tag?: boolean };
};

export const validate = (root: string): string[] => {
  const failures: string[] = [];
  const config = JSON.parse(readFileSync(join(root, ".changeset/config.json"), "utf8")) as Config;
  const fixed = config.fixed ?? [];
  if (fixed.length !== 1) {
    failures.push(`expected exactly one fixed group; found ${fixed.length}`);
  }
  const group = [...(fixed[0] ?? [])].sort();
  if (JSON.stringify(group) !== JSON.stringify(FIXED_GROUP)) {
    failures.push(
      `fixed group must be exactly ${JSON.stringify(FIXED_GROUP)}; got ${JSON.stringify(group)}`,
    );
  }
  if (fixed.some((members) => members.includes("@delivery-os/testkit"))) {
    failures.push("testkit must not appear in any fixed group");
  }
  if ((config.ignore ?? []).includes("@delivery-os/testkit")) {
    failures.push("testkit must not appear in the changesets ignore list");
  }
  if (config.privatePackages?.version !== false) {
    failures.push("privatePackages.version must be false (testkit never versions)");
  }
  if (config.privatePackages?.tag !== false) {
    failures.push("privatePackages.tag must be false (testkit never tags)");
  }
  return failures;
};

if (import.meta.main) {
  const failures = validate(process.cwd());
  if (failures.length > 0) {
    for (const message of failures) console.error(`FAIL changesets-group: ${message}`);
    process.exit(1);
  }
  console.log("OK changesets-group: exactly one fixed group of five; testkit excluded");
}
