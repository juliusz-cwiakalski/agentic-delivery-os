/**
 * TC-SYNC-010 — the three PROSE-ONLY operation-count pages state ten, with every
 * statement location named and the two neighbouring counts left alone
 * (AC-F4-1, DM-7, NFR-6; spec §24.1).
 *
 * No shipped check reads these pages, so the reconciliation is a documentation
 * obligation of the final delivery phase and this suite makes it mechanical. It
 * asserts three things and each one fails by name:
 *
 * 1. seven named statements read ten — five on the provider-client-seeds page,
 *    one on `doc/spec/nonfunctional.md`, one on `doc/overview/architecture-overview.md`;
 * 2. the two neighbouring counts read nine and are not this count at all (the
 *    nine `verify` clause ids; the `status` nine-section statement), so a
 *    page-wide `nine`→`ten` substitution fails naming the overreach;
 * 3. no page carries a stale operation count anywhere: the complete set of
 *    `nine` line occurrences on the three pages equals the two neighbours, so a
 *    statement left behind fails naming the file and the line.
 *
 * The check-bound operation table (`feature-adapter-reference-behavior.md`) is
 * deliberately absent: it is a delivered-check-bound carrier owned by
 * `TC-SYNC-009`, and one assertion has exactly one owner.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ADAPTER_OPERATIONS } from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();

const SEEDS = "doc/spec/features/feature-provider-client-seeds.md";
const NONFUNCTIONAL = "doc/spec/nonfunctional.md";
const ARCHITECTURE = "doc/overview/architecture-overview.md";

/** The closed operation set is ten, and the pages describe it, not a copy. */
const OPERATION_COUNT = 10;

/**
 * The operation-count statements that must read ten, one row per location. The
 * line numbers are the statements' own lines; `nonfunctional.parity` is the
 * statement the plan calls `:349` — the page moved down five lines when the
 * merged base landed, and the statement is located by its bytes, not its old
 * offset.
 */
type TenStatement = {
  readonly id: string;
  readonly file: string;
  /** The line the statement starts on (1-based). */
  readonly line: number;
  /** Every fragment the reconciled statement must carry. */
  readonly carries: readonly string[];
};

const TEN_STATEMENTS: readonly TenStatement[] = [
  {
    id: "seeds.summary",
    file: SEEDS,
    line: 9,
    carries: ["(ten supported operations, no gaps)"],
  },
  {
    id: "seeds.narrative",
    file: SEEDS,
    line: 21,
    carries: [
      "GitHub supports all ten closed operations",
      "`close-milestone`",
      "adapter-not-implemented",
      "provider-unsupported",
    ],
  },
  {
    id: "seeds.slice-table",
    file: SEEDS,
    line: 58,
    carries: ["All ten closed operations:"],
  },
  {
    id: "seeds.capability-row",
    file: SEEDS,
    line: 72,
    carries: ["| GitHub | All ten closed operations | None. |"],
  },
  {
    id: "seeds.conformance-row",
    file: SEEDS,
    line: 297,
    carries: ["Three primitive flows over the ten closed operations"],
  },
  {
    id: "nonfunctional.parity",
    file: NONFUNCTIONAL,
    line: 354,
    carries: ["a declared matrix over the ten closed operations"],
  },
  {
    id: "architecture.adapter-row",
    file: ARCHITECTURE,
    line: 107,
    carries: ["all ten closed operations", "the milestone close"],
  },
];

/**
 * The two neighbouring counts on adjacent lines: different closed sets that
 * must keep saying nine, and must not be swept by a page-wide substitution.
 */
type Neighbour = {
  readonly id: string;
  readonly file: string;
  readonly line: number;
  readonly carries: readonly string[];
  /** The overreached form a blanket substitution would produce. */
  readonly overreach: string;
};

const NEIGHBOURS: readonly Neighbour[] = [
  {
    id: "nonfunctional.clause-ids",
    file: NONFUNCTIONAL,
    line: 357,
    carries: ["one of nine closed clause ids"],
    overreach: "one of ten closed clause ids",
  },
  {
    id: "architecture.status-sections",
    file: ARCHITECTURE,
    line: 127,
    carries: ["nine-section"],
    overreach: "ten-section",
  },
];

/** A page reader; the live tree for the assertion, injected bytes for controls. */
type ReadPage = (file: string) => string;

const livePage: ReadPage = (file) => readFileSync(join(ROOT, file), "utf8");

const lineAt = (text: string, line: number): string => text.split("\n")[line - 1] ?? "";

/** 1-based line numbers whose text mentions the number nine as a word. */
const nineLinesOf = (text: string): readonly number[] =>
  text
    .split("\n")
    .map((line, index) => (/(?<![\p{L}\d])nine(?![\p{L}\d])/u.test(line) ? index + 1 : 0))
    .filter((line) => line > 0);

/** The declared remaining `nine` lines per page (the two neighbours only). */
const DECLARED_NINE_LINES: Readonly<Record<string, readonly number[]>> = {
  [SEEDS]: [],
  [NONFUNCTIONAL]: [357],
  [ARCHITECTURE]: [127],
};

/**
 * Every violation of the declared documentation contract, named by file, line
 * and statement id. An empty list is the pass; the live tree must produce one.
 */
