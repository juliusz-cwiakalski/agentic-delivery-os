/**
 * TC-EVT-002 (page half), TC-EVT-027 (surface half), and TC-EVT-032 (page half)
 * — the M2 reference page carries the v1 taxonomy and confines the extension
 * prose to one named section.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TAXONOMY } from "../../packages/core/src/contracts/taxonomy";
import { createSurfaceHarness } from "../fixtures/events/surface-harness";
import { S17_KIND_NAMES } from "../fixtures/events/taxonomy-cases";

const ROOT = process.cwd();
const PAGE = "doc/planning/oss-tooling/milestones/m2/commands/events.md";
const V1_SECTIONS = [
  "DESCRIPTION",
  "OPTIONS",
  "OUTPUT",
  "EXIT STATUS",
  "EXAMPLES",
  "ERRORS",
  "SEE ALSO",
] as const;
const EXTENSION = "EXTENSION PATH (S17 — not v1)";

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

const v1Range = (text: string): string => {
  const headings = [...V1_SECTIONS, EXTENSION];
  const parts: string[] = [];
  for (const name of V1_SECTIONS) {
    const part = sectionOf(text, name, headings);
    if (part !== undefined) parts.push(part);
  }
  return parts.join("\n");
};

describe("TC-EVT-002 the page carries the v1 taxonomy", () => {
  test("every v1 section resolves to a non-empty span", () => {
    const text = page();
    for (const name of V1_SECTIONS) {
      const span = sectionOf(text, name, [...V1_SECTIONS, EXTENSION, "HELP"]);
      expect(span, name).toBeDefined();
      expect((span ?? "").trim().length, name).toBeGreaterThan(0);
    }
  });

  test("no S17 shape name appears in the v1 sections and the counts do", () => {
    const v1 = v1Range(page());
    for (const forbidden of S17_KIND_NAMES) {
      const hits = [...v1.matchAll(new RegExp(`\\b${forbidden}\\b`, "gu"))];
      expect(hits, `${forbidden} appears in a v1 section`).toHaveLength(0);
    }
    expect(v1).toContain("0/0/4/3/3/3");
  });

  test("the extension section is present, non-empty, placed after ERRORS and before SEE ALSO, and is the only place the names occur", () => {
    const text = page();
    const extensionIndex = text.indexOf(`## ${EXTENSION}`);
    const errorsIndex = text.indexOf("## ERRORS");
    const seeAlsoIndex = text.indexOf("## SEE ALSO");
    expect(extensionIndex).toBeGreaterThan(errorsIndex);
    expect(extensionIndex).toBeLessThan(seeAlsoIndex);
    const extension = sectionOf(text, EXTENSION, ["HELP", "SEE ALSO"]);
    expect((extension ?? "").trim().length).toBeGreaterThan(0);
    for (const forbidden of S17_KIND_NAMES) expect(extension ?? "").toContain(forbidden);

    const outside =
      text.slice(0, extensionIndex) + text.slice(extensionIndex + (extension ?? "").length);
    for (const forbidden of S17_KIND_NAMES) {
      expect([...outside.matchAll(new RegExp(`\\b${forbidden}\\b`, "gu"))]).toHaveLength(0);
    }
  });

  test("the page documents the restart discontinuity and the repoll remedy", () => {
    const text = page();
    expect(text).toContain("restart");
    expect(text).toContain("repoll");
    expect(text).toContain("gap");
  });
});

describe("TC-EVT-027 the surface reports the declared emission gap", () => {
  test("queue.graph.remove is emitted:false in both text and --json", async () => {
    const json = await createSurfaceHarness().run(["events", "describe", "queue.graph", "--json"]);
    const remove = json.data?.topics[0]?.kinds.find((kind) => kind.name === "remove");
    expect(remove).toEqual({
      name: "remove",
      emitted: false,
      payloadFields: ["ref", "reason", "recordedAt"],
    });
    const text = await createSurfaceHarness().run(["events", "describe", "queue.graph"]);
    expect(text.stdout).toContain("remove");
    expect(text.stdout).toContain("not emitted (declared; no v1 producer)");
  });

  test("no declared kind is missing and no extra kind is present", async () => {
    const list = await createSurfaceHarness().run(["events", "list", "--json"]);
    for (const topic of TAXONOMY.topics) {
      const record = list.data?.topics.find((candidate) => candidate.name === topic.name);
      expect(record?.kinds.map((kind) => kind.name)).toEqual(topic.kinds.map((kind) => kind.name));
    }
  });
});
