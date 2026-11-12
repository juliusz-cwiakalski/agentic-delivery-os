/**
 * TC-TELEMETRY-039 (declaration half) — the telemetry v2 contract is the
 * single home of the storage identity, the step and baseline record families,
 * the reconciliation and reading-basis vocabularies, the breakdown-field set,
 * the v2 warning-reason additions, and the frame field mapping. The delivered
 * six-key spend payload and its declared order are untouched (DEC-6 control).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  HARNESS_TOKEN_CLASSES,
  HARNESS_WARNING_REASONS,
  SPEND_BREAKDOWN_FIELDS,
  SPEND_DATA_KEYS,
  SPEND_TELEMETRY_ABSENT_CODE,
  SPEND_V2_DATA_KEYS,
  TELEMETRY_BASELINE_KEY_PREFIX,
  TELEMETRY_BASELINE_RECORD_KIND,
  TELEMETRY_BASELINE_SCHEMA_ID,
  TELEMETRY_FRAME_CALLS_FIELD,
  TELEMETRY_FRAME_COST_FIELD,
  TELEMETRY_FRAME_TOKENS_FIELD,
  TELEMETRY_MIGRATION_RULE,
  TELEMETRY_READING_BASES,
  TELEMETRY_RECONCILIATION_TOLERANCE,
  TELEMETRY_RECONCILIATION_VERDICTS,
  TELEMETRY_SESSION_COMBINATION_RULE,
  TELEMETRY_STATE_PRESENT,
  TELEMETRY_STEP_FINISH_PART_TYPE,
  TELEMETRY_STEP_FRAME_TYPE,
  TELEMETRY_STEP_KEY_PREFIX,
  TELEMETRY_STEP_RECORD_KIND,
  TELEMETRY_STEP_SCHEMA_ID,
  TELEMETRY_STORAGE_SCHEMA_VERSION,
  TELEMETRY_UNATTRIBUTED_DIMENSION_RULE,
  TELEMETRY_VERDICT_OUTSIDE,
  TELEMETRY_VERDICT_UNAVAILABLE,
  TELEMETRY_VERDICT_WITHIN,
  TELEMETRY_WARNING_REASONS,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const TOKEN_CAPTURE = join(ROOT, "tests/fixtures/harness/stream/opencode-v2.2.5-tokens.jsonl");

describe("telemetry v2 contract declaration", () => {
  test("the storage identity is brand-neutral, versioned, and single-homed (GAP-7)", () => {
    expect(TELEMETRY_STORAGE_SCHEMA_VERSION).toBe("delivery.telemetry.storage.v1");
    expect(TELEMETRY_STORAGE_SCHEMA_VERSION.toLowerCase()).not.toContain("opencode");
    expect(TELEMETRY_STORAGE_SCHEMA_VERSION.toLowerCase()).not.toContain("claude");
    expect(TELEMETRY_MIGRATION_RULE).toContain("re-reading");
    expect(TELEMETRY_MIGRATION_RULE).toContain("never mutated in place");
  });

  test("the step and baseline record families are additive and distinct", () => {
    expect(TELEMETRY_STEP_RECORD_KIND).toBe("harness.telemetry.step");
    expect(TELEMETRY_STEP_SCHEMA_ID).toBe("delivery.harness.telemetry.step.v1");
    expect(TELEMETRY_BASELINE_RECORD_KIND).toBe("harness.telemetry.baseline");
    expect(TELEMETRY_BASELINE_SCHEMA_ID).toBe("delivery.harness.telemetry.baseline.v1");
    expect(TELEMETRY_STEP_KEY_PREFIX.endsWith(":")).toBe(true);
    expect(TELEMETRY_BASELINE_KEY_PREFIX.endsWith(":")).toBe(true);
    expect(TELEMETRY_STEP_KEY_PREFIX).not.toBe(TELEMETRY_BASELINE_KEY_PREFIX);
    expect(TELEMETRY_STEP_RECORD_KIND).not.toBe(TELEMETRY_BASELINE_RECORD_KIND);
  });

  test("the declared tolerance is exactly 0.02 and stated, never silent (DEC-2)", () => {
    expect(TELEMETRY_RECONCILIATION_TOLERANCE).toBe(0.02);
    expect(TELEMETRY_RECONCILIATION_TOLERANCE).toBeLessThanOrEqual(0.02);
  });

  test("the verdict vocabulary is exactly the declared three (GAP-5, DEC-5)", () => {
    expect([...TELEMETRY_RECONCILIATION_VERDICTS]).toEqual(["within", "outside", "unavailable"]);
    expect(TELEMETRY_VERDICT_WITHIN).toBe("within");
    expect(TELEMETRY_VERDICT_OUTSIDE).not.toBe(TELEMETRY_VERDICT_WITHIN);
    expect(TELEMETRY_VERDICT_UNAVAILABLE).not.toBe(TELEMETRY_VERDICT_WITHIN);
    expect(new Set(TELEMETRY_RECONCILIATION_VERDICTS).size).toBe(3);
  });

  test("the reading bases name both capture planes and their declared combination", () => {
    expect([...TELEMETRY_READING_BASES]).toEqual(["stream-ingest", "closeout-capture", "combined"]);
    expect(new Set(TELEMETRY_READING_BASES).size).toBe(3);
  });

  test("the telemetry-state disclosure declares present; absence stays single-homed", () => {
    expect(TELEMETRY_STATE_PRESENT).toBe("present");
    // The classified absence kind keeps its delivered identity, reused not forked.
    expect(SPEND_TELEMETRY_ABSENT_CODE).toBe("spend.telemetry-absent");
    expect(TELEMETRY_WARNING_REASONS.includes("spend.telemetry-absent")).toBe(false);
  });

  test("the v2 warning vocabulary extends the delivered set additively (GAP-4)", () => {
    const reasons: readonly string[] = TELEMETRY_WARNING_REASONS;
    expect(new Set(reasons).size).toBe(reasons.length);
    for (const reason of HARNESS_WARNING_REASONS) {
      expect(reasons.includes(reason)).toBe(true);
    }
    // The five degradation classes: omission, drift, unattributable,
    // baseline-exclusion, truncation — each has its closed reason.
    for (const reason of [
      "optional-field-absent",
      "version-drift",
      "unattributable-step",
      "baseline-session-excluded",
      "truncated",
    ]) {
      expect(reasons.includes(reason)).toBe(true);
    }
    expect(reasons.length).toBe(HARNESS_WARNING_REASONS.length + 2);
  });

  test("the breakdown-field set is exactly the five declared dimensions", () => {
    expect([...SPEND_BREAKDOWN_FIELDS]).toEqual(["ticket", "repository", "lane", "role", "model"]);
    expect(SPEND_BREAKDOWN_FIELDS.length).toBe(5);
    expect(new Set(SPEND_BREAKDOWN_FIELDS).size).toBe(5);
  });

  test("the v2 data keys are additive beside the delivered six (DEC-6)", () => {
    expect(SPEND_DATA_KEYS).toEqual([
      "tokensByClass",
      "perPhase",
      "perAgent",
      "restarts",
      "amplification",
      "degradation",
    ]);
    const v2Keys: readonly string[] = SPEND_V2_DATA_KEYS;
    const v1Keys: readonly string[] = SPEND_DATA_KEYS;
    expect(v2Keys.length).toBe(5);
    for (const key of v2Keys) {
      expect(v1Keys.includes(key)).toBe(false);
    }
  });

  test("the frame vocabulary names the committed capture's fields (OQ-T1)", () => {
    expect(TELEMETRY_STEP_FRAME_TYPE).toBe("step_finish");
    expect(TELEMETRY_STEP_FINISH_PART_TYPE).toBe("step-finish");
    expect(TELEMETRY_FRAME_TOKENS_FIELD).toBe("tokens");
    expect(TELEMETRY_FRAME_COST_FIELD).toBe("cost");
    expect(TELEMETRY_FRAME_CALLS_FIELD).toBe("calls");
  });

  test("the declared combination arithmetic is the session-dedup rule (OQ-T4)", () => {
    expect(TELEMETRY_SESSION_COMBINATION_RULE).toContain("dedupe-by-sessionId");
    expect(TELEMETRY_SESSION_COMBINATION_RULE).toContain("baseline input only");
  });

  test("the unattributed-dimension rule excludes and discloses, never guesses", () => {
    expect(TELEMETRY_UNATTRIBUTED_DIMENSION_RULE).toBe("exclude-and-disclose");
  });

  test("the token-bearing capture carries the declared frame shape (GAP-2)", () => {
    const lines = readFileSync(TOKEN_CAPTURE, "utf8")
      .split("\n")
      .filter((line) => line.trim().length > 0);
    expect(lines.length).toBeGreaterThan(0);
    const finishes: { tokens: Record<string, unknown>; cost: unknown; calls: unknown }[] = [];
    for (const line of lines) {
      const parsed: unknown = JSON.parse(line);
      expect(typeof parsed).toBe("object");
      expect(parsed).not.toBeNull();
      const frame = parsed as Record<string, unknown>;
      expect(typeof frame.sessionID).toBe("string");
      if (frame.type !== TELEMETRY_STEP_FRAME_TYPE) continue;
      const part = frame.part as Record<string, unknown>;
      expect(part.type).toBe(TELEMETRY_STEP_FINISH_PART_TYPE);
      finishes.push({
        tokens: part[TELEMETRY_FRAME_TOKENS_FIELD] as Record<string, unknown>,
        cost: part[TELEMETRY_FRAME_COST_FIELD],
        calls: part[TELEMETRY_FRAME_CALLS_FIELD],
      });
    }
    expect(finishes.length).toBe(2);
    for (const finish of finishes) {
      for (const tokenClass of HARNESS_TOKEN_CLASSES) {
        expect(typeof finish.tokens[tokenClass]).toBe("number");
      }
      expect(typeof finish.cost).toBe("number");
      // The observed capture carries no explicit call count: omission degrades,
      // it never fabricates (the README's declared reality).
      expect(finish.calls).toBeUndefined();
    }
  });
});
