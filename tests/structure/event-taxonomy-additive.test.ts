/**
 * TC-EVT-005 and TC-EVT-088 — an added payload field decodes by rule but is never
 * auto-advertised, and every declared kind's emitted payload is EXACTLY the
 * declared field list, proven through the real projector rather than by
 * comparing the declaration with itself.
 *
 * The projection is hand-authored (the declaration carries no source-field map),
 * so the exact-key comparison is the proof that the second copy cannot drift: a
 * kind that emits an undeclared field fails here, and a declared required field
 * that the projection drops fails here too.
 */
import { describe, expect, test } from "bun:test";
import { CONTRACT_KINDS, CONTRACT_PAYLOAD_FIELDS } from "../fixtures/events/taxonomy-cases";
import { TAXONOMY } from "../../packages/core/src/contracts/taxonomy";
import {
  compareFrames,
  compareSurface,
  scriptedFrames,
  scriptedRecords,
} from "../fixtures/events/drift-mutants";
import {
  eventsByKind,
  payloadKey,
  projectCaseEvents,
  projectionCaseRecords,
  requiredFields,
} from "../fixtures/events/projection-cases";

const graph = TAXONOMY.topics.find((topic) => topic.name === "queue.graph");
const entry = graph?.kinds.find((kind) => kind.name === "entry");

/** The real projector's frames in the comparator's frame shape. */
const realFrames = () =>
  projectCaseEvents().map((event) => ({
    kind: "event" as const,
    data: { ...event } as Record<string, unknown>,
  }));

describe("TC-EVT-005 additive payload growth", () => {
  test("the declared payload list keeps every contracted field and no future field", () => {
    expect(entry?.payloadFields).toEqual(CONTRACT_PAYLOAD_FIELDS["queue.graph"]?.entry as string[]);
    expect(entry?.payloadFields).not.toContain("futureField");
    expect(graph?.payloadFields).not.toContain("futureField");
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

  test("an undeclared payload key on a real projected frame is a comparison violation", () => {
    const frames = realFrames().map((frame) =>
      frame.data.kind === "entry"
        ? {
            ...frame,
            data: {
              ...frame.data,
              payload: { ...(frame.data.payload as Record<string, unknown>), futureField: "x" },
            },
          }
        : frame,
    );
    const violations = compareFrames(TAXONOMY, frames);
    expect(violations.some((violation) => violation.detail.includes("futureField"))).toBe(true);
  });

  test("a dropped declared payload field on a real projected frame is a comparison violation", () => {
    const frames = realFrames().map((frame) => {
      if (frame.data.kind !== "entry") return frame;
      const payload = { ...(frame.data.payload as Record<string, unknown>) };
      delete payload.priority;
      return { ...frame, data: { ...frame.data, payload } };
    });
    const violations = compareFrames(TAXONOMY, frames);
    expect(
      violations.some(
        (violation) => violation.topic === "queue.graph" && violation.detail.includes('"priority"'),
      ),
    ).toBe(true);
  });
});

describe("TC-EVT-088 exact emitted payload keys for all declared kinds", () => {
  test("the case view emits every declared emitted kind and no other", () => {
    const events = projectCaseEvents();
    const emitted = new Set(events.map((event) => `${event.topic}/${event.kind}`));
    const declared = new Set(
      TAXONOMY.topics.flatMap((topic) =>
        topic.kinds.filter((kind) => kind.emitted).map((kind) => `${topic.name}/${kind.name}`),
      ),
    );
    expect(declared.size).toBe(12);
    expect([...emitted].sort()).toEqual([...declared].sort());
    // `remove` is declared and has no v1 producer, so it is never emitted.
    expect(events.some((event) => event.kind === "remove")).toBe(false);
  });

  test("each of the thirteen declared kinds matches the contract field list exactly", () => {
    const byKind = eventsByKind(projectCaseEvents());
    const covered: string[] = [];
    for (const topic of TAXONOMY.topics) {
      const contractKinds = CONTRACT_KINDS[topic.name as keyof typeof CONTRACT_KINDS];
      if (contractKinds !== undefined) {
        expect(topic.kinds.map((kind) => kind.name)).toEqual([...contractKinds]);
      }
      for (const kind of topic.kinds) {
        covered.push(`${topic.name}/${kind.name}`);
        const contract = CONTRACT_PAYLOAD_FIELDS[topic.name]?.[kind.name] as
          | readonly string[]
          | undefined;
        // The declaration and the contract fixture agree field-for-field, in order.
        expect(kind.payloadFields, `${topic.name}/${kind.name}`).toEqual(contract as string[]);
        // Only `queue.graph.remove` is declared without a v1 producer.
        expect(kind.emitted, `${topic.name}/${kind.name}`).toBe(kind.name !== "remove");

        const frame = byKind.get(`${topic.name}/${kind.name}`);
        if (!kind.emitted) {
          expect(frame).toBeUndefined();
          continue;
        }
        expect(frame, `${topic.name}/${kind.name}`).toBeDefined();
        if (frame === undefined || contract === undefined) continue;

        const emittedKeys = Object.keys(frame.payload);
        // No undeclared key may be emitted.
        for (const key of emittedKeys) {
          expect(contract.map(payloadKey), `${topic.name}/${kind.name}:${key}`).toContain(key);
        }
        // Every declared required key must be emitted; optional keys may be absent.
        for (const field of requiredFields(contract)) {
          expect(emittedKeys, `${topic.name}/${kind.name}:${field}`).toContain(field);
        }
      }
    }
    expect(covered).toHaveLength(13);
  });

  test("the real projected frames satisfy the declaration, payload keys included", () => {
    expect(compareFrames(TAXONOMY, realFrames())).toEqual([]);
    expect(scriptedFrames(TAXONOMY).length).toBe(12);
    expect(projectionCaseRecords().length).toBeGreaterThanOrEqual(10);
  });
});
