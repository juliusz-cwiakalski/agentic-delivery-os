/**
 * One-defect-per-case record fixtures for the GH-301 pure evaluator.
 *
 * Every record is built from the imported schema constants; no bound or
 * vocabulary is restated as a literal.
 */
import {
  STATEMENT_MAX_CHARS,
  type MemoryScannedFile,
} from "../../../packages/core/src/contracts/index";
import { memoryFile, recordText, validLessonFields } from "./tree";

export type MutantCase = {
  readonly name: string;
  readonly expected: string;
  readonly records: readonly { readonly relative: string; readonly text: string }[];
  readonly extras?: readonly MemoryScannedFile[];
};

const baseline = (overrides: Readonly<Record<string, unknown>> = {}, body = ""): string =>
  recordText(validLessonFields(overrides), body);

const lesson = (overrides: Readonly<Record<string, unknown>> = {}) => ({
  relative: "lessons/lesson-2026-001-baseline.md",
  text: baseline(overrides),
});

const without = (key: string): string => {
  const fields = validLessonFields();
  delete (fields as Record<string, unknown>)[key];
  return recordText(fields);
};

/** The thirteen isolated schema defects (TC-MEMSCHEMA-002). */
export const schemaMutants = (): readonly MutantCase[] => [
  {
    name: "frontmatter absent",
    expected: "memory.schema.frontmatter-missing",
    records: [{ relative: "lessons/lesson-2026-001-baseline.md", text: "# no frontmatter\n" }],
  },
  {
    name: "frontmatter malformed",
    expected: "memory.schema.frontmatter-malformed",
    records: [
      { relative: "lessons/lesson-2026-001-baseline.md", text: "---\nid: [unclosed\n---\n" },
    ],
  },
  {
    name: "required id removed",
    expected: "memory.schema.keys-missing",
    records: [{ relative: "lessons/lesson-2026-001-baseline.md", text: without("id") }],
  },
  {
    name: "undeclared key added",
    expected: "memory.schema.key-unknown",
    records: [lesson({ fifth_variation: "x" })],
  },
  {
    name: "id outside the grammar",
    expected: "memory.schema.id-malformed",
    records: [{ relative: "lessons/Lesson_2026_1.md", text: baseline({ id: "Lesson_2026_1" }) }],
  },
  {
    name: "duplicate id",
    expected: "memory.schema.id-duplicate",
    records: [lesson(), { relative: "lessons/lesson-2026-001-second.md", text: baseline() }],
  },
  {
    name: "file name mismatch",
    expected: "memory.schema.file-name-mismatch",
    records: [{ relative: "lessons/lesson-2026-999-baseline.md", text: baseline() }],
  },
  {
    name: "kind outside the vocabulary",
    expected: "memory.schema.value-unknown",
    records: [lesson({ kind: "memory" })],
  },
  {
    name: "statement over the bound",
    expected: "memory.schema.statement-too-long",
    records: [lesson({ statement: "x".repeat(STATEMENT_MAX_CHARS + 1) })],
  },
  {
    name: "preference source is not a human correction",
    expected: "memory.schema.preference-source",
    records: [
      {
        relative: "preferences/preference-2026-001-baseline.md",
        text: baseline({ id: "preference-2026-001", kind: "preference", source: "review_verdict" }),
      },
    ],
  },
  {
    name: "guild tag disagrees with its folder",
    expected: "memory.schema.guild-mismatch",
    records: [
      {
        relative: "guilds/ops/lesson-2026-001-baseline.md",
        text: baseline({ guild: "other" }),
      },
    ],
  },
  {
    name: "guild tag outside a guild folder",
    expected: "memory.schema.guild-mismatch",
    records: [lesson({ guild: "ops" })],
  },
  {
    name: "superseded without superseded_by",
    expected: "memory.schema.superseded-by-missing",
    records: [lesson({ status: "superseded" })],
  },
];

/** Boundary and conditional controls for TC-MEMSCHEMA-002. */
export const schemaControls = (): readonly MutantCase[] => [
  {
    name: "statement just under the bound",
    expected: "none",
    records: [lesson({ statement: "x".repeat(STATEMENT_MAX_CHARS - 1) })],
  },
  {
    name: "statement exactly at the bound",
    expected: "none",
    records: [lesson({ statement: "x".repeat(STATEMENT_MAX_CHARS) })],
  },
  {
    name: "hand-authored record omits basis",
    expected: "none",
    records: [lesson()],
  },
  {
    name: "basis outside the capture-bar set",
    expected: "memory.schema.value-unknown",
    records: [lesson({ basis: "gut-feel" })],
  },
];

const dayAfter = (date: string): string => {
  const time = Date.parse(`${date}T00:00:00Z`) + 24 * 60 * 60 * 1000;
  return new Date(time).toISOString().slice(0, 10);
};

