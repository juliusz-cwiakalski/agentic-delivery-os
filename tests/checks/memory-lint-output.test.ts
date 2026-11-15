/**
 * GH-301 output verdicts, determinism, and the print ceiling
 * (TC-MEMLAY-004, TC-MEMGATE-001, TC-MEMGATE-002, TC-MEMNFR-003).
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  MemoryEvaluationResult,
  MemoryScannedFile,
} from "../../packages/core/src/contracts/index";
import { evaluateMemory } from "../../packages/core/src/domain/memory-lint";
import { memoryPrivacyVocabulary, runMemoryLint } from "../../scripts/checks/memory-lint";
import { fileListingBody } from "../fixtures/memory/bodies";
import { secretTokenFor } from "../fixtures/memory/secrets";
import {
  emptyTree,
  indexReadme,
  indexRow,
  populatedTree,
  recordText,
  treeWith,
  truncatingTree,
  validLessonFields,
} from "../fixtures/memory/tree";

const TODAY = "2026-11-15";
const EMPTY_VOCABULARY = { rules: [], suppressionClasses: [] } as const;

const evaluate = (files: readonly MemoryScannedFile[]): MemoryEvaluationResult =>
  evaluateMemory({ files, today: TODAY, privacy: EMPTY_VOCABULARY });

describe("TC-MEMLAY-004 empty and populated verdict stability", () => {
  test("the empty-but-proved tree reports no error findings", () => {
    const result = evaluate(emptyTree());
    expect(result.findings.filter((finding) => finding.severity === "error")).toEqual([]);
    expect(result.exitCode).toBe(0);
  });

  test("the populated tree reports no error findings", () => {
    const result = evaluate(populatedTree());
    expect(result.findings.filter((finding) => finding.severity === "error")).toEqual([]);
    expect(result.exitCode).toBe(0);
  });

  test("the summary reports counts without a fixed population", () => {
    const empty = evaluate(emptyTree());
    const populated = evaluate(populatedTree());
    expect(empty.summary.areas).toBe(8);
    expect(populated.summary.areas).toBe(8);
    expect(populated.summary.records).toBeGreaterThan(empty.summary.records);
  });
});

describe("TC-MEMGATE-001 exit verdict and summary counts", () => {
  const errorFiles = treeWith([
    {
      relative: "lessons/lesson-2026-001-no-id.md",
      text: recordText(validLessonFields({ id: undefined })),
    },
    {
      relative: "lessons/lesson-2026-002-no-date.md",
      text: recordText(validLessonFields({ id: "lesson-2026-002", created: undefined })),
    },
    {
      relative: "lessons/lesson-2026-003-no-evidence.md",
      text: recordText(validLessonFields({ id: "lesson-2026-003", evidence: undefined })),
    },
  ]);

  test("a tree with an error exits non-zero and prints FAIL lines plus a summary", () => {
    const result = evaluate(errorFiles);
    expect(result.exitCode).toBe(1);
    expect(result.findings).toHaveLength(3);
    expect(result.lines.filter((line) => line.startsWith("FAIL memory-lint:"))).toHaveLength(3);
    expect(
      result.lines.some((line) =>
        line.startsWith(
          `memory-lint: records=3 areas=8 errors=${result.summary.errors} advisories=0`,
        ),
      ),
    ).toBe(true);
    expect(result.summary.errors).toBe(3);
  });

  test("an advisory-only tree exits zero and prints WARN lines", () => {
    const result = evaluate(
      treeWith([
        {
          relative: "lessons/lesson-2026-001-advisory.md",
          text: recordText(validLessonFields({ revalidate_after: "2020-01-01" }), fileListingBody),
        },
      ]),
    );
    expect(result.exitCode).toBe(0);
    expect(result.summary.advisories).toBe(2);
    expect(result.lines.filter((line) => line.startsWith("WARN memory-lint:"))).toHaveLength(2);
    expect(result.lines.some((line) => line.startsWith("FAIL memory-lint:"))).toBe(false);
  });
});

describe("TC-MEMGATE-002 determinism and declared ordering", () => {
  test("two runs over one fixed injected date are byte-identical", () => {
    const first = evaluate(errorFilesTree());
    const second = evaluate(errorFilesTree());
    expect(first.lines).toEqual(second.lines);
    expect(first.exitCode).toBe(second.exitCode);
  });

  test("the printed stream is area-ordered across severities (F-9)", () => {
    const token = secretTokenFor("provider-token-prefix");
    const files = treeWith([
      {
        relative: "lessons/lesson-2026-001-derivable.md",
        text: recordText(validLessonFields(), fileListingBody),
      },
      {
        relative: "lessons/lesson-2026-002-secret.md",
        text: recordText(validLessonFields({ id: "lesson-2026-002" }), `# note\n${token}\n`),
      },
    ]);
    const result = evaluateMemory({
      files,
      today: TODAY,
      privacy: memoryPrivacyVocabulary(),
    });
    const warningIndex = result.lines.findIndex((line) =>
      line.startsWith("WARN memory-lint: memory.derivable.file-listing"),
    );
    const failureIndex = result.lines.findIndex((line) =>
      line.startsWith("FAIL memory-lint: memory.secret.provider-token-prefix"),
    );
    expect(warningIndex).toBeGreaterThanOrEqual(0);
    expect(failureIndex).toBeGreaterThan(warningIndex);
    expect(result.exitCode).toBe(1);
    expect(result.summary).toMatchObject({ errors: 1, advisories: 1 });
    const again = evaluateMemory({ files, today: TODAY, privacy: memoryPrivacyVocabulary() });
    expect(again.lines).toEqual(result.lines);
  });

  test("findings are ordered by area, path, line, and rule id", () => {
    const result = evaluate(errorFilesTree());
    const areas = result.findings.map((finding) => finding.area);
    expect(areas).toEqual([...areas].sort((left, right) => areaIndex(left) - areaIndex(right)));
    const withinArea = result.findings.filter((finding) => finding.area === "schema");
    const paths = withinArea.map((finding) => finding.path);
    expect(paths).toEqual([...paths].sort());
  });

  test("the pure evaluation reads no ambient clock", () => {
    const original = Date.now;
    Date.now = () => {
      throw new Error("the pure evaluation read the wall clock");
    };
    try {
      const result = evaluate(errorFilesTree());
      expect(result.findings.length).toBeGreaterThan(0);
    } finally {
      Date.now = original;
    }
  });
});

const areaOrder = [
  "schema",
  "dating",
  "provenance",
  "reference",
  "index",
  "budget",
  "derivable",
  "secret",
] as const;
const areaIndex = (area: string): number => areaOrder.indexOf(area as (typeof areaOrder)[number]);

function errorFilesTree(): readonly MemoryScannedFile[] {
  return treeWith([
    {
      relative: "lessons/lesson-2026-001-baseline.md",
      text: recordText(validLessonFields({ created: "15/11/2026" })),
    },
    {
      relative: "lessons/lesson-2026-002-baseline.md",
      text: recordText(validLessonFields({ id: "lesson-2026-002", statement: "x".repeat(400) })),
    },
  ]);
}

describe("TC-MEMNFR-003 print ceiling and truncation line", () => {
  test("150 errors print 100 FAIL lines and one truncation line with true totals", () => {
    const result = evaluate(truncatingTree({ errors: 150, advisories: 0 }));
    expect(result.exitCode).toBe(1);
    expect(result.lines.filter((line) => line.startsWith("FAIL memory-lint:"))).toHaveLength(100);
    expect(result.summary.errors).toBe(150);
    const truncation = result.lines.filter((line) => line.includes("truncated"));
    expect(truncation).toHaveLength(1);
    expect(truncation[0]).toContain("errors=150");
  });

  test("150 advisories print 100 WARN lines and one truncation line", () => {
    const result = evaluate(truncatingTree({ errors: 0, advisories: 150 }));
    expect(result.exitCode).toBe(0);
    expect(result.lines.filter((line) => line.startsWith("WARN memory-lint:"))).toHaveLength(100);
    expect(result.summary.advisories).toBe(150);
    expect(result.lines.filter((line) => line.includes("truncated"))).toHaveLength(1);
  });

  test("exactly 100 errors do not truncate; 101 do", () => {
    expect(
      evaluate(truncatingTree({ errors: 100, advisories: 0 })).lines.some((line) =>
        line.includes("truncated"),
      ),
    ).toBe(false);
    expect(
      evaluate(truncatingTree({ errors: 101, advisories: 0 })).lines.filter((line) =>
        line.includes("truncated"),
      ),
    ).toHaveLength(1);
  });

  test("the printed prefix is deterministic under truncation", () => {
    const first = evaluate(truncatingTree({ errors: 150, advisories: 0 }));
    const second = evaluate(truncatingTree({ errors: 150, advisories: 0 }));
    expect(first.lines).toEqual(second.lines);
  });
});

// --------------------------------------------------------------------------
// Phase 4 live-tree, boundary, and single-date-read blocks (TC-MEMGATE-003,
// TC-MEMNFR-001).
// --------------------------------------------------------------------------

const REPO = process.cwd();

describe("TC-MEMGATE-003 read-only, clock-free, offline evaluation", () => {
  test("the live lint run leaves the working tree byte-identical", () => {
    const before = spawnSync("git", ["status", "--porcelain"], {
      cwd: REPO,
      encoding: "utf8",
    }).stdout;
    const run = spawnSync("bun", ["run", "scripts/checks/memory-lint.ts"], {
      cwd: REPO,
      encoding: "utf8",
      timeout: 120_000,
    });
    const after = spawnSync("git", ["status", "--porcelain"], {
      cwd: REPO,
      encoding: "utf8",
    }).stdout;
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("memory-lint: records=");
    expect(after).toBe(before);
  });

  test("the read/parse/date/print boundary is stated in the sources", () => {
    const domain = readFileSync(join(REPO, "packages/core/src/domain/memory-lint.ts"), "utf8");
    const scanner = readFileSync(join(REPO, "packages/adapters/src/file/memory-scan.ts"), "utf8");
    const edge = readFileSync(join(REPO, "scripts/checks/memory-lint.ts"), "utf8");
    expect(domain).not.toContain("node:fs");
    expect(domain).not.toContain("node:child_process");
    expect(domain).not.toContain("node:net");
    expect(domain).not.toContain("fetch(");
    expect(domain).not.toContain('from "yaml"');
    expect(domain).not.toContain("Date.now");
    expect(domain).not.toContain("new Date()");
    expect(domain).not.toContain("packages/adapters");
    expect(scanner).toContain("readFileSync");
    expect(scanner).toContain("readdirSync");
    expect(scanner).toContain('from "yaml"');
    expect(edge).not.toContain("readFileSync");
    expect(edge).not.toContain("readdirSync");
    expect(edge).not.toContain('from "yaml"');
    expect((edge.match(/new Date\(\)/g) ?? []).length).toBe(1);
    expect(edge).toContain("scanMemoryTree");
    expect(edge).toContain("import.meta.main");
  });

  test("the boundary configuration guards core against adapter imports", () => {
    const config = readFileSync(join(REPO, ".dependency-cruiser.cjs"), "utf8");
    expect(config).toContain("matrix-core-importer");
    expect(readFileSync(join(REPO, "packages/core/src/domain/memory-lint.ts"), "utf8")).toContain(
      'from "../contracts/memory-record.js"',
    );
  });

  test("the invariant closure resolves without a built dist", () => {
    // The `ts-invariants` job installs and runs this check with no build step,
    // so no module of the read -> evaluate -> print closure may depend on a
    // package-manifest or `#` specifier that resolves to `packages/*/dist`.
    const domain = readFileSync(join(REPO, "packages/core/src/domain/memory-lint.ts"), "utf8");
    const scanner = readFileSync(join(REPO, "packages/adapters/src/file/memory-scan.ts"), "utf8");
    const edge = readFileSync(join(REPO, "scripts/checks/memory-lint.ts"), "utf8");
    expect(domain).not.toContain('from "#contracts"');
    expect(scanner).toContain(
      'import type { MemoryFrontmatter, MemoryScannedFile } from "@delivery-os/core/contracts";',
    );
    expect(edge).toContain("MEMORY_ROOT");
    expect(edge).not.toContain('from "#contracts"');
  });
});

describe("TC-MEMNFR-001 byte-identical output and exactly one date read", () => {
  test("the live tree produces byte-identical output on two runs", () => {
    const first = runMemoryLint({ root: REPO });
    const second = runMemoryLint({ root: REPO });
    expect(first.lines).toEqual(second.lines);
    expect(first.exitCode).toBe(second.exitCode);
  });

  test("the edge performs exactly one injected date read per run", () => {
    const root = mkdtempSync(join(tmpdir(), "gh301-date-"));
    try {
      mkdirSync(join(root, ".ai/memory/lessons"), { recursive: true });
      writeFileSync(
        join(root, ".ai/memory/README.md"),
        indexReadme([indexRow("lessons/lesson-2026-001-baseline.md", "read it")]),
      );
      writeFileSync(
        join(root, ".ai/memory/lessons/lesson-2026-001-baseline.md"),
        recordText(validLessonFields({ created: "2021-01-01" })),
      );
      let reads = 0;
      const result = runMemoryLint({
        root,
        readToday: () => {
          reads += 1;
          return "2020-01-01";
        },
      });
      expect(reads).toBe(1);
      expect(
        result.findings.some((finding) => finding.ruleId === "memory.dating.created-future"),
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a later injected date changes only date-derived findings", () => {
    const root = mkdtempSync(join(tmpdir(), "gh301-date-later-"));
    try {
      mkdirSync(join(root, ".ai/memory/lessons"), { recursive: true });
      writeFileSync(
        join(root, ".ai/memory/README.md"),
        indexReadme([indexRow("lessons/lesson-2026-001-baseline.md", "read it")]),
      );
      writeFileSync(
        join(root, ".ai/memory/lessons/lesson-2026-001-baseline.md"),
        recordText(validLessonFields({ created: "2026-11-16" })),
      );
      const early = runMemoryLint({ root, readToday: () => "2026-11-15" });
      const later = runMemoryLint({ root, readToday: () => "2026-11-17" });
      expect(
        early.findings.some((finding) => finding.ruleId === "memory.dating.created-future"),
      ).toBe(true);
      expect(
        later.findings.some((finding) => finding.ruleId === "memory.dating.created-future"),
      ).toBe(false);
      const nonDate = (result: typeof early) =>
        result.findings.filter((finding) => finding.area !== "dating" && finding.area !== "budget");
      expect(nonDate(early)).toEqual(nonDate(later));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
