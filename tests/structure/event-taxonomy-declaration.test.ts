/**
 * TC-EVT-001 and the declaration half of TC-EVT-002 — the closed six-topic set,
 * the per-topic required keys, the exact kind enumeration, and the absence of
 * every S17 shape.
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
import { CONTRACT_KINDS, S17_KIND_NAMES, TOPIC_NAMES } from "../fixtures/events/taxonomy-cases";

const ROOT = process.cwd();
const MODULE = "packages/core/src/contracts/taxonomy.ts";

const topics = TAXONOMY.topics;
const byName = (name: string) => topics.find((topic) => topic.name === name);

describe("TC-EVT-001 the declared topic set", () => {
  test("is exactly the six declared topics, in declared order, with status absent", () => {
    expect(topics.map((topic) => topic.name)).toEqual([...TOPIC_NAMES]);
    expect(topics).toHaveLength(6);
    expect(topics.some((topic) => topic.name === "status")).toBe(false);
    expect(TAXONOMY.version).toBe("v1");
    expect(topics.every((topic) => topic.version === "v1")).toBe(true);
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

  test("kind counts are exactly 4/3/3/3 and no topic declares more than four", () => {
    const counts = (
      ["queue.graph", "dispatch.attempt", "phase.state", "blockers.state"] as const
    ).map((topic) => byName(topic)?.kinds.length);
    expect(counts).toEqual([4, 3, 3, 3]);
    for (const topic of topics) expect(topic.kinds.length).toBeLessThanOrEqual(4);
  });

  test("no S17 kind name is declared as a kind or a payload field", () => {
    const tokens = new Set<string>();
    for (const topic of topics) {
      for (const kind of topic.kinds) {
        tokens.add(kind.name);
        for (const field of kind.payloadFields) tokens.add(field.replace(/[?[\]]/gu, ""));
      }
    }
    for (const forbidden of S17_KIND_NAMES) {
      expect(tokens.has(forbidden), `S17 shape ${forbidden} declared`).toBe(false);
    }
  });

  test("v1 declares exactly one non-emitted kind: queue.graph.remove", () => {
    const notEmitted = topics.flatMap((topic) =>
      topic.kinds.filter((kind) => !kind.emitted).map((kind) => `${topic.name}/${kind.name}`),
    );
    expect(notEmitted).toEqual(["queue.graph/remove"]);
    expect(TAXONOMY_VERSION).toBe("v1");
  });
});
