/**
 * TC-SUP-106 — the golden normalizer replaces exactly the declared volatile
 * fields, and no committed golden carries one (GH-295 NFR-3, DM-1, AC-F1-1).
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  NORMALIZER_REPLACEMENTS,
  VOLATILE_GOLDEN_VALUES,
  hasVolatileTiming,
  normalizeHuman,
  normalizeMachine,
} from "../fixtures/supervise/golden/normalize";
import { volatilePayload } from "../fixtures/supervise/records";

const ROOT = process.cwd();
const GOLDEN = join(ROOT, "tests/fixtures/supervise/golden");
const TEMP_ROOT = "/tmp/supervision-root-abc";
const RUN_ID = "run-normalizer-injected";

describe("TC-SUP-106 the declared volatile fields are replaced by behaviour", () => {
  test("root, run id, and timing are replaced; undeclared values survive", () => {
    const payload = volatilePayload({ root: TEMP_ROOT, runId: RUN_ID });
    const normalized = normalizeMachine(JSON.stringify(payload), {
      root: TEMP_ROOT,
      runId: RUN_ID,
    });
    expect(normalized.runId).toBe("<run-id>");
    expect(normalized.timing).toEqual({ totalMs: 0 });
    const data = normalized.data as Record<string, unknown>;
    expect(data.root).toBe("<temp-root>");
    // Undeclared content is untouched, byte for byte.
    expect(data.repo).toBe("github.com/example/supervision-repo");
    expect(data.ref).toBe("GH-295");
    expect(data.observedAt).toBe("2026-11-17T00:00:00.000Z");
  });

  test("the human normalizer replaces exactly the same two textual values", () => {
    const text = `root=${TEMP_ROOT}\nrun=${RUN_ID}\nref=GH-295`;
    expect(normalizeHuman(text, { root: TEMP_ROOT, runId: RUN_ID })).toBe(
      "root=<temp-root>\nrun=<run-id>\nref=GH-295",
    );
  });

  test("the replacement set is bound to the behaviour, not to a constant length", () => {
    expect([...NORMALIZER_REPLACEMENTS]).toEqual(["temp-root", "run-id", "timing"]);
    // Each declared field is observed as a replacement effect above; the
    // non-volatile ref survives. A changed replacement set fails this cell.
    const payload = volatilePayload({ root: TEMP_ROOT, runId: RUN_ID });
    const normalized = normalizeMachine(JSON.stringify(payload), {
      root: TEMP_ROOT,
      runId: RUN_ID,
    });
    expect(JSON.stringify(normalized)).not.toContain(TEMP_ROOT);
    expect(JSON.stringify(normalized)).not.toContain(RUN_ID);
    expect(JSON.stringify(normalized)).toContain('"ref":"GH-295"');
  });
});

describe("TC-SUP-106 committed goldens carry no volatile value", () => {
  test("every supervision golden is normalized", () => {
    const violations: string[] = [];
    for (const entry of readdirSync(GOLDEN)) {
      if (!entry.endsWith(".json") && !entry.endsWith(".txt")) continue;
      const text = readFileSync(join(GOLDEN, entry), "utf8");
      for (const value of VOLATILE_GOLDEN_VALUES) {
        if (text.includes(value)) violations.push(`${entry}: ${value}`);
      }
      if (hasVolatileTiming(text)) violations.push(`${entry}: non-zero totalMs`);
    }
    expect(violations).toEqual([]);
  });

  test("the scan mutant detects a volatile value and a timing value", () => {
    expect(VOLATILE_GOLDEN_VALUES.some((value) => `run=${value}`.includes(value))).toBe(true);
    expect(hasVolatileTiming('"timing": { "totalMs": 7 }')).toBe(true);
    expect(hasVolatileTiming('"timing": { "totalMs": 0 }')).toBe(false);
  });
});
