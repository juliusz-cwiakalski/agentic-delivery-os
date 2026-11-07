/**
 * The retro key-containment invariant (GH-232 TC-RETRO-011 static half,
 * NFR-3): key-shaped 64-hex literals may appear only in the single synthetic
 * allowlisted fixture. Every file under the declared roots is scanned, not only
 * retro-named paths.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const KEY_ALLOWLIST = ["tests/fixtures/retro/key-artifact.json"] as const;
export const KEY_SCAN_ROOTS = [
  "packages/core/src",
  "packages/cli/src",
  "tests/fixtures/retro",
  "tests/golden/retro",
] as const;
const KEY_PATTERN = /\b[0-9a-f]{64}\b/g;
const SKIPPED_DIRECTORIES = new Set(["node_modules", "dist", ".git"]);

export type KeyContainmentReport = {
  readonly failures: readonly string[];
  readonly scanned: number;
  readonly occurrences: number;
};

const listFiles = (root: string, relative: string): string[] => {
  const directory = join(root, relative);
  if (!existsSync(directory)) return [];
  const results: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
    const next = `${relative}/${entry.name}`;
    if (entry.isDirectory()) results.push(...listFiles(root, next));
    else if (/\.(ts|json|md|txt|jsonl|yaml|yml)$/.test(entry.name)) results.push(next);
  }
  return results;
};

export const checkRetroKeyContainment = (options: {
  readonly root: string;
  readonly roots?: readonly string[];
  readonly allowlist?: readonly string[];
}): KeyContainmentReport => {
  const roots = options.roots ?? KEY_SCAN_ROOTS;
  const allowlist = new Set(options.allowlist ?? KEY_ALLOWLIST);
  const files = roots.flatMap((root) => listFiles(options.root, root)).sort();
  const failures: string[] = [];
  let occurrences = 0;
  for (const file of files) {
    if (allowlist.has(file)) continue;
    const text = readFileSync(join(options.root, file), "utf8");
    const matches = text.match(KEY_PATTERN) ?? [];
    if (matches.length === 0) continue;
    occurrences += matches.length;
    failures.push(`${file}: key-shaped literal (${String(matches.length)})`);
  }
  return { failures, scanned: files.length, occurrences };
};

if (import.meta.main) {
  const report = checkRetroKeyContainment({ root: process.cwd() });
  console.log(
    `retro-key-containment: scanned=${String(report.scanned)} files allowlist=${KEY_ALLOWLIST.join(",")}`,
  );
  if (report.failures.length > 0) {
    for (const failure of report.failures) console.error(`FAIL retro-key-containment: ${failure}`);
    process.exit(1);
  }
  console.log("OK retro-key-containment: no key-shaped literals outside the allowlist");
}
