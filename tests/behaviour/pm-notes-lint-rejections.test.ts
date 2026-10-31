/**
 * TC-LINT-001 / TC-LINT-002 / TC-LINT-003 — rule-level rejection classes.
 *
 * Each negative case asserts exactly one pinned identity, a named location and
 * the full offender set; each is paired with a restored/valid control. Every
 * derived fixture carries a planted canary that must not reach the verdict.
 */
import { describe, expect, test } from "bun:test";
import { lintPmNotes, type PmNotesLintVerdict } from "../../packages/core/src/domain/pm-notes-lint";
import {
  documentOf,
  entryOf,
  loadPmNotes,
  mutated,
  parsePmNotes,
  phasesOf,
  readPmNotesFixture,
} from "./pm-notes-lint-support";

const CANARY = "planted-payload-lint-0001";
const BASE = loadPmNotes("valid/full-complete.yaml");

const expectFinding = (
  verdict: PmNotesLintVerdict,
  code: string,
): Extract<PmNotesLintVerdict, { ok: false }>["finding"] => {
  expect(verdict.ok).toBe(false);
  if (verdict.ok) throw new Error(`expected ${code}`);
  expect(verdict.finding.code).toBe(code as never);
  expect(JSON.stringify(verdict)).not.toContain(CANARY);
  return verdict.finding;
};

describe("TC-LINT-001 malformed syntax and non-conforming value types", () => {
  test("the committed base fixture is valid (control)", () => {
    expect(lintPmNotes(BASE)).toEqual({ ok: true, variant: "full" });
  });

  test("an unparseable document fails lint.notes.malformed without leaking bytes", () => {
    const source = readPmNotesFixture("malformed/unparseable-orphaned-indentation.yaml.txt");
    expect(source).toContain("planted-payload-unparseable-0001");
    const verdict = lintPmNotes(parsePmNotes(source, "unparseable.yaml"));
    const finding = expectFinding(verdict, "lint.notes.malformed");
    expect(finding.location).toEqual({ kind: "document" });
    expect(JSON.stringify(verdict)).not.toContain("planted-payload-unparseable-0001");
  });

  const malformedCases: Array<[string, (document: Record<string, unknown>) => void, string]> = [
    [
      "change_id",
      (document) => {
        document.change_id = 42;
      },
      "change_id",
    ],
    [
      "title",
      (document) => {
        document.title = ["array"];
      },
      "title",
    ],
    [
      "delivery_mode",
      (document) => {
        document.delivery_mode = false;
      },
      "delivery_mode",
    ],
    [
      "phases",
      (document) => {
        document.phases = "not-a-map";
      },
      "phases",
    ],
    [
      "started-number",
      (document) => {
        entryOf(document, "clarify_scope").started = 42;
      },
      "clarify_scope.started",
    ],
    [
      "completed-boolean",
      (document) => {
        entryOf(document, "clarify_scope").completed = true;
      },
      "clarify_scope.completed",
    ],
    [
      "started-map",
      (document) => {
        entryOf(document, "specification").started = {};
      },
      "specification.started",
    ],
    [
      "note-text",
      (document) => {
        document.notes = [{ text: 42 }];
      },
      "notes[0].text",
    ],
    [
      "decision-date",
      (document) => {
        document.decisions = [{ text: "x", date: 7 }];
      },
      "decisions[0].date",
    ],
  ];

  for (const [name, mutate, offender] of malformedCases) {
    test(`wrong-typed ${name} fails lint.notes.malformed naming ${offender}`, () => {
      const finding = expectFinding(
        lintPmNotes(mutated(BASE, CANARY, mutate)),
        "lint.notes.malformed",
      );
      expect(finding.offenders).toContain(offender);
      expect(finding.detail).toContain(offender);
    });
  }

  test("unquoted YAML 1.2 date scalars are accepted as strings", () => {
    const text = readPmNotesFixture("valid/full-complete.yaml").replace(
      'started: "2026-10-31T01:00:00Z"',
      "started: 2026-10-31T01:00:00Z",
    );
    expect(lintPmNotes(parsePmNotes(text, "dates.yaml"))).toEqual({ ok: true, variant: "full" });
  });

  test("a corrected value passes (restored control)", () => {
    const corrected = mutated(BASE, CANARY, (document) => {
      document.change_id = "GH-179";
      entryOf(document, "clarify_scope").started = null;
    });
    expect(lintPmNotes(corrected)).toEqual({ ok: true, variant: "full" });
  });
});

