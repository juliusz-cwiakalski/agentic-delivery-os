/**
 * TC-SCAFFOLD-017 / TC-SCAFFOLD-018 — Bun four-copy pin equality.
 *
 * `.bun-version` is the source of truth. Copies: root `engines.bun`, the CI pin
 * (`env.BUN_VERSION`), and the release-build definition. The check compares
 * copies, never a literal, so a reviewed bump passes once all four move together.
 * In CI it also asserts the installed runtime equals `.bun-version`.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const EXACT = /^\d+\.\d+\.\d+$/;

const read = (root: string, relative: string): string => readFileSync(join(root, relative), "utf8");

export const validate = (root: string): string[] => {
  const failures: string[] = [];
  const location = (label: string, value: string | undefined): { label: string; value: string } => {
    const actual = String(value ?? "").trim();
    if (!EXACT.test(actual)) {
      failures.push(
        `${label} must be an exact x.y.z pin (no range, no latest); got ${JSON.stringify(value)}`,
      );
    }
    return { label, value: actual };
  };

  const source = location(".bun-version", read(root, ".bun-version"));
  const manifest = JSON.parse(read(root, "package.json")) as { engines?: { bun?: string } };
  const engines = location("package.json engines.bun", manifest.engines?.bun);

  const ciText = existsSync(join(root, ".github/workflows/ci.yml"))
    ? read(root, ".github/workflows/ci.yml")
    : "";
  const ciMatch = /^\s{2}BUN_VERSION:\s*["']?([^"'\s#]+)["']?\s*$/m.exec(ciText);
  const ci = location("ci.yml env.BUN_VERSION", ciMatch?.[1]);

  const releaseText = existsSync(join(root, ".github/workflows/release.yml"))
    ? read(root, ".github/workflows/release.yml")
    : "";
  const releaseMatches = [...releaseText.matchAll(/bun-version:\s*["']?([^"'\s#]+)["']?/g)].map(
    (match) => match[1],
  );
  if (releaseMatches.length === 0) {
    failures.push("release.yml has no bun-version definition (copy 4 missing)");
  }
  const release = location("release.yml bun-version", releaseMatches[0]);
  for (const [index, value] of releaseMatches.entries()) {
    if (value !== release.value) {
      failures.push(
        `release.yml bun-version copy ${index + 1}: ${JSON.stringify(value)} != ${JSON.stringify(release.value)}`,
      );
    }
  }

  const reference = source.value;
  for (const copy of [engines, ci, release]) {
    if (copy.value !== reference) {
      failures.push(
        `${copy.label}: ${JSON.stringify(copy.value)} != .bun-version ${JSON.stringify(reference)}`,
      );
    }
  }

  if (process.env.CI === "true" || process.env.CI === "1") {
    const installed = spawnSync("bun", ["--version"], { encoding: "utf8" });
    const actual = (installed.stdout ?? "").trim();
    if (actual !== reference) {
      failures.push(
        `installed runtime bun --version ${JSON.stringify(actual)} != .bun-version ${JSON.stringify(reference)}`,
      );
    }
  }

  return failures;
};

if (import.meta.main) {
  const failures = validate(process.cwd());
  if (failures.length > 0) {
    for (const message of failures) console.error(`FAIL pin-equality: ${message}`);
    process.exit(1);
  }
  console.log("OK pin-equality: four Bun copies identical and exact");
}