const pageViolations = (read: ReadPage = livePage): readonly string[] => {
  const violations: string[] = [];
  for (const statement of TEN_STATEMENTS) {
    const line = lineAt(read(statement.file), statement.line);
    for (const fragment of statement.carries) {
      if (!line.includes(fragment)) {
        violations.push(
          `${statement.file}:${statement.line} [${statement.id}] missing "${fragment}"`,
        );
      }
    }
  }
  for (const neighbour of NEIGHBOURS) {
    const line = lineAt(read(neighbour.file), neighbour.line);
    for (const fragment of neighbour.carries) {
      if (!line.includes(fragment)) {
        violations.push(
          `${neighbour.file}:${neighbour.line} [${neighbour.id}] lost its unchanged "${fragment}"`,
        );
      }
    }
    if (line.includes(neighbour.overreach)) {
      violations.push(
        `${neighbour.file}:${neighbour.line} [${neighbour.id}] was swept to "${neighbour.overreach}"`,
      );
    }
  }
  for (const [file, declared] of Object.entries(DECLARED_NINE_LINES)) {
    const actual = nineLinesOf(read(file));
    if (actual.join(",") !== declared.join(",")) {
      violations.push(
        `${file}: nine lines are [${actual.join(",")}], declared [${declared.join(",")}]`,
      );
    }
  }
  return violations;
};

/** A reader over a tree whose named page has been mutated in memory. */
const withMutatedPage =
  (file: string, mutate: (text: string) => string): ReadPage =>
  (candidate) =>
    candidate === file ? mutate(livePage(candidate)) : livePage(candidate);

describe("TC-SYNC-010 the three prose-only pages state ten at every named location", () => {
  test("the closed set is ten and the seeds enumeration names each member exactly once", () => {
    expect(ADAPTER_OPERATIONS).toHaveLength(OPERATION_COUNT);
    expect(ADAPTER_OPERATIONS.at(-1)).toBe("close-milestone");
    const enumeration = lineAt(livePage(SEEDS), 58);
    expect(enumeration).toContain("All ten closed operations:");
    // The page enumerates its own reading order; the claim is membership, so
    // every closed member is named exactly once and no stale member remains.
    for (const operation of ADAPTER_OPERATIONS) {
      expect(
        enumeration.split(`\`${operation}\``).length - 1,
        `seeds:58 must name ${operation} exactly once`,
      ).toBe(1);
    }
    expect(enumeration).not.toMatch(/\bnine\b/u);
  });

  test("all seven statements read ten and the two neighbours still read nine", () => {
    expect(pageViolations()).toEqual([]);
  });

  test("no page carries a stale operation count outside the two neighbours", () => {
    expect(nineLinesOf(livePage(SEEDS))).toEqual([]);
    for (const neighbour of NEIGHBOURS) {
      expect(lineAt(livePage(neighbour.file), neighbour.line), neighbour.id).toContain("nine");
      expect(lineAt(livePage(neighbour.file), neighbour.line), neighbour.id).not.toContain(
        neighbour.overreach,
      );
    }
  });
});

describe("TC-SYNC-010 the assertion fails by name on a stale page and on an overreach", () => {
  test("each of the seven statements left at nine is named by file, line and id", () => {
    // Every location is exercised: reverting any one statement's own bytes to
    // the stale count must be reported at that location by name (M109).
    for (const statement of TEN_STATEMENTS) {
      const fragment = statement.carries[0] ?? "";
      expect(fragment, statement.id).toContain("ten");
      const stale = fragment.replace("ten", "nine");
      const read = withMutatedPage(statement.file, (text) => text.split(fragment).join(stale));
      const violations = pageViolations(read);
      expect(violations.length, statement.id).toBeGreaterThan(0);
      expect(violations.join("\n"), statement.id).toContain(
        `${statement.file}:${statement.line} [${statement.id}]`,
      );
      // The mutation is visible to the page-wide scan too: the page now holds a
      // `nine` line the declaration does not allow.
      expect(violations.join("\n"), statement.id).toContain(`${statement.file}: nine lines are`);
    }
  });

  test("a page-wide nine→ten substitution is named as the overreach it is (M111)", () => {
    // A blanket replacement on either page also moves the neighbouring count;
    // the predicate must report the neighbour, not silently accept the sweep.
    const nonfunctional = pageViolations(
      withMutatedPage(NONFUNCTIONAL, (text) =>
        text
          .split("one of nine closed clause ids")
          .join("one of ten closed clause ids")
          .split("a declared matrix over the ten closed operations")
          .join("a declared matrix over the nine closed operations"),
      ),
    );
    expect(nonfunctional.join("\n")).toContain(
      '[nonfunctional.clause-ids] was swept to "one of ten closed clause ids"',
    );
    expect(nonfunctional.join("\n")).toContain("[nonfunctional.parity]");

    const architecture = pageViolations(
      withMutatedPage(ARCHITECTURE, (text) =>
        text
          .split("nine-section")
          .join("ten-section")
          .split("all ten closed operations")
          .join("all nine closed operations"),
      ),
    );
    expect(architecture.join("\n")).toContain(
      '[architecture.status-sections] was swept to "ten-section"',
    );
    expect(architecture.join("\n")).toContain("[architecture.adapter-row]");

    // The delivered pages are the control: the live tree is clean.
    expect(pageViolations()).toEqual([]);
  });

  test("the check-bound reference-behavior table is not asserted here (wrong owner)", () => {
    // TC-SYNC-009 owns that page's operation table; this case names no
    // statement on it, so a page-wide assertion here cannot hide the missing
    // milestone-phase edit.
    const reference = "doc/spec/features/feature-adapter-reference-behavior.md";
    expect(TEN_STATEMENTS.map((statement) => statement.file)).not.toContain(reference);
    expect(NEIGHBOURS.map((neighbour) => neighbour.file)).not.toContain(reference);
  });
});
