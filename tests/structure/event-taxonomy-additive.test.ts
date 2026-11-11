/**
 * TC-EVT-005 (structure half) — an added payload field decodes by rule but is
 * never auto-advertised, and the projection is a declared field list rather than
 * a spread.
 */
import { describe, expect, test } from "bun:test";
import { TAXONOMY } from "../../packages/core/src/contracts/taxonomy";
import {
  compareFrames,
  compareSurface,
  scriptedFrames,
  scriptedRecords,
} from "../fixtures/events/drift-mutants";
import { CONTRACT_PAYLOAD_FIELDS } from "../fixtures/events/taxonomy-cases";

const graph = TAXONOMY.topics.find((topic) => topic.name === "queue.graph");
const entry = graph?.kinds.find((kind) => kind.name === "entry");

describe("TC-EVT-005 additive payload growth", () => {
  test("the declared payload list keeps every contracted field and no future field", () => {
    expect(entry?.payloadFields).toEqual(CONTRACT_PAYLOAD_FIELDS["queue.graph"]?.entry as string[]);
    expect(entry?.payloadFields).not.toContain("futureField");
    expect(graph?.payloadFields).not.toContain("futureField");
  });

  test("the projection emits only declared payload keys, never a source spread", () => {
    const frame = scriptedFrames(TAXONOMY).find((candidate) => candidate.data.kind === "entry");
    const payload = frame?.data.payload as Record<string, unknown>;
    const declared = new Set(
      (entry?.payloadFields ?? []).map((field) => field.replace(/[?[\]]/gu, "")),
    );
    for (const key of Object.keys(payload)) expect(declared.has(key)).toBe(true);
    expect(Object.keys(payload)).not.toContain("futureField");
  });

  test("adding a payload field to a kind is flagged as version-forcing", () => {
    const records = scriptedRecords(TAXONOMY).map((record) =>
      record.name === "queue.graph"
        ? {
            ...record,
            kinds: record.kinds.map((kind) =>
              kind.name === "entry"
                ? { ...kind, payloadFields: [...kind.payloadFields, "futureField"] }
                : kind,
            ),
          }
        : record,
    );
    const violations = compareSurface(TAXONOMY, records);
    expect(
      violations.some(
        (violation) => violation.topic === "queue.graph" && violation.field === "payloadFields",
      ),
    ).toBe(true);
    expect(violations.every((violation) => violation.versionImplication)).toBe(true);
  });

  test("an undeclared payload key on a frame is a comparison violation", () => {
    const frames = scriptedFrames(TAXONOMY);
    const extended = frames.map((frame, index) =>
      index === 0
        ? {
            ...frame,
            data: {
              ...frame.data,
              payload: { ...(frame.data.payload as Record<string, unknown>), futureField: "x" },
            },
          }
        : frame,
    );
    const violations = compareFrames(TAXONOMY, extended);
    expect(violations.some((violation) => violation.detail.includes("futureField"))).toBe(true);
  });
});
