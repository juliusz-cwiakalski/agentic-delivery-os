/**
 * Shared pm-notes fixture helpers for the GH-179 rule-level suites.
 *
 * Fixtures are committed read-only YAML. Tests parse them through the YAML 1.2
 * core schema and hand plain values (or parse failures) to the pure rules; no
 * test mutates a committed file — mutations clone the parsed value.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument } from "yaml";
import type { PmNotesParseOutcome } from "../../packages/core/src/contracts/index";

export const PM_NOTES_FIXTURES = join(process.cwd(), "tests/fixtures/pm-notes");

export const readPmNotesFixture = (relative: string): string =>
  readFileSync(join(PM_NOTES_FIXTURES, relative), "utf8");

/** Parse YAML 1.2 core, returning a parse-failure input instead of throwing. */
export const parsePmNotes = (text: string, location: string): PmNotesParseOutcome => {
  try {
    const document = parseDocument(text, {
      version: "1.2",
      schema: "core",
      uniqueKeys: true,
      merge: false,
    });
    if (document.errors.length > 0) {
      return { ok: false, parseFailure: { class: "syntax", location } };
    }
    return { ok: true, value: document.toJS() };
  } catch {
    return { ok: false, parseFailure: { class: "syntax", location } };
  }
};

export const loadPmNotes = (relative: string): PmNotesParseOutcome =>
  parsePmNotes(readPmNotesFixture(relative), relative);

export const cloneValue = <T>(value: T): T => structuredClone(value);

/** Run the rules over a deep clone with a mutation and a planted canary. */
export const mutated = (
  base: PmNotesParseOutcome,
  canary: string,
  mutate: (document: Record<string, unknown>) => void,
): PmNotesParseOutcome => {
  if (!base.ok) throw new Error("cannot mutate a parse failure");
  const value = cloneValue(base.value) as Record<string, unknown>;
  value.planted_payload = canary;
  mutate(value);
  return { ok: true, value };
};

export const documentOf = (outcome: PmNotesParseOutcome): Record<string, unknown> => {
  if (!outcome.ok) throw new Error("expected parsed document");
  return outcome.value as Record<string, unknown>;
};

export const phasesOf = (document: Record<string, unknown>): Record<string, unknown> => {
  const phases = document.phases;
  if (typeof phases !== "object" || phases === null || Array.isArray(phases)) {
    throw new Error("expected phases map");
  }
  return phases as Record<string, unknown>;
};

export const entryOf = (
  document: Record<string, unknown>,
  phaseId: string,
): Record<string, unknown> => {
  const entry = phasesOf(document)[phaseId];
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    throw new Error(`expected phase entry ${phaseId}`);
  }
  return entry as Record<string, unknown>;
};
