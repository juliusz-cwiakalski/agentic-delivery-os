/**
 * TC-EVT-002 (page half), TC-EVT-027 (surface half), and TC-EVT-032 (page half)
 * — the M2 reference page carries the v2 taxonomy (GH-294 TDR-0029 D2/D6/D7)
 * and confines the compatibility statement to one named section.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TAXONOMY } from "../../packages/core/src/contracts/taxonomy";
import { createSurfaceHarness } from "../fixtures/events/surface-harness";
import { S17_KIND_NAMES } from "../fixtures/events/taxonomy-cases";

const ROOT = process.cwd();
const PAGE = "doc/planning/oss-tooling/milestones/m2/commands/events.md";
const V2_SECTIONS = [
  "DESCRIPTION",
  "OPTIONS",
  "OUTPUT",
  "EXIT STATUS",
  "EXAMPLES",
  "ERRORS",
  "SEE ALSO",
] as const;
const COMPATIBILITY = "V1-CONSUMER COMPATIBILITY (v2)";

const page = (): string => readFileSync(join(ROOT, PAGE), "utf8");

/** Slice one `## <name>` section out of the page, by exact heading. */
const sectionOf = (
  text: string,
  name: string,
  nextNames: readonly string[],
): string | undefined => {
  const heading = `## ${name}`;
  const start = text.indexOf(`${heading}\n`);
  if (start < 0) return undefined;
  const rest = text.slice(start + heading.length);
  const ends = nextNames.map((next) => rest.indexOf(`\n## ${next}`)).filter((index) => index >= 0);
  const end = ends.length === 0 ? rest.length : Math.min(...ends);
  return rest.slice(0, end);
};

const v2Range = (text: string): string => {
  const headings = [...V2_SECTIONS, COMPATIBILITY];
  const parts: string[] = [];
  for (const name of V2_SECTIONS) {
    const part = sectionOf(text, name, headings);
    if (part !== undefined) parts.push(part);
  }
  return parts.join("\n");
};

describe("TC-EVT-002 the page carries the v2 taxonomy", () => {
  test("every v2 section resolves to a non-empty span", () => {
    const text = page();
    for (const name of V2_SECTIONS) {
      const span = sectionOf(text, name, [...V2_SECTIONS, COMPATIBILITY, "HELP"]);
      expect(span, name).toBeDefined();
      expect((span ?? "").trim().length, name).toBeGreaterThan(0);
    }
  });

  test("the DESCRIPTION kind table names exactly the declared kinds, per topic and in order", () => {
    const description = sectionOf(page(), "DESCRIPTION", [...V2_SECTIONS, COMPATIBILITY]) ?? "";
    // The table rows: `| \`topic\` | shape | parent | kinds |`.
    const rows = description
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("| `"))
      .map((line) =>
        line
          .slice(1, -1)
          .split("|")
          .map((cell) => cell.trim()),
      );
    expect(rows).toHaveLength(TAXONOMY.topics.length);

    const rendered = new Map(
      rows.map((cells) => {
        const topic = (cells[0] ?? "").replaceAll("`", "");
        const shape = cells[1] ?? "";
        const parent = (cells[2] ?? "").replaceAll("`", "");
        const kindCell = cells[3] ?? "";
        const kinds = [...kindCell.matchAll(/`([^`]+)`/gu)].map((match) => match[1] as string);
        return [topic, { shape, parent, kinds }];
      }),
    );

    for (const topic of TAXONOMY.topics) {
      const row = rendered.get(topic.name);
      expect(row, `the page renders no row for ${topic.name}`).toBeDefined();
      if (row === undefined) continue;
      // Shape and parent.
      expect(row.shape, topic.name).toBe(topic.shape);
      expect(row.parent === "-" ? undefined : row.parent, topic.name).toBe(topic.parent);
      // The kind set and its declared order: a renamed kind with the same counts
      // fails here, which the `0/0/5/6/3/3` counts string alone cannot catch.
      expect(row.kinds, topic.name).toEqual(topic.kinds.map((kind) => kind.name));
    }
  });

  test("the page names the served version v2 everywhere and the retired version only as history", () => {
    const text = page();
    expect(text).toContain('`taxonomyVersion: "v2"`');
    expect(text).toContain("`version` | `v2`");
    expect(text).toContain('"taxonomyVersion": "v2"');
    // v1 appears only as the retired version's historical naming.
    expect(text).toContain("v1 is\nretired, not served concurrently");
  });

  test("the counts line carries the v2 enumeration 0/0/5/6/3/3", () => {
    const v2 = v2Range(page());
    expect(v2).toContain("0/0/5/6/3/3");
  });

  test("the compatibility section is present, non-empty, placed after ERRORS and before SEE ALSO, and carries the six-point statement and the four kind names", () => {
    const text = page();
    const compatibilityIndex = text.indexOf(`## ${COMPATIBILITY}`);
    const errorsIndex = text.indexOf("## ERRORS");
    const seeAlsoIndex = text.indexOf("## SEE ALSO");
    expect(compatibilityIndex).toBeGreaterThan(errorsIndex);
    expect(compatibilityIndex).toBeLessThan(seeAlsoIndex);
    const compatibility = sectionOf(text, COMPATIBILITY, ["HELP", "SEE ALSO"]);
    expect((compatibility ?? "").trim().length).toBeGreaterThan(0);
    for (const kind of S17_KIND_NAMES) expect(compatibility ?? "").toContain(kind);
    // The six points, by their declared names.
    for (const point of [
      "Frames keep their shape",
      "Nothing a v1 consumer listens for changed",
      "decodable and ignorable",
      "version-drift signal, not an error",
      "Ordering and overflow semantics are untouched",
      "remedies do not multiply",
    ]) {
      expect(compatibility ?? "").toContain(point);
    }
  });

  test("the peak-pause payload semantics render on the page: grace deadline, preservation, classified absence", () => {
    const text = page();
    expect(text).toContain("bounded-grace deadline");
    expect(text).toContain("preserved | session-state-not-preserved");
    expect(text).toContain("classified absence");
    expect(text).toContain("reDispatched: false");
  });

  test("the page documents the restart discontinuity and the repoll remedy", () => {
    const text = page();
    expect(text).toContain("restart");
    expect(text).toContain("repoll");
    expect(text).toContain("gap");
  });
});

describe("TC-EVT-027 the surface reports the declared emission gap", () => {
  test("queue.graph.remove is emitted:true in both text and --json", async () => {
    const json = await createSurfaceHarness().run(["events", "describe", "queue.graph", "--json"]);
    const remove = json.data?.topics[0]?.kinds.find((kind) => kind.name === "remove");
    expect(remove).toEqual({
      name: "remove",
      emitted: true,
      payloadFields: ["ref", "reason", "recordedAt"],
    });
    const text = await createSurfaceHarness().run(["events", "describe", "queue.graph"]);
    expect(text.stdout).toContain("remove");
    expect(text.stdout).not.toContain("not emitted (declared; no v1 producer)");
  });

  test("no declared kind is missing and no extra kind is present", async () => {
    const list = await createSurfaceHarness().run(["events", "list", "--json"]);
    for (const topic of TAXONOMY.topics) {
      const record = list.data?.topics.find((candidate) => candidate.name === topic.name);
      expect(record?.kinds.map((kind) => kind.name)).toEqual(topic.kinds.map((kind) => kind.name));
    }
  });
});
