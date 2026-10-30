/**
 * TC-META-001 / TC-META-002 — golden carrier round-trip within the v1 size
 * bound, and parse-and-strip with no marker residue.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseEnvelope,
  readRawCarrier,
  type SerializedCarrier,
  serializeEnvelope,
  stripEnvelope,
} from "../../packages/adapters/src/io/envelope-codec";
import {
  CARRIER_KINDS,
  type CarrierKind,
  ENVELOPE_KINDS,
  ENVELOPE_MAX_BYTES,
  ENVELOPE_SCHEMA_ID,
  type MetadataEnvelopeV1,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const GOLDEN = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/envelope/golden/payloads.json"), "utf8"),
) as {
  cases: Array<{ id: string; humanContent: string; envelope: MetadataEnvelopeV1 }>;
};

const parseCarrier = (carrier: SerializedCarrier) =>
  carrier.carrier === "provider-custom-field"
    ? parseEnvelope({ carrier: carrier.carrier, fieldValue: carrier.fieldValue })
    : parseEnvelope({ carrier: carrier.carrier, text: carrier.text });

describe("TC-META-001 golden carrier round-trip", () => {
  test("every payload round-trips through every declared carrier within the bound", () => {
    const covered = new Set<CarrierKind>();
    for (const testCase of GOLDEN.cases) {
      for (const carrier of CARRIER_KINDS) {
        const serialized = serializeEnvelope({
          envelope: testCase.envelope,
          carrier,
          humanContent: testCase.humanContent,
        });
        expect(serialized.ok, `${testCase.id}/${carrier}`).toBe(true);
        if (!serialized.ok) continue;
        covered.add(carrier);
        expect(serialized.byteLength).toBeLessThanOrEqual(ENVELOPE_MAX_BYTES);
        expect(serialized.carrier.carrier).toBe(carrier);

        const parsed = parseCarrier(serialized.carrier);
        expect(parsed.ok, `${testCase.id}/${carrier} parse`).toBe(true);
        if (parsed.ok) expect(parsed.envelope).toEqual(testCase.envelope);

        if (serialized.carrier.carrier === "provider-custom-field") {
          expect(parsed.ok ? parsed.humanContent : "").toBe("");
          expect(serialized.carrier.fieldValue).not.toContain(testCase.humanContent);
        } else {
          expect(parsed.ok ? parsed.humanContent : "").toBe(testCase.humanContent);
          expect(serialized.carrier.text).toContain(testCase.humanContent);
        }
      }
    }
    expect([...covered].sort()).toEqual([...CARRIER_KINDS].sort());
  });

  test("the size bound is the spec ceiling and an over-bound payload fails by name", () => {
    expect(ENVELOPE_MAX_BYTES).toBe(2048);
    const oversized: MetadataEnvelopeV1 = {
      schema: ENVELOPE_SCHEMA_ID,
      kind: ENVELOPE_KINDS[0],
      payload: {
        comment: { producingAgent: "a".repeat(1500), operatorAuthority: "o".repeat(1500) },
        delivery: { workItemRef: "GH-181", runId: "run-1" },
      },
    };
    const serialized = serializeEnvelope({
      envelope: oversized,
      carrier: "invisible-comment-block",
      humanContent: "body",
    });
    expect(serialized.ok).toBe(false);
    if (!serialized.ok) {
      expect(serialized.failure).toBe("size-bound-exceeded");
      expect(serialized.byteLength).toBeGreaterThan(ENVELOPE_MAX_BYTES);
    }
  });
});

describe("TC-META-002 parse and strip", () => {
  const envelope: MetadataEnvelopeV1 = {
    schema: ENVELOPE_SCHEMA_ID,
    kind: "work-item-comment",
    payload: {
      comment: { producingAgent: "claude-code", operatorAuthority: "operator:juliusz" },
      delivery: { workItemRef: "GH-181", runId: "run-1" },
    },
  };
  const json = JSON.stringify(envelope);
  const marker = `<!-- ${ENVELOPE_SCHEMA_ID} ${json} -->`;

  const positions: Array<[string, string, string]> = [
    ["beginning", `${marker}\nOriginal body`, "Original body"],
    ["middle", `Before\n${marker}\nAfter`, "Before\nAfter"],
    ["end", `Original body\n${marker}`, "Original body"],
  ];

  test("the envelope is removed exactly at every position with no residue", () => {
    for (const [label, text, expected] of positions) {
      expect(stripEnvelope("invisible-comment-block", text), label).toBe(expected);
      const parsed = parseEnvelope({ carrier: "invisible-comment-block", text });
      expect(parsed.ok, label).toBe(true);
      if (parsed.ok) {
        expect(parsed.humanContent, label).toBe(expected);
        expect(parsed.humanContent, label).not.toContain(ENVELOPE_SCHEMA_ID);
      }
    }
  });

  test("a custom field carries the envelope beside untouched human content", () => {
    const parsed = parseEnvelope({ carrier: "provider-custom-field", fieldValue: json });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.humanContent).toBe("");
      expect(parsed.envelope).toEqual(envelope);
    }
  });

  test("re-parsing the stripped content degrades with `missing`", () => {
    const stripped = stripEnvelope("invisible-comment-block", `Original body\n${marker}`);
    const reparsed = parseEnvelope({ carrier: "invisible-comment-block", text: stripped });
    expect(reparsed.ok).toBe(false);
    if (!reparsed.ok) expect(reparsed.reason).toBe("missing");
  });

  test("raw carrier text is reachable only through the audited escape hatch", () => {
    const rawText = `Original body\n${marker}`;
    expect(readRawCarrier(rawText)).toEqual({ raw: rawText });
    const parsed = parseEnvelope({ carrier: "invisible-comment-block", text: rawText });
    expect(parsed).not.toHaveProperty("raw");
  });

  test("a malformed marker is not silently stripped (residue is detectable)", () => {
    const broken = "<!-- delivery.metadata.v1 {}\nOriginal body";
    const stripped = stripEnvelope("invisible-comment-block", broken);
    expect(stripped).toContain("delivery.metadata.v1");
    expect(stripped).not.toBe("Original body");
  });

  test("a payload marker lookalike does not corrupt trailing human content", () => {
    const lookalike = `[${ENVELOPE_SCHEMA_ID}:${JSON.stringify({ q: 1 })}]`;
    const payload = { x: `${lookalike}y` };
    const nested = `<!-- ${ENVELOPE_SCHEMA_ID} ${JSON.stringify(payload)} -->\nTAIL line that must survive`;
    expect(stripEnvelope("invisible-comment-block", nested)).toBe("TAIL line that must survive");
    const parsed = parseEnvelope({ carrier: "invisible-comment-block", text: nested });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.reason).toBe("malformed");
      expect(parsed.humanContent).toBe("TAIL line that must survive");
    }
  });

  test("a valid envelope whose payload holds a marker lookalike preserves trailing content", () => {
    const lookalike = `[${ENVELOPE_SCHEMA_ID}:${JSON.stringify({ q: 1 })}]`;
    const withLookalike: MetadataEnvelopeV1 = {
      ...envelope,
      payload: {
        ...envelope.payload,
        comment: { ...envelope.payload.comment, producingAgent: lookalike },
      },
    };
    const text = `<!-- ${ENVELOPE_SCHEMA_ID} ${JSON.stringify(withLookalike)} -->\nTAIL line that must survive`;
    expect(stripEnvelope("invisible-comment-block", text)).toBe("TAIL line that must survive");
    const parsed = parseEnvelope({ carrier: "invisible-comment-block", text });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.envelope).toEqual(withLookalike);
      expect(parsed.humanContent).toBe("TAIL line that must survive");
    }
  });

  test("marker-dense hostile input is scanned in bounded time and degrades as missing", () => {
    const hostile: Array<[CarrierKind, string]> = [
      ["invisible-comment-block", "<!-- delivery.metadata.v1 {".repeat(8000)],
      ["compact-marker", "[delivery.metadata.v1:{".repeat(9000)],
    ];
    for (const [carrier, text] of hostile) {
      expect(text.length, carrier).toBeGreaterThan(200_000);
      const start = performance.now();
      const parsed = parseEnvelope({ carrier, text });
      const elapsed = performance.now() - start;
      expect(parsed.ok, carrier).toBe(false);
      if (!parsed.ok) expect(parsed.reason, carrier).toBe("missing");
      expect(elapsed, carrier).toBeLessThan(1000);
    }
  });

  test("a valid envelope near the size bound still parses under the bounded scan", () => {
    const nearBound: MetadataEnvelopeV1 = {
      schema: ENVELOPE_SCHEMA_ID,
      kind: "work-item-comment",
      payload: {
        comment: { producingAgent: "a".repeat(800), operatorAuthority: "o".repeat(800) },
        delivery: { workItemRef: "GH-181", runId: "run-1" },
      },
    };
    const serialized = serializeEnvelope({
      envelope: nearBound,
      carrier: "invisible-comment-block",
      humanContent: "body",
    });
    expect(serialized.ok).toBe(true);
    if (!serialized.ok) return;
    expect(serialized.byteLength).toBeGreaterThan(1500);
    expect(serialized.byteLength).toBeLessThanOrEqual(ENVELOPE_MAX_BYTES);
    const reparsed = parseCarrier(serialized.carrier);
    expect(reparsed.ok).toBe(true);
    if (reparsed.ok) expect(reparsed.envelope).toEqual(nearBound);
  });
});