/** Creation-date classification rows (TC-MEMDATE-001). */
export const datingMutants = (today: string): readonly MutantCase[] => [
  {
    name: "created absent",
    expected: "memory.schema.keys-missing",
    records: [{ relative: "lessons/lesson-2026-001-baseline.md", text: without("created") }],
  },
  {
    name: "created wrong shape",
    expected: "memory.dating.created-malformed",
    records: [lesson({ created: "15/11/2026" })],
  },
  {
    name: "created empty",
    expected: "memory.dating.created-malformed",
    records: [lesson({ created: "" })],
  },
  {
    name: "created in the future",
    expected: "memory.dating.created-future",
    records: [lesson({ created: dayAfter(today) })],
  },
  {
    name: "created equal to the injected date",
    expected: "none",
    records: [lesson({ created: today })],
  },
];

/** Revalidation and capture-line rows (TC-MEMDATE-002). */
export const revalidationMutants = (today: string): readonly MutantCase[] => [
  {
    name: "authoritative behaviour-changing lesson lacks revalidation",
    expected: "memory.dating.revalidate-missing",
    records: [
      lesson({
        status: "authoritative",
        evaluation: { control_pass_rate: 0.9, treatment_pass_rate: 0.95 },
      }),
    ],
  },
  {
    name: "malformed revalidation date",
    expected: "memory.dating.revalidate-malformed",
    records: [lesson({ revalidate_after: "next week" })],
  },
  {
    name: "expired revalidation date is advisory",
    expected: "memory.dating.revalidate-expired",
    records: [lesson({ revalidate_after: "2020-01-01" })],
  },
  {
    name: "authoritative non-behaviour-changing lesson is silent",
    expected: "none",
    records: [lesson({ status: "authoritative" })],
  },
  {
    name: "capture line with the wrong date shape",
    expected: "memory.dating.entry-line-date",
    records: [lesson()],
    extras: [memoryFile("agents/coder/README.md", "# coder\n\n- 2026/11/10: note\n")],
  },
  {
    name: "capture line with a valid date",
    expected: "none",
    records: [lesson()],
    extras: [memoryFile("agents/coder/README.md", "# coder\n\n- 2026-11-10: note\n")],
  },
  {
    name: "expired at the injected date boundary stays silent",
    expected: "none",
    records: [lesson({ revalidate_after: today })],
  },
];

/** Provenance and source-presence rows (TC-MEMPROV-001). */
export const provenanceMutants = (): readonly MutantCase[] => [
  {
    name: "evidence absent",
    expected: "memory.provenance.evidence-missing",
    records: [{ relative: "lessons/lesson-2026-001-baseline.md", text: without("evidence") }],
  },
  {
    name: "evidence empty",
    expected: "memory.provenance.evidence-missing",
    records: [lesson({ evidence: "" })],
  },
  {
    name: "evidence outside the declared shapes",
    expected: "memory.provenance.evidence-shape-unknown",
    records: [lesson({ evidence: "we all agreed" })],
  },
  {
    name: "created_by absent",
    expected: "memory.provenance.created-by-missing",
    records: [{ relative: "lessons/lesson-2026-001-baseline.md", text: without("created_by") }],
  },
  {
    name: "source absent is schema-owned",
    expected: "memory.schema.keys-missing",
    records: [{ relative: "lessons/lesson-2026-001-baseline.md", text: without("source") }],
  },
  {
    name: "source outside the channels is schema-owned",
    expected: "memory.schema.value-unknown",
    records: [lesson({ source: "slack" })],
  },
];

/** Reference-integrity rows (TC-MEMREF-001). */
export const referenceMutants = (): readonly MutantCase[] => [
  {
    name: "dangling supersedes",
    expected: "memory.reference.supersedes-dangling",
    records: [lesson({ supersedes: ["lesson-2026-999"] })],
  },
  {
    name: "dangling superseded_by",
    expected: "memory.reference.superseded-by-dangling",
    records: [lesson({ superseded_by: "lesson-2026-999" })],
  },
  {
    name: "asymmetric supersession",
    expected: "memory.reference.supersede-asymmetry",
    records: [
      {
        relative: "lessons/lesson-2026-001-baseline.md",
        text: baseline({ supersedes: ["lesson-2026-002"] }),
      },
      {
        relative: "lessons/lesson-2026-002-baseline.md",
        text: baseline({ id: "lesson-2026-002" }),
      },
    ],
  },
  {
    name: "dangling contradicts",
    expected: "memory.reference.contradicts-dangling",
    records: [lesson({ contradicts: ["tacit-2026-999"] })],
  },
  {
    name: "dangling in-tree link",
    expected: "memory.reference.link-dangling",
    records: [
      {
        relative: "lessons/lesson-2026-001-baseline.md",
        text: baseline({}, "[note](../nowhere.md)\n"),
      },
    ],
  },
];

/** The symmetric, resolvable control for TC-MEMREF-002. */
export const symmetricReferenceTree = (): MemoryScannedFile[] => {
  const a = {
    relative: "lessons/lesson-2026-001-baseline.md",
    text: baseline(
      { supersedes: ["lesson-2026-002"], contradicts: ["lesson-2026-002"] },
      "[the other record](./lesson-2026-002-baseline.md)\n",
    ),
  };
  const b = {
    relative: "lessons/lesson-2026-002-baseline.md",
    text: baseline({ id: "lesson-2026-002", superseded_by: "lesson-2026-001" }),
  };
  return [a, b].map((record) => memoryFile(record.relative, record.text));
};
