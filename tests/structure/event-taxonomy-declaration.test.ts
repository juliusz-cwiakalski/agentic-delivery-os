/**
 * TC-EVT-001 and the declaration half of TC-EVT-002 — the closed six-topic set,
 * the per-topic required keys, the exact kind enumeration under v2, and the
 * four peak-pause kinds' declared placement (GH-294 TDR-0029 D2).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { CONTROL_TOPICS } from "../../packages/core/src/contracts/control";
import {
  EVENT_ENVELOPE_FIELDS,
  ORDERING_VALUES,
  OVERFLOW_VALUES,
  SNAPSHOT_FRAME_FIELDS,
  TAXONOMY,
  TAXONOMY_LANE_RULES,
  TAXONOMY_SHAPES,
  TAXONOMY_VERSION,
} from "../../packages/core/src/contracts/taxonomy";
import {
  CONTRACT_KINDS,
  CONTRACT_PAYLOAD_FIELDS,
  S17_KIND_NAMES,
  TOPIC_NAMES,
} from "../fixtures/events/taxonomy-cases";

const ROOT = process.cwd();
const MODULE = "packages/core/src/contracts/taxonomy.ts";

const topics = TAXONOMY.topics;
const byName = (name: string) => topics.find((topic) => topic.name === name);

describe("TC-EVT-001 the declared topic set", () => {
  test("is exactly the six declared topics, in declared order, with status absent", () => {
    expect(topics.map((topic) => topic.name)).toEqual([...TOPIC_NAMES]);
    expect(topics).toHaveLength(6);
    expect(topics.some((topic) => topic.name === "status")).toBe(false);
    expect(TAXONOMY.version).toBe("v2");
    expect(topics.every((topic) => topic.version === "v2")).toBe(true);
  });

  test("queue.graph is the only topic with a parent, and its parent is queue", () => {
    const parents = topics.filter((topic) => topic.parent !== undefined);
    expect(parents.map((topic) => topic.name)).toEqual(["queue.graph"]);
    expect(byName("queue.graph")?.parent).toBe("queue");
  });

  test("every topic declares shape, frame, lane, ordering, overflow, and kinds", () => {
    for (const topic of topics) {
      expect(TAXONOMY_SHAPES).toContain(topic.shape);
      expect(topic.frame.length).toBeGreaterThan(0);
      expect(TAXONOMY_LANE_RULES).toContain(topic.lane);
      expect(ORDERING_VALUES).toContain(topic.ordering);
      expect(OVERFLOW_VALUES).toContain(topic.overflow);
      expect(Array.isArray(topic.kinds)).toBe(true);
      for (const kind of topic.kinds) {
        expect(typeof kind.name).toBe("string");
        expect(kind.name.length).toBeGreaterThan(0);
        expect(typeof kind.emitted).toBe("boolean");
        expect(Array.isArray(kind.payloadFields)).toBe(true);
      }
      if (topic.shape === "snapshot") {
        expect(topic.kinds).toEqual([]);
        expect(topic.payloadFields).toEqual([]);
        expect([...topic.frame]).toEqual([...SNAPSHOT_FRAME_FIELDS]);
      } else {
        expect(topic.kinds.length).toBeGreaterThan(0);
        expect([...topic.frame]).toEqual([...EVENT_ENVELOPE_FIELDS]);
      }
    }
  });

  test("the served control topic union equals the declared topic names", () => {
    expect([...CONTROL_TOPICS]).toEqual(topics.map((topic) => topic.name));
    const unique = new Set(CONTROL_TOPICS);
    expect(unique.size).toBe(CONTROL_TOPICS.length);
  });

  test("the declaration module is data plus one pure validator (no ambient or module-scope call)", () => {
    const text = readFileSync(join(ROOT, MODULE), "utf8");
    const source = ts.createSourceFile(MODULE, text, ts.ScriptTarget.Latest, true);
    const problems: string[] = [];
    const visit = (node: ts.Node, insideFunction: boolean): void => {
      if (ts.isImportDeclaration(node)) {
        const specifier = node.moduleSpecifier.getText(source);
        if (!specifier.includes("./control.js")) problems.push(`import ${specifier}`);
      }
      if (!insideFunction && ts.isCallExpression(node)) {
        problems.push(
          `module-scope call at line ${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`,
        );
      }
      if (!insideFunction && ts.isNewExpression(node)) {
        problems.push(
          `module-scope new at line ${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`,
        );
      }
      if (ts.isIdentifier(node) && ["process", "Bun", "Deno", "fetch"].includes(node.text)) {
        problems.push(`ambient global ${node.text}`);
      }
      const nextInside =
        insideFunction ||
        ts.isFunctionDeclaration(node) ||
        ts.isArrowFunction(node) ||
        ts.isFunctionExpression(node);
      ts.forEachChild(node, (child) => visit(child, nextInside));
    };
    visit(source, false);
    expect(problems).toEqual([]);
  });
});

describe("TC-EVT-002 the declared kind enumeration", () => {
  test("each event topic's kind set equals the contract enumeration, in order", () => {
    for (const [topic, kinds] of Object.entries(CONTRACT_KINDS)) {
      expect(
        byName(topic)?.kinds.map((kind) => kind.name),
        topic,
      ).toEqual([...kinds]);
    }
    expect(byName("queue")?.kinds).toEqual([]);
    expect(byName("lanes")?.kinds).toEqual([]);
    expect(byName("queue")?.payloadFields).toEqual([]);
    expect(byName("lanes")?.payloadFields).toEqual([]);
  });

  test("kind counts are exactly 5/6/3/3 and the peak-pause additions ride their declared topics", () => {
    const counts = (
      ["queue.graph", "dispatch.attempt", "phase.state", "blockers.state"] as const
    ).map((topic) => byName(topic)?.kinds.length);
    expect(counts).toEqual([5, 6, 3, 3]);
    for (const topic of topics) expect(topic.kinds.length).toBeLessThanOrEqual(6);
  });

  test("the four S17 kinds are declared under v2 on their contracted topics, in declared order", () => {
    expect(
      byName("dispatch.attempt")
        ?.kinds.map((kind) => kind.name)
        .slice(3),
    ).toEqual(["stop", "parked", "resumed"]);
    expect(
      byName("queue.graph")
        ?.kinds.map((kind) => kind.name)
        .at(-1),
    ).toBe("park-edge");
  });

  test("every declared v1 kind keeps its declared payload list byte-identical under v2", () => {
    for (const [topic, kinds] of Object.entries(CONTRACT_PAYLOAD_FIELDS)) {
      for (const [name, fields] of Object.entries(kinds)) {
        if (S17_KIND_NAMES.includes(name as never)) continue;
        const declared = byName(topic)?.kinds.find((kind) => kind.name === name);
        expect(declared?.payloadFields, `${topic}/${name}`).toEqual([...fields]);
      }
    }
  });

  test("v2 declares no non-emitted kind", () => {
    const notEmitted = topics.flatMap((topic) =>
      topic.kinds.filter((kind) => !kind.emitted).map((kind) => `${topic.name}/${kind.name}`),
    );
    expect(notEmitted).toEqual([]);
    expect(TAXONOMY_VERSION).toBe("v2");
  });
});
