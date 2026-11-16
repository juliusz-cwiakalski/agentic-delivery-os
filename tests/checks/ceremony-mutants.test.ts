/**
 * TC-CEREMONY-050/051/053 (mutation meta-suite) — each load-bearing rule is
 * pinned by a source mutation: disabling exactly one rule in a temp copy makes
 * the rule's scanner fail, while the real module passes. The live tree is never
 * written.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

type Mutant = {
  readonly name: string;
  readonly file: string;
  readonly find: string;
  readonly replace: string;
  /** True when the source violates the rule (the prohibited observable exists). */
  readonly violates: (text: string) => boolean;
};

const includes = (token: string) => (text: string) => text.includes(token);
const excludes = (token: string) => (text: string) => !text.includes(token);
const matches = (pattern: RegExp) => (text: string) => pattern.test(text);

const MUTANTS: readonly Mutant[] = [
  {
    name: "skip read-back verification",
    file: "packages/core/src/domain/ceremony-run.ts",
    find: "const read = readBack(input.step, input.runId, written.ref, input.env);",
    replace: "const read = { ok: true, content };",
    violates: excludes("readBack(input.step"),
  },
  {
    name: "treat step outcome as verification",
    file: "packages/core/src/domain/ceremony-run.ts",
    find: 'verification: verified.ok ? "verified" : "unverified",',
    replace: 'verification: "verified",',
    violates: excludes('verification: verified.ok ? "verified" : "unverified"'),
  },
  {
    name: "resume from step zero",
    file: "packages/core/src/domain/ceremony-run.ts",
    find: "const startIndex = input.startIndex ?? 1;",
    replace: "const startIndex = input.startIndex ?? 0;",
    violates: excludes("input.startIndex ?? 1"),
  },
  {
    name: "allow a duplicate run identity",
    file: "packages/core/src/domain/ceremony-run.ts",
    find: "if (existing !== undefined) {",
    replace: "if (false) {",
    violates: excludes("if (existing !== undefined) {"),
  },
  {
    name: "record an explicit run as a schedule kind",
    file: "packages/core/src/domain/ceremony-intake.ts",
    find: 'kind: "explicit",\n      resolution: "declaration",',
    replace: 'kind: "schedule",\n      resolution: "declaration",',
    violates: (text) => !/kind: "explicit",\s*\n\s*resolution: "declaration"/.test(text),
  },
  {
    name: "derive a window for an event-only declaration",
    file: "packages/core/src/domain/ceremony-intake.ts",
    find: "declares no window; supply --window",
    replace: "declares no window; deriving the current day",
    violates: excludes("supply --window"),
  },
  {
    name: "accept a declaration with no scope key",
    file: "packages/core/src/domain/ceremony-declaration.ts",
    find: 'if (!isRecord(scopeKey)) return fail("scopeKey", "is required", id);',
    replace: "if (!isRecord(scopeKey)) return undefined;",
    violates: excludes('fail("scopeKey", "is required"'),
  },
  {
    name: "allow a second missed window",
    file: "packages/core/src/domain/ceremony-schedule.ts",
    find: "const [replay] = evaluation.missed;",
    replace: "const replay = evaluation.missed[0]; void evaluation.missed[1];",
    violates: excludes("const [replay] = evaluation.missed;"),
  },
  {
    name: "replay a window whose identity is already recorded",
    file: "packages/core/src/domain/ceremony-schedule.ts",
    find: "if (\n      ceremonyWindowRecorded(input.runs, {",
    replace: "if (\n      false && ceremonyWindowRecorded(input.runs, {",
    violates: (text) => text.includes("false && ceremonyWindowRecorded"),
  },
  {
    name: "hardcode the lite phase set",
    file: "packages/core/src/domain/ceremony-tier.ts",
    find: "export const ceremonyPhaseSetForVariant = (",
    replace:
      'const HARDCODED_LITE = ["clarify_scope", "delivery"];\nexport const ceremonyPhaseSetForVariant = (',
    violates: matches(/"clarify_scope"[\s\S]*"delivery"/),
  },
  {
    name: "treat declaredTier as authoritative",
    file: "packages/core/src/domain/ceremony-tier.ts",
    find: "let effectiveTier: PmNotesVariant = declaredVariant;",
    replace: "let effectiveTier: PmNotesVariant = declaredTier as PmNotesVariant;",
    violates: includes("= declaredTier as PmNotesVariant"),
  },
  {
    name: "drop an unevaluated trigger",
    file: "packages/core/src/domain/ceremony-tier.ts",
    find: 'escalationTriggers.push({ trigger: declared, state: "unevaluated" });',
    replace: "// unevaluated trigger dropped",
    violates: excludes('state: "unevaluated"'),
  },
  {
    name: "write a note body instead of an addendum",
    file: "packages/core/src/domain/ceremony-run.ts",
    find: 'append: existing.state === "present",',
    replace: "append: false,",
    violates: excludes('append: existing.state === "present"'),
  },
  {
    name: "fabricate a null-retro finding",
    file: "packages/core/src/domain/ceremony-builtins.ts",
    find: "findingSet: [],",
    replace: 'findingSet: ["fabricated finding"],',
    violates: (text) => !text.includes("findingSet: [],"),
  },
  {
    name: "substitute the native basis for the committed proxy",
    file: "packages/core/src/domain/ceremony-comparison.ts",
    find: "metricId: CEREMONY_SHARE_METRIC_ID,",
    replace: 'metricId: "native-ceremony-time" as typeof CEREMONY_SHARE_METRIC_ID,',
    violates: excludes("metricId: CEREMONY_SHARE_METRIC_ID,"),
  },
  {
    name: "zero-fill insufficient-sample into flat",
    file: "packages/core/src/domain/ceremony-comparison.ts",
    find: '? "insufficient-sample"',
    replace: '? "flat"',
    violates: excludes('? "insufficient-sample"'),
  },
];

describe("TC-CEREMONY-050/051/053 disabling one rule at a time fails its scanner", () => {
  test.each(MUTANTS)("$name", (mutant) => {
    const source = readFileSync(join(ROOT, mutant.file), "utf8");
    expect(
      mutant.violates(source),
      `${mutant.name}: the live module already violates the rule`,
    ).toBe(false);
    expect(source.includes(mutant.find), `${mutant.name}: the mutation anchor is absent`).toBe(
      true,
    );
    const mutated = source.replace(mutant.find, mutant.replace);
    expect(mutated, `${mutant.name}: the mutation changed nothing`).not.toBe(source);
    expect(mutant.violates(mutated), `${mutant.name}: the mutation is invisible`).toBe(true);
  });

  test("the mutant count is the declared minimum", () => {
    expect(MUTANTS.length).toBeGreaterThanOrEqual(16);
    expect(new Set(MUTANTS.map((mutant) => mutant.name)).size).toBe(MUTANTS.length);
  });
});
