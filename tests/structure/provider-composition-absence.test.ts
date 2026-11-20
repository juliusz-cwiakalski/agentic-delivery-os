/**
 * GH-350 TC-SIM-011 — the simulation path holds no transport, credential,
 * network, or child-process capability, and it contains no second evaluator.
 *
 * The scan is a source pass with planted controls, so a scanner that never fires
 * fails rather than passes.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SIMULATE = "packages/core/src/provider/simulate.ts";
const FIXTURE_READER = "packages/adapters/src/file/provider-simulate-fixture.ts";

/** Capabilities a simulation must never reach. */
const FORBIDDEN = [
  "child_process",
  "node:http",
  "node:https",
  "node:net",
  "node:dgram",
  "Bun.spawn",
  "Bun.$",
  "fetch(",
  "@delivery-os/adapters/credentials",
  "@delivery-os/adapters/provider-quota",
  "process.env",
  "pre-opencode-iteration",
  "Intl",
] as const;

/** Arithmetic that belongs to the one delivered evaluator, never to simulate. */
const SECOND_EVALUATOR = [
  "combineProviderConditions",
  "evaluatePeakWindow",
  "evaluateQuotaResponse",
  "createParkRecord",
  "createParkAnnouncement",
  "peakWindowEndInstantMs",
] as const;

export const capabilityHits = (source: string, needles: readonly string[]): string[] =>
  needles.filter((needle) => source.includes(needle));

const sourceOf = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

describe("TC-SIM-011 the simulate path holds no side-effecting capability", () => {
  test("the simulate module imports the delivered engine and no forbidden capability", () => {
    const source = sourceOf(SIMULATE);
    expect(capabilityHits(source, FORBIDDEN)).toEqual([]);
    expect(capabilityHits(source, SECOND_EVALUATOR)).toEqual([]);
    expect(source).toContain('from "./engine.js"');
    expect(source).toContain("createProviderEngine");
    expect(source).toContain("persist: false");
  });

  test("the fixture reader is one bounded read with no capability beyond the file facts", () => {
    const source = sourceOf(FIXTURE_READER);
    expect(capabilityHits(source, FORBIDDEN)).toEqual([]);
    expect(source).toContain("PROVIDER_SIMULATE_FIXTURE_MAX_BYTES");
    expect(source).toContain("byteLength");
  });

  test("the scan is non-vacuous: planted capabilities and a planted second evaluator are detected", () => {
    const planted = [
      'import { spawn } from "node:child_process";',
      "const response = fetch(",
      "export const value = process.env.EXAMPLE;",
      "const peak = evaluatePeakWindow(window, nowMs, facts);",
    ].join("\n");
    expect(capabilityHits(planted, FORBIDDEN)).toEqual(["child_process", "fetch(", "process.env"]);
    expect(capabilityHits(planted, SECOND_EVALUATOR)).toEqual(["evaluatePeakWindow"]);
  });

  test("no production composition outside the edge reads a simulation fixture", () => {
    const edge = sourceOf("packages/cli/src/edge.ts");
    expect(edge).toContain("readProviderSimulateFixture");
    for (const relative of [
      "packages/cli/src/production.ts",
      "packages/core/src/provider/engine.ts",
    ]) {
      expect(sourceOf(relative), relative).not.toContain("readProviderSimulateFixture");
    }
    // The adapter barrel registers the export; the reader module itself is the
    // only implementation.
    expect(sourceOf("packages/adapters/src/file/index.ts")).toContain(
      'from "./provider-simulate-fixture.js"',
    );
  });
});

/**
 * GH-350 TC-MIG-004 (static half) — the migration module reads data only: no
 * child-process, shell, VM, worker, filesystem, network, or environment
 * capability, and no ambient-code constructor.
 */
const MIGRATE = "packages/core/src/provider/migrate.ts";
const MIGRATE_READER = "packages/adapters/src/file/provider-migrate-source.ts";

const MIGRATE_FORBIDDEN = [
  "child_process",
  "Bun.$",
  "Bun.spawn",
  "spawn(",
  "execFile",
  "new Function",
  "eval(",
  "node:vm",
  "node:fs",
  "node:http",
  "process.env",
  "pre-opencode-iteration",
] as const;

describe("TC-MIG-004 the migration module holds no execution capability", () => {
  test("the migration module reads data only and imports contracts alone", () => {
    const source = sourceOf(MIGRATE);
    expect(capabilityHits(source, MIGRATE_FORBIDDEN)).toEqual([]);
    expect(capabilityHits(source, SECOND_EVALUATOR)).toEqual([]);
    expect(source).toContain('from "#contracts"');
    expect(source).toContain("PROVIDER_MIGRATE_SOURCE_MAX_BYTES");
    expect(source).toContain("PROVIDER_MIGRATE_SOURCE_MAX_LINES");
    // The source-count cap is enforced by the adapter's discovery
    // (`readProviderMigrateSources`); the pure module never needed it, and the
    // dead cap-refusal helper was removed (GH-350 m3).
  });

  test("the bounded source reader imports contracts and the file-facts type only", () => {
    const source = sourceOf(MIGRATE_READER);
    expect(
      capabilityHits(
        source,
        MIGRATE_FORBIDDEN.filter((needle) => needle !== "pre-opencode-iteration"),
      ),
    ).toEqual([]);
    expect(source).toContain("readProviderMigrateSources");
    expect(source).toContain("PROVIDER_MIGRATE_MAX_SOURCES");
  });

  test("the scan is non-vacuous: every planted execution form is detected", () => {
    const planted = [
      'import { spawn } from "node:child_process";',
      "const out = Bun.$`rm -rf /`;",
      "eval(payload);",
      "const fn = new Function(payload);",
      'import vm from "node:vm";',
    ].join("\n");
    expect(capabilityHits(planted, MIGRATE_FORBIDDEN)).toEqual([
      "child_process",
      "Bun.$",
      "new Function",
      "eval(",
      "node:vm",
    ]);
  });
});
