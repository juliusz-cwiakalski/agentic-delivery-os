/**
 * TC-DOCREC-004 — the §16.1.1 stale/required phrase table is the single source
 * for the doc-conformance scan. This scope asserts the two behavior-spec rows
 * that the lifecycle-completion change owns.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SPEC = "doc/changes/2026-11/2026-11-07--GH-242--agent-integration/chg-GH-242-spec.md";

type PhraseRow = {
  readonly page?: string;
  readonly stale: readonly string[];
  readonly required: readonly string[];
  readonly owner: string;
};

const tableSection = (text: string): string => {
  const start = text.indexOf("#### 16.1.1");
  if (start < 0) throw new Error("the §16.1.1 phrase table is missing");
  const rest = text.slice(start);
  const end = rest.indexOf("\n## ", 1);
  return end < 0 ? rest : rest.slice(0, end);
};

const quoted = (cell: string): readonly string[] =>
  [...cell.matchAll(/"([^"]+)"/g)]
    .map((match) => match[1] ?? "")
    .filter((value) => value.length > 0);

/** Required cells may end with one unquoted sentence after the last quote. */
const requiredPhrases = (cell: string): readonly string[] => {
  const phrases = [...quoted(cell)];
  const lastQuote = cell.lastIndexOf('"');
  if (lastQuote >= 0) {
    const tail = cell
      .slice(lastQuote + 1)
      .replace(/^[;\s]+/, "")
      .replace(/[.;\s]+$/, "");
    if (tail.length > 0) phrases.push(tail);
  }
  return phrases;
};

const rowsOf = (specText: string): readonly PhraseRow[] => {
  const section = tableSection(specText);
  const rows: PhraseRow[] = [];
  for (const line of section.split("\n")) {
    if (!line.startsWith("|") || line.startsWith("|---") || line.startsWith("| Page ")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 4) continue;
    const [pageCell, staleCell, requiredCell, ownerCell] = cells;
    if (pageCell === undefined || staleCell === undefined || requiredCell === undefined) continue;
    const page = pageCell.replaceAll("`", "").trim();
    rows.push({
      ...(page.includes(".md") ? { page } : {}),
      stale: quoted(staleCell),
      required: requiredPhrases(requiredCell),
      owner: ownerCell ?? "",
    });
  }
  return rows;
};

const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

const stripRequired = (text: string, required: readonly string[]): string => {
  let result = text.toLowerCase();
  for (const phrase of required) {
    result = result.split(phrase.toLowerCase()).join("");
  }
  return result;
};

const behaviorSpecPages = [
  "feature-commit-primitive.md",
  "feature-pm-notes-lint-and-phase-transitions.md",
] as const;

describe("TC-DOCREC-004 scope: behavior-spec phrase-table rows", () => {
  test("the table carries both behavior-spec rows and names phase 3", () => {
    const rows = rowsOf(read(SPEC));
    for (const page of behaviorSpecPages) {
      const row = rows.find((entry) => entry.page === page);
      expect(row, page).toBeDefined();
      expect(row?.stale.length, page).toBeGreaterThan(0);
      expect(row?.required.length, page).toBeGreaterThan(0);
      expect(row?.owner, page).toContain("Phase 3");
    }
  });

  test("every behavior-spec stale phrase is absent and every required phrase is present", () => {
    const rows = rowsOf(read(SPEC));
    const failures: string[] = [];
    for (const page of behaviorSpecPages) {
      const row = rows.find((entry) => entry.page === page);
      if (row === undefined) continue;
      const text = read(`doc/spec/features/${page}`);
      const residue = stripRequired(text, row.required);
      for (const phrase of row.stale) {
        if (residue.toLowerCase().includes(phrase.toLowerCase())) {
          failures.push(`${page}: stale phrase still present: ${phrase}`);
        }
      }
      for (const phrase of row.required) {
        if (!text.toLowerCase().includes(phrase.toLowerCase())) {
          failures.push(`${page}: required phrase missing: ${phrase}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  test("the scan is non-vacuous: a mutated copy fails", () => {
    const original = read("doc/spec/features/feature-commit-primitive.md");
    const mutated = `${original}\n| \`commit.session.context-refused\` |`;
    const row = rowsOf(read(SPEC)).find((entry) => entry.page === "feature-commit-primitive.md");
    expect(row).toBeDefined();
    const residue = stripRequired(mutated, row?.required ?? []);
    const detected = (row?.stale ?? []).some((phrase) =>
      residue.toLowerCase().includes(phrase.toLowerCase()),
    );
    expect(detected).toBe(true);
  });
});
