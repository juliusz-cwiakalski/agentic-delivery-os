/**
 * TC-EVT-010, TC-EVT-011, and the machine half of TC-EVT-080 — the reference
 * table grammar, its golden bytes, and the machine envelope equality.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EVENT_ENVELOPE_FIELDS, TAXONOMY } from "../../packages/core/src/contracts/taxonomy";
import { createSurfaceHarness } from "../fixtures/events/surface-harness";

const ROOT = process.cwd();
const GOLDEN = join(ROOT, "tests/fixtures/events/goldens/events-list.txt");

/** Strip the committed generation header; the body is the stdout contract. */
const goldenBody = (text: string): string => {
  const marker = "--- output ---\n";
  const index = text.indexOf(marker);
  return index < 0 ? text : text.slice(index + marker.length);
};

const probe = createSurfaceHarness();

describe("TC-EVT-010 events list text", () => {
  test("renders the committed golden byte-for-byte", async () => {
    const run = await probe.run(["events", "list"]);
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toBe(goldenBody(readFileSync(GOLDEN, "utf8")));
    expect(readFileSync(GOLDEN, "utf8")).toContain("pnpm exec bun run the events renderer");
  });

  test("each row matches the declared grammar with parent only on queue.graph", async () => {
    const run = await probe.run(["events", "list"]);
    const lines = run.stdout.trimEnd().split("\n");
    expect(lines).toHaveLength(6);
    const snapshot =
      /^\S+\s+v1\s+shape=snapshot\s+kinds=0\s+ordered by snapshot revision\s+overflow=repoll$/u;
    const event =
      /^\S+\s+v1\s+shape=event\s+kinds=(4|3)\s+(parent=queue\s+)?ordered per lane\s+overflow=repoll$/u;
    for (const line of lines.slice(0, 2)) expect(line).toMatch(snapshot);
    for (const line of lines.slice(2)) expect(line).toMatch(event);
    expect(lines.filter((line) => line.includes("parent="))).toHaveLength(1);
    expect(lines[2]).toContain("parent=queue");
  });

  test("row order equals the declaration order and status appears nowhere", async () => {
    const run = await probe.run(["events", "list"]);
    const names = run.stdout
      .trimEnd()
      .split("\n")
      .map((line) => line.split(/\s+/u)[0] as string);
    expect(names).toEqual(TAXONOMY.topics.map((topic) => topic.name));
    expect(run.stdout).not.toContain("status");
  });

  test("stays inside the human page bounds with no ANSI escape", async () => {
    const run = await probe.run(["events", "list"]);
    expect(run.stdout).not.toContain("\u001b[");
    expect(run.stdout.trimEnd().split("\n").length).toBeLessThanOrEqual(40);
    expect(new TextEncoder().encode(run.stdout).length).toBeLessThanOrEqual(8_192);
  });
});

describe("TC-EVT-011 events list --json", () => {
  const expectedRecord = (topic: (typeof TAXONOMY.topics)[number]) => ({
    name: topic.name,
    version: topic.version,
    shape: topic.shape,
    ...(topic.parent === undefined ? {} : { parent: topic.parent }),
    frame: [...topic.frame],
    lane: topic.lane,
    kinds: topic.kinds.map((kind) => ({
      name: kind.name,
      emitted: kind.emitted,
      payloadFields: [...kind.payloadFields],
    })),
    payloadFields: (() => {
      const seen = new Set<string>();
      const fields: string[] = [];
      for (const kind of topic.kinds) {
        for (const field of kind.payloadFields) {
          if (seen.has(field)) continue;
          seen.add(field);
          fields.push(field);
        }
      }
      return fields;
    })(),
    ordering: topic.ordering,
    overflow: topic.overflow,
  });

  test("carries the command, the version, the ordered envelope, and six records", async () => {
    const run = await probe.run(["events", "list", "--json"]);
    expect(run.exitCode).toBe(0);
    const data = run.data;
    expect(data?.command).toBe("events list");
    expect(data?.taxonomyVersion).toBe("v1");
    expect(data?.envelope).toEqual([...EVENT_ENVELOPE_FIELDS]);
    expect(data?.topics).toHaveLength(6);
    expect(data?.topics).toEqual(TAXONOMY.topics.map(expectedRecord));
    expect(run.envelope).not.toHaveProperty("error");
    expect(run.envelope?.exitCode).toBe(0);
  });

  test("each record key set is exact and the frame list matches the shape", async () => {
    const run = await probe.run(["events", "list", "--json"]);
    for (const topic of run.data?.topics ?? []) {
      const keys = Object.keys(topic).sort();
      expect(keys).toEqual(
        [
          "frame",
          "kinds",
          "lane",
          "name",
          "ordering",
          "overflow",
          "payloadFields",
          "shape",
          "version",
          ...(topic.name === "queue.graph" ? ["parent"] : []),
        ].sort(),
      );
      expect(topic.frame).toEqual(
        topic.shape === "snapshot" ? ["topic", "cursor", "snapshot"] : [...EVENT_ENVELOPE_FIELDS],
      );
    }
  });

  test("the machine envelope respects its own bounds (compact scripted, pretty ceiling)", async () => {
    const compact = await createSurfaceHarness({ mode: "scripted" }).run([
      "events",
      "list",
      "--json",
    ]);
    expect(new TextEncoder().encode(compact.stdout).length).toBeLessThanOrEqual(8_192);
    const pretty = await probe.run(["events", "list", "--json", "--pretty"]);
    expect(new TextEncoder().encode(pretty.stdout).length).toBeLessThanOrEqual(65_536);
  });
});
