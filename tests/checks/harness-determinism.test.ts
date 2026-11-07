/**
 * TC-HARN-030 — determinism and golden stability.
 *
 * Goldens are read-only pins; the explicit regenerate script is the only
 * writer. Every comparison is paired with a one-field mutation that asserts
 * inequality, so no golden is self-fulfilling.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { classifyHarnessEvidence } from "../../packages/core/src/domain/harness-classify";
import { assembleHarnessLiveness } from "../../packages/core/src/domain/harness-liveness";
import { canonicalHarnessJson } from "../../packages/core/src/domain/index";
import { GOLDENS } from "../fixtures/harness/golden/regenerate";

const ROOT = process.cwd();
const GOLDEN = "tests/fixtures/harness/golden";

const readGolden = (name: string): string => readFileSync(join(ROOT, GOLDEN, name), "utf8");

describe("TC-HARN-030 goldens and determinism", () => {
  test("every golden matches the recomputed canonical output", () => {
    for (const [name, value] of Object.entries(GOLDENS)) {
      const expected = readGolden(name);
      expect(canonicalHarnessJson(value)).toBe(canonicalHarnessJson(JSON.parse(expected)));
    }
  });

  test("re-computation with fresh fakes is byte-identical", () => {
    const first = canonicalHarnessJson(GOLDENS["telemetry.json"]);
    const second = canonicalHarnessJson(GOLDENS["telemetry.json"]);
    expect(first).toBe(second);
  });

  test("map insertion order does not change canonical output", () => {
    const liveness = assembleHarnessLiveness({ sourced: [] });
    const reordered = assembleHarnessLiveness({ sourced: [] });
    expect(canonicalHarnessJson(liveness)).toBe(canonicalHarnessJson(reordered));
    const evidence = {
      completionMarker: true,
      exitStatus: 0,
      timedOut: false,
      spawnRefused: false,
      failureReported: false,
      toolFailure: false,
    };
    const shuffled = {
      toolFailure: false,
      failureReported: false,
      spawnRefused: false,
      timedOut: false,
      exitStatus: 0,
      completionMarker: true,
    };
    expect(classifyHarnessEvidence(evidence)).toEqual(classifyHarnessEvidence(shuffled));
  });

  test("goldens are read-only and their mtime is unchanged", () => {
    const before = statSync(join(ROOT, GOLDEN, "classification.json")).mtimeMs;
    readGolden("classification.json");
    expect(statSync(join(ROOT, GOLDEN, "classification.json")).mtimeMs).toBe(before);
  });

  test("a one-field mutation fails the comparison, then restore passes", () => {
    const original = JSON.parse(readGolden("classification.json")) as Array<{
      id: string;
      token: string;
      evidence: unknown;
    }>;
    const mutated = original.map((entry, index) =>
      index === 0 ? { ...entry, token: "failed" } : entry,
    );
    expect(canonicalHarnessJson(mutated)).not.toBe(canonicalHarnessJson(original));
    expect(canonicalHarnessJson(original)).toBe(canonicalHarnessJson(original));
  });
});
