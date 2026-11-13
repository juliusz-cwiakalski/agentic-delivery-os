/**
 * TC-TELEMETRY-036 — the telemetry suites are offline and hermetic: no socket,
 * no live harness store, no credential resolution, no `$HOME` read, and every
 * store is a per-test temp root seeded through the delivered append paths
 * (NFR-6, test-plan §4.1).
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

const SUITES = [
  "tests/behaviour/telemetry-ingest.test.ts",
  "tests/behaviour/telemetry-attribution.test.ts",
  "tests/behaviour/telemetry-timing.test.ts",
  "tests/behaviour/telemetry-storage-migration.test.ts",
  "tests/behaviour/telemetry-storage-coexistence.test.ts",
  "tests/behaviour/telemetry-storage-damage.test.ts",
  "tests/behaviour/telemetry-storage-growth.test.ts",
  "tests/behaviour/telemetry-disclosure.test.ts",
  "tests/behaviour/telemetry-determinism.test.ts",
  "tests/behaviour/telemetry-privacy.test.ts",
  "tests/behaviour/telemetry-audit-compose.test.ts",
  "tests/behaviour/spend-v2-breakdown.test.ts",
  "tests/behaviour/spend-v2-fold-basis.test.ts",
  "tests/behaviour/spend-v2-refusals.test.ts",
  "tests/behaviour/spend-v2-v1-compat.test.ts",
  "tests/behaviour/spend-reconciliation.test.ts",
  "tests/behaviour/brief-spend-citation.test.ts",
  "tests/behaviour/retro-telemetry-evidence.test.ts",
  "tests/checks/telemetry-mutants.test.ts",
  "tests/checks/telemetry-hermetic.test.ts",
] as const;

const FIXTURES = ["tests/fixtures/telemetry/index.ts"] as const;

const FORBIDDEN = [
  "node:net",
  "node:http",
  "node:https",
  "child_process",
  "fetch(",
  "process.env",
  "os.homedir",
  "homedir(",
] as const;

const sourceOf = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

describe("TC-TELEMETRY-036 offline hermetic posture", () => {
  test("no new suite opens a socket, spawns a process, or resolves a credential", () => {
    const failures: string[] = [];
    // This scanner necessarily contains the literal patterns it looks for, so it
    // excludes itself; every other suite is scanned.
    for (const suite of SUITES.filter((entry) => !entry.endsWith("telemetry-hermetic.test.ts"))) {
      const source = sourceOf(suite);
      for (const forbidden of FORBIDDEN) {
        if (source.includes(forbidden)) failures.push(`${suite}: ${forbidden}`);
      }
      for (const forbidden of ["resolveCredential", "createEnvironmentCredentialPort"]) {
        if (source.includes(forbidden)) failures.push(`${suite}: ${forbidden}`);
      }
    }
    expect(failures).toEqual([]);
  });

  test("every new suite and fixture stays inside the temp-root discipline", () => {
    const failures: string[] = [];
    for (const path of [...SUITES, ...FIXTURES].filter(
      (entry) => !entry.endsWith("telemetry-hermetic.test.ts"),
    )) {
      const source = sourceOf(path);
      const usesTempRoot =
        source.includes("makeTempRoot") ||
        source.includes("makeTelemetryStore") ||
        source.includes("foldTelemetryStore") ||
        source.includes("makeRetroDir") ||
        source.includes("mkdtemp");
      if (!usesTempRoot) failures.push(`${path}: no temp-root constructor`);
      if (/["'`]\/home\//u.test(source)) failures.push(`${path}: absolute home path literal`);
      if (/~\/\./u.test(source)) failures.push(`${path}: home-directory literal`);
    }
    expect(failures).toEqual([]);
  });

  test("the telemetry fixture directory carries no credential or personal data shapes", () => {
    const directory = join(ROOT, "tests/fixtures/telemetry");
    const shapes = [/\bsk-[A-Za-z0-9]{16,}/u, /\bghp_[A-Za-z0-9]{20,}/u, /\bAKIA[0-9A-Z]{16}\b/u];
    for (const file of readdirSync(directory)) {
      if (!file.endsWith(".ts")) continue;
      const text = readFileSync(join(directory, file), "utf8");
      for (const shape of shapes) {
        expect(shape.test(text), `${file} carries a credential-shaped literal`).toBe(false);
      }
      expect(/\b(token|secret|password)\s*[:=]\s*["'][^"']{12,}["']/u.test(text), file).toBe(false);
    }
  });

  test("discovery covers the new suites through the default test pattern", () => {
    const bunfig = readFileSync(join(ROOT, "bunfig.toml"), "utf8");
    expect(bunfig).toContain('root = "."');
    for (const suite of SUITES) {
      expect(suite.endsWith(".test.ts")).toBe(true);
      expect(bunfig).not.toContain(suite);
    }
  });
});
