/**
 * TC-META-003 / TC-META-006 — the six-case degradation matrix over the closed
 * DEC-8 reason taxonomy, and the version window (DEC-7).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type CarrierKind,
  type DegradationReason,
  ENVELOPE_SCHEMA_ID,
  type MetadataEnvelopeV1,
} from "../../packages/core/src/contracts/index";
import { heuristicProvenance, readComment } from "../fixtures/ports/comment-adapter";

const ROOT = process.cwd();
const ACCOUNT = "operator:fixture";
const EXPECTED_REASONS: readonly DegradationReason[] = [
  "missing",
  "malformed",
  "wrong-kind",
  "unknown-version",
];

const degradation = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/envelope/degradation/cases.json"), "utf8"),
) as {
  cases: Array<{
    id: string;
    carrier: CarrierKind;
    text: string;
    expectedReason: DegradationReason;
  }>;
};
const versions = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/envelope/versions/cases.json"), "utf8"),
) as { cases: Array<{ id: string; version: string; expectedReason: DegradationReason }> };
const valid = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/envelope/valid.json"), "utf8"),
) as {
  humanContent: string;
  envelope: MetadataEnvelopeV1;
};

describe("TC-META-003 degradation matrix", () => {
  test("all six input cases return a degraded view with a closed-taxonomy reason", () => {
    expect(degradation.cases).toHaveLength(6);
    for (const testCase of degradation.cases) {
      const view = readComment({
        carrier: testCase.carrier,
        text: testCase.text,
        account: ACCOUNT,
      });
      expect(view.body.length, testCase.id).toBeGreaterThan(0);
      expect(view.degradation?.reason, testCase.id).toBe(testCase.expectedReason);
      expect(EXPECTED_REASONS, testCase.id).toContain(testCase.expectedReason);
      expect(view.provenance.structural, testCase.id).toBe(false);
    }
  });

  test("absent and stripped share `missing` as one observational class", () => {
    const absent = degradation.cases.find((entry) => entry.id === "absent");
    const stripped = degradation.cases.find((entry) => entry.id === "stripped");
    expect(absent?.expectedReason).toBe("missing");
    expect(stripped?.expectedReason).toBe("missing");
  });

  test("heuristic fallback is identical in every degraded case", () => {
    const expected = heuristicProvenance(ACCOUNT);
    for (const testCase of degradation.cases) {
      const view = readComment({
        carrier: testCase.carrier,
        text: testCase.text,
        account: ACCOUNT,
      });
      expect(view.degradation?.heuristics, testCase.id).toEqual(expected);
      expect(view.provenance, testCase.id).toEqual(expected);
    }
  });

  test("malformed metadata is not a failure and carries no error-table code", () => {
    const malformed = degradation.cases.find((entry) => entry.id === "malformed");
    if (malformed === undefined) throw new Error("malformed fixture is missing");
    const view = readComment({
      carrier: malformed.carrier,
      text: malformed.text,
      account: ACCOUNT,
    });
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain("fallback.");
    expect(serialized).not.toContain("config.");
    expect(view).not.toHaveProperty("code");
    expect(view.degradation?.reason).toBe("malformed");
  });

  test("a nested marker lookalike degrades visibly without dropping human content", () => {
    const lookalike = `[${ENVELOPE_SCHEMA_ID}:${JSON.stringify({ q: 1 })}]`;
    const text = `<!-- ${ENVELOPE_SCHEMA_ID} ${JSON.stringify({ x: lookalike })} -->\nTAIL body that must survive`;
    const view = readComment({ carrier: "invisible-comment-block", text, account: ACCOUNT });
    expect(view.degradation?.reason).toBe("malformed");
    expect(view.body).toBe("TAIL body that must survive");
    expect(view.provenance.structural).toBe(false);
  });

  test("the valid-envelope control reads structurally with no evidence", () => {
    const view = readComment({
      carrier: "provider-custom-field",
      fieldValue: JSON.stringify(valid.envelope),
      account: ACCOUNT,
    });
    expect(view.degradation).toBeUndefined();
    expect(view.provenance).toEqual(valid.envelope.payload.comment);
    expect(view.body).toBe("");
  });
});

describe("TC-META-006 version window", () => {
  const envelope: MetadataEnvelopeV1 = {
    schema: ENVELOPE_SCHEMA_ID,
    kind: "work-item-comment",
    payload: {
      comment: { producingAgent: "claude-code", operatorAuthority: "operator:juliusz" },
      delivery: { workItemRef: "GH-181", runId: "run-1" },
    },
  };

  const textWith = (version: string): string =>
    `<!-- ${version} ${JSON.stringify({ ...envelope, schema: version })} -->\nOriginal body`;

  test("older-than-v1 and newer-than-v1 strings both degrade with `unknown-version`", () => {
    for (const testCase of versions.cases) {
      const view = readComment({
        carrier: "invisible-comment-block",
        text: textWith(testCase.version),
        account: ACCOUNT,
      });
      expect(view.degradation?.reason, testCase.id).toBe(testCase.expectedReason);
      expect(view.provenance.structural, testCase.id).toBe(false);
    }
  });

  test("v1 is the only structurally read version and is never silently widened", () => {
    const v1 = readComment({
      carrier: "invisible-comment-block",
      text: textWith(ENVELOPE_SCHEMA_ID),
      account: ACCOUNT,
    });
    expect(v1.degradation).toBeUndefined();
    expect(v1.provenance).toEqual(envelope.payload.comment);
    const matrix = [
      { version: ENVELOPE_SCHEMA_ID, reason: "structural" },
      ...versions.cases.map((entry) => ({ version: entry.version, reason: entry.expectedReason })),
    ];
    expect(matrix.map((entry) => entry.reason)).toEqual([
      "structural",
      "unknown-version",
      "unknown-version",
    ]);
  });
});
