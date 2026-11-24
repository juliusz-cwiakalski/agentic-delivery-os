/**
 * GH-406 TC-DPKVOC-001/002 — the delivery vocabulary is present where the
 * owner placed it, and the two reversed sentences are gone.
 *
 * Presence plus lifetime, never verbatim prose equality: each of the eight
 * terms is a defined row in BOTH overview documents carrying the spec's
 * lifetime classification; the glossary retains the distinct Repository key
 * concept (NG-7); the forbidden claim substrings are absent from the
 * overview; both feature specs link the table and make no
 * repository-is-one-checkout claim.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const UL = "doc/overview/ubiquitous-language.md";
const GLOSSARY = "doc/overview/glossary.md";
const PROJECTS_SPEC = "doc/spec/features/feature-projects.md";
const GROUPS_SPEC = "doc/spec/features/feature-project-groups.md";

const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

/** Term -> the lifetime classification the spec declares for it. */
const VOCABULARY: ReadonlyArray<readonly [string, string]> = [
  ["Project", "durable"],
  ["Project repository", "durable"],
  ["Main checkout", "per worker"],
  ["Worktree", "temporary"],
  ["Lane", "temporary"],
  ["Work item", "durable"],
  ["Clone identity", "per clone"],
  ["Declared project key", "durable"],
];

/** A table row whose first cell is the term, with the lifetime in the row. */
const vocabularyRow = (text: string, term: string): string | undefined =>
  text
    .split("\n")
    .find(
      (line) =>
        line.startsWith(`| ${term} |`) ||
        line.startsWith(`| ${term.toLowerCase()} |`) ||
        line.startsWith(`| **${term}**`),
    );

describe("TC-DPKVOC-001 the vocabulary table is present in both overview documents", () => {
  const ul = read(UL);
  const glossary = read(GLOSSARY);

  test("the ubiquitous language declares the delivery vocabulary section", () => {
    expect(ul).toContain("## The delivery vocabulary");
  });

  test.each(VOCABULARY.map((entry) => [entry[0], entry[1]] as const))(
    "%s is defined with its %s lifetime in both documents",
    (term, lifetime) => {
      const ulRow = vocabularyRow(ul, term);
      expect(ulRow, `${term} row in ${UL}`).toBeDefined();
      expect(ulRow?.toLowerCase(), `${term} lifetime in ${UL}`).toContain(lifetime);

      const glossaryRow = vocabularyRow(glossary, term);
      expect(glossaryRow, `${term} row in ${GLOSSARY}`).toBeDefined();
      expect(glossaryRow?.toLowerCase(), `${term} lifetime in ${GLOSSARY}`).toContain(lifetime);
    },
  );

  test("the glossary retains the distinct Repository key concept (NG-7)", () => {
    const row = glossary.split("\n").find((line) => line.startsWith("| Repository key |"));
    expect(row).toBeDefined();
    expect(row?.toLowerCase()).toContain("host/owner/name");
  });
});

describe("TC-DPKVOC-002 the reversed sentences are corrected and the specs link the table", () => {
  const ul = read(UL);
  const projects = read(PROJECTS_SPEC);
  const groups = read(GROUPS_SPEC);

  test("no overview sentence claims a repository is one checkout or the delivery unit", () => {
    expect(ul.toLowerCase()).not.toContain("one checkout");
    expect(ul).not.toContain("the delivery unit; a project group");
  });

  test("no overview sentence keeps a repository meaning for the project key", () => {
    expect(ul).not.toContain("keeps its repository meaning");
  });

  test("both feature specs link the vocabulary table", () => {
    const link = "ubiquitous-language.md#the-delivery-vocabulary";
    expect(projects).toContain(link);
    expect(groups).toContain(link);
  });

  test("neither feature spec states that a repository is one checkout", () => {
    for (const [name, text] of [
      [PROJECTS_SPEC, projects],
      [GROUPS_SPEC, groups],
    ] as const) {
      expect(text.toLowerCase(), name).not.toContain("one checkout");
    }
  });

  test("the projects spec names the marker the clone identity, never the project key", () => {
    expect(projects).toContain("## Clone identity and the delivered names");
    expect(projects).not.toContain("## Checkout identity and the project key");
    expect(projects).not.toContain("checkout identity marker");
    expect(projects).toContain("clone identity marker");
  });
});
