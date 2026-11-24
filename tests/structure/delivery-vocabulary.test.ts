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

/** Term -> the lifetime classification the spec declares for it (amended). */
const VOCABULARY: ReadonlyArray<readonly [string, string]> = [
  ["Product", "durable"],
  ["Repository", "durable"],
  ["Main checkout", "per worker"],
  ["Worktree", "temporary"],
  ["Lane", "temporary"],
  ["Work item", "durable"],
  ["Clone identity", "per clone"],
  ["Product key", "durable"],
];

/** Whitespace-flattened copy so wrap-tolerant phrase assertions hold. */
const flat = (text: string): string => text.replace(/\s+/gu, " ").trim();

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
  const glossary = read(GLOSSARY);
  const projects = read(PROJECTS_SPEC);
  const groups = read(GROUPS_SPEC);
  const both: ReadonlyArray<readonly [string, string]> = [
    [UL, ul],
    [GLOSSARY, glossary],
  ];

  test("no overview sentence claims a repository is one checkout or the delivery unit", () => {
    expect(ul.toLowerCase()).not.toContain("one checkout");
    expect(ul).not.toContain("the delivery unit; a project group");
  });

  test("no overview sentence keeps a repository meaning for the project key", () => {
    expect(ul).not.toContain("keeps its repository meaning");
  });

  test("the retirement clause is recorded in both documents (TC-DPKVOC-002)", () => {
    for (const [name, text] of both) {
      expect(flat(text), name).toContain("retired from the model's own vocabulary");
      expect(flat(text), name).toContain("Jira project");
    }
  });

  test("both prose rules are recorded in both documents: the tool, neutral examples", () => {
    for (const [name, text] of both) {
      expect(flat(text), name).toContain('it says "the tool"');
      expect(flat(text), name).toContain("`acme`");
      expect(flat(text), name).toContain("`example.com`");
    }
  });

  test("the pre-amendment vocabulary rows are gone from both tables", () => {
    for (const [name, text] of both) {
      const rows = text.split("\n");
      expect(
        rows.some((line) => line.startsWith("| Project |")),
        name,
      ).toBe(false);
      expect(
        rows.some((line) => line.startsWith("| Project repository |")),
        name,
      ).toBe(false);
      expect(
        rows.some((line) => line.startsWith("| Declared project key |")),
        name,
      ).toBe(false);
    }
  });

  test("the contrast form product repository is never a header row", () => {
    for (const [name, text] of both) {
      const rows = text.split("\n");
      expect(
        rows.some((line) => line.startsWith("| Product repository |")),
        name,
      ).toBe(false);
    }
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

describe("TC-DPKODR-001 the decision record's structural arms (automated half)", () => {
  const RECORD = "doc/decisions/ODR-0006-delivery-vocabulary-declared-project-key.md";
  const INDEX = "doc/decisions/00-index.md";
  const record = read(RECORD);
  const index = read(INDEX);

  test("the record exists and carries status Proposed with a null decision date", () => {
    expect(record).toMatch(/^id: ODR-0006$/mu);
    expect(record).toMatch(/^status: Proposed$/mu);
    expect(record).toMatch(/^decision_date: null$/mu);
    expect(record).toMatch(/^decision_type: odr$/mu);
  });

  test("the decision index lists ODR-0006", () => {
    expect(index).toContain(
      "| [ODR-0006](ODR-0006-delivery-vocabulary-declared-project-key.md) | ODR |",
    );
  });

  test("the body carries the vocabulary, the locked-name mapping, and the grammar", () => {
    expect(record).toContain("### The delivery vocabulary");
    expect(record).toContain("### The mapping of the locked names onto the vocabulary");
    expect(record).toContain("### The product key");
    expect(record).toContain("^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$");
    for (const term of [
      "Product",
      "Repository",
      "Main checkout",
      "Worktree",
      "Lane",
      "Work item",
      "Clone identity",
      "Product key",
    ]) {
      expect(record).toContain(`| ${term} |`);
    }
    expect(record).toContain("DECLARED_PRODUCT_KEY_PATTERN");
    expect(record).toContain("isDeclaredProductKey");
  });

  test("the body records the retirement clause and the amendment's supersession chain", () => {
    expect(record).toContain("retired from the model's own vocabulary");
    expect(record).toContain("Jira project");
    expect(record).toContain("7138707234");
    expect(record).toContain("7122871259");
    // The amendment's mapping row A: product = a group, with named exceptions.
    expect(record).toContain("named exceptions");
    expect(record).toContain("`groupKey`");
    expect(record).toContain("`projects.yaml`");
  });

  test("the body states its reading of ODR-0003 DC-4 and ODR-0004 C-2..C-5", () => {
    expect(record).toContain("### How the governing records read under this vocabulary");
    expect(record).toContain("ODR-0003 DC-4");
    expect(record).toContain("ODR-0004 C-2");
    expect(record).toContain("C-3");
    expect(record).toContain("C-4");
    expect(record).toContain("C-5");
    expect(record).toContain("No amendment to ODR-0003 or ODR-0004 is made or needed");
  });

  test("the record names the frozen exceptions and the mechanical rename", () => {
    expect(record).toContain("`--project-root`");
    expect(record).toContain("byte-identical");
    expect(record).toContain("GH-408");
    expect(record).toContain("never group-scoped");
  });
});
