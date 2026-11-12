/**
 * TC-EVT-006 and the union half of TC-EVT-016 — one authored declaration drives
 * both the surface record and the emitted frame, and no second kind list exists
 * in the production tree.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { TAXONOMY, type TaxonomyDeclaration } from "../../packages/core/src/contracts/taxonomy";
import {
  compareFrames,
  compareSurface,
  scriptedFrames,
  scriptedRecords,
} from "../fixtures/events/drift-mutants";
import { createSurfaceHarness } from "../fixtures/events/surface-harness";

const ROOT = process.cwd();

const additiveCopy = (): TaxonomyDeclaration => {
  const copy = JSON.parse(JSON.stringify(TAXONOMY)) as {
    topics: { name: string; kinds: { name: string; payloadFields: string[] }[] }[];
  };
  const graph = copy.topics.find((topic) => topic.name === "queue.graph");
  const entry = graph?.kinds.find((kind) => kind.name === "entry");
  entry?.payloadFields.push("futureField");
  // A legal additive field inside v1 still moves the derived union; it lands at
  // the same first-seen position the derivation would give it.
  const topic = graph as { payloadFields: string[] };
  const position = topic.payloadFields.indexOf("recordedAt");
  topic.payloadFields.splice(position + 1, 0, "futureField");
  return copy as unknown as TaxonomyDeclaration;
};

describe("TC-EVT-006 one declaration, two consumers", () => {
  test("an additive payload field moves the surface and the frame without a second edit", async () => {
    const copy = additiveCopy();
    const surface = await createSurfaceHarness({ taxonomy: copy }).run([
      "events",
      "describe",
      "queue.graph",
      "--json",
    ]);
    const entry = surface.data?.topics[0]?.kinds.find((kind) => kind.name === "entry");
    expect(entry?.payloadFields).toContain("futureField");
    expect(surface.data?.topics[0]?.payloadFields).toContain("futureField");

    const frames = scriptedFrames(copy).filter((frame) => frame.data.kind === "entry");
    expect(frames).toHaveLength(1);
    // The scripted frame builder is declaration-driven, so its payload reflects
    // the copy; the comparison against the shipped declaration then names it.
    const violations = compareFrames(TAXONOMY, frames);
    expect(violations.some((violation) => violation.detail.includes("futureField"))).toBe(true);

    const shipped = await createSurfaceHarness().run([
      "events",
      "describe",
      "queue.graph",
      "--json",
    ]);
    expect(
      shipped.data?.topics[0]?.kinds.find((kind) => kind.name === "entry")?.payloadFields,
    ).not.toContain("futureField");
  });

  test("the surface kinds are element-wise and order-wise the declaration's kinds", async () => {
    const run = await createSurfaceHarness().run(["events", "list", "--json"]);
    for (const topic of TAXONOMY.topics) {
      const record = run.data?.topics.find((candidate) => candidate.name === topic.name);
      expect(record?.kinds).toEqual(
        topic.kinds.map((kind) => ({
          name: kind.name,
          emitted: kind.emitted,
          payloadFields: [...kind.payloadFields],
        })),
      );
    }
    expect(compareSurface(TAXONOMY, scriptedRecords(TAXONOMY))).toEqual([]);
  });

  test("a version mutation propagates to the surface and to every frame together", () => {
    const copy = JSON.parse(JSON.stringify(TAXONOMY)) as {
      version: string;
      topics: { version: string }[];
    };
    copy.version = "v1-experiment";
    for (const topic of copy.topics) topic.version = "v1-experiment";
    const frames = scriptedFrames(copy as unknown as TaxonomyDeclaration);
    expect(frames.every((frame) => frame.data.taxonomyVersion === "v1-experiment")).toBe(true);
    const violations = compareSurface(
      TAXONOMY,
      scriptedRecords(copy as unknown as TaxonomyDeclaration),
    );
    expect(violations.some((violation) => violation.field === "version")).toBe(true);
  });

  test("no production module outside the declaration carries a literal kind list", () => {
    const declaredNames = new Set(
      TAXONOMY.topics.flatMap((topic) => topic.kinds.map((kind) => kind.name as string)),
    );
    const files: string[] = [];
    const walk = (relative: string): void => {
      for (const entry of readdirSync(join(ROOT, relative), { withFileTypes: true })) {
        const next = `${relative}/${entry.name}`;
        if (entry.isDirectory()) {
          if (entry.name === "dist" || entry.name === "node_modules") continue;
          walk(next);
        } else if (entry.name.endsWith(".ts")) {
          files.push(next);
        }
      }
    };
    for (const packageName of ["core", "adapters", "cli", "mcp", "opencode"]) {
      walk(`packages/${packageName}/src`);
    }
    const offenders: string[] = [];
    for (const file of files) {
      if (file.endsWith("contracts/taxonomy.ts")) continue;
      const text = readFileSync(join(ROOT, file), "utf8");
      for (const match of text.matchAll(/\[[^\]]*\]/gu)) {
        const names = [...matchedKindNames(match[0], declaredNames)];
        if (names.length >= 3) offenders.push(`${file}: ${names.join(",")}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

function* matchedKindNames(snippet: string, declared: ReadonlySet<string>): Generator<string> {
  for (const name of declared) {
    if (new RegExp(`["']${name}["']`, "u").test(snippet)) yield name;
  }
}