describe("TC-LINT-002 missing required keys, top-level and entry-level", () => {
  for (const key of ["change_id", "title", "delivery_mode", "phases"]) {
    test(`missing top-level ${key} fails lint.keys.missing naming it`, () => {
      const finding = expectFinding(
        lintPmNotes(
          mutated(BASE, CANARY, (document) => {
            delete document[key];
          }),
        ),
        "lint.keys.missing",
      );
      expect(finding.offenders).toEqual([key]);
      expect(finding.location).toEqual({ kind: "top-level", key });
    });
  }

  for (const field of ["started", "completed"] as const) {
    test(`a canonical phase entry missing ${field} fails lint.keys.missing`, () => {
      const finding = expectFinding(
        lintPmNotes(
          mutated(BASE, CANARY, (document) => {
            delete entryOf(document, "delivery")[field];
          }),
        ),
        "lint.keys.missing",
      );
      expect(finding.offenders).toEqual([`delivery.${field}`]);
      expect(finding.location).toEqual({ kind: "phase", phaseId: "delivery", field });
    });
  }

  test("a collection entry missing text fails lint.keys.missing", () => {
    const finding = expectFinding(
      lintPmNotes(
        mutated(BASE, CANARY, (document) => {
          document.notes = [{ value: "no text" }];
        }),
      ),
      "lint.keys.missing",
    );
    expect(finding.offenders).toEqual(["notes[0].text"]);
  });

  test("omitting only optional top-level keys passes", () => {
    expect(lintPmNotes(loadPmNotes("valid/optional-omissions.yaml"))).toEqual({
      ok: true,
      variant: "full",
    });
  });

  test("restoring the missing key passes (restored control)", () => {
    const restored = mutated(BASE, CANARY, (document) => {
      document.title = "restored";
      entryOf(document, "delivery").started = null;
    });
    expect(lintPmNotes(restored)).toEqual({ ok: true, variant: "full" });
  });
});

describe("TC-LINT-003 unknown variant versus wrong-typed variant", () => {
  const unknownCases: Array<[string, unknown]> = [
    ["compressed", "compressed"],
    ["LITE", "LITE"],
    ["whitespace", " lite"],
  ];
  for (const [name, value] of unknownCases) {
    test(`unknown variant ${name} fails lint.variant.unknown`, () => {
      const finding = expectFinding(
        lintPmNotes(
          mutated(BASE, CANARY, (document) => {
            document.variant = value;
          }),
        ),
        "lint.variant.unknown",
      );
      expect(finding.offenders).toEqual([value]);
      expect(finding.location).toEqual({ kind: "top-level", key: "variant" });
    });
  }

  const wrongTypeCases: Array<[string, unknown]> = [
    ["number", 1],
    ["sequence", ["lite"]],
    ["map", { name: "lite" }],
  ];
  for (const [name, value] of wrongTypeCases) {
    test(`wrong-typed variant ${name} fails lint.notes.malformed, not variant.unknown`, () => {
      const finding = expectFinding(
        lintPmNotes(
          mutated(BASE, CANARY, (document) => {
            document.variant = value;
          }),
        ),
        "lint.notes.malformed",
      );
      expect(finding.offenders).toContain("variant");
    });
  }

  test("a committed unknown-variant fixture fails exactly once", () => {
    const finding = expectFinding(
      lintPmNotes(loadPmNotes("variant/unknown-compressed.yaml")),
      "lint.variant.unknown",
    );
    expect(finding.offenders).toEqual(["compressed"]);
  });

  test("absent, explicit full, and explicit lite controls pass", () => {
    expect(lintPmNotes(BASE)).toEqual({ ok: true, variant: "full" });
    const explicitFull = mutated(BASE, CANARY, (document) => {
      document.variant = "full";
    });
    expect(lintPmNotes(explicitFull)).toEqual({ ok: true, variant: "full" });
    expect(lintPmNotes(loadPmNotes("valid/lite-six.yaml"))).toEqual({
      ok: true,
      variant: "lite",
    });
  });

  test("required phase presence is checked for the effective variant only", () => {
    const lite = documentOf(loadPmNotes("valid/lite-six.yaml"));
    expect(phasesOf(lite).test_planning).toBeUndefined();
    expect(lintPmNotes({ ok: true, value: lite })).toEqual({ ok: true, variant: "lite" });
  });
});
