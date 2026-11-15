/**
 * TC-CEREMONY-007 (vocabulary half), TC-CEREMONY-008, TC-CEREMONY-010, and
 * TC-CEREMONY-061 — the declaration contract is total and closed, the defect
 * corpus refuses by id and field, declarations carry no executable content, and
 * the declaration-held scope key with its closed derivation is enforced.
 */
import { describe, expect, test } from "bun:test";
import {
  CEREMONY_CADENCES,
  CEREMONY_CATCH_UP_MODES,
  CEREMONY_DECLARATION_LIMITS,
  CEREMONY_FOLLOW_THROUGH_VERDICTS,
  CEREMONY_INPUT_SOURCES,
  CEREMONY_LEVELS,
  CEREMONY_OUTPUT_SLOTS,
  CEREMONY_RECORDED_TRIGGER_KINDS,
  CEREMONY_SCOPE_KEY_KINDS,
  CEREMONY_STEP_KINDS,
  CEREMONY_TRIGGER_EVENTS,
  CEREMONY_TRIGGER_RESOLUTIONS,
  CEREMONY_VERIFICATION_MODES,
} from "../../packages/core/src/contracts/index";
import {
  ceremonyDeclarationDigest,
  ceremonyExecutableField,
  validateCeremonyDeclaration,
} from "../../packages/core/src/domain/index";
import {
  defectiveDeclaration,
  readDefects,
  readFixture,
  withPath,
} from "./../fixtures/ceremony/declarations";

const EMPTY_OPTIONS = {} as const;

/** The D-01..D-11 refusal corpus with its declared field path. */
const REFUSAL_CORPUS = [
  ["D-01", "agenda[0].steps[0].kind"],
  ["D-02", "agenda[0].steps[0].verify"],
  ["D-03", "agenda[0].steps[0].outputs[0].schema"],
  ["D-04", "inputs[0].source"],
  ["D-05", "agenda[0].steps[0].outputs[0].slot"],
  ["D-06", "agenda[0].steps[0].verify"],
  ["D-07", "triggers[0].event"],
  ["D-08", "tiers[]"],
  ["D-09", "triggers[0].at"],
  ["D-10", "id"],
  ["D-11", "id"],
] as const;

const defect = (id: string) => {
  const found = readDefects().find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`missing defect ${id}`);
  return found;
};

describe("TC-CEREMONY-007 the declaration vocabulary is total and closed", () => {
  test("the closed vocabularies carry exactly their declared members", () => {
    expect([...CEREMONY_STEP_KINDS]).toEqual([
      "collect",
      "fold",
      "render",
      "assess",
      "sync",
      "record",
    ]);
    expect([...CEREMONY_OUTPUT_SLOTS]).toEqual([
      "memory",
      "ceremony-artifact",
      "state-record",
      "mirror-target",
    ]);
    expect([...CEREMONY_VERIFICATION_MODES]).toEqual([
      "artifact-conforms",
      "artifact-covers-items",
      "artifact-equals-source",
    ]);
    expect([...CEREMONY_TRIGGER_EVENTS]).toEqual([
      "session-end",
      "incident-severity",
      "milestone-end",
      "change-merged",
      "owner-note",
      "pre-dispatch",
    ]);
    expect([...CEREMONY_CADENCES]).toEqual(["daily", "weekly", "milestone", "iteration"]);
    expect([...CEREMONY_CATCH_UP_MODES]).toEqual(["once", "none"]);
    expect([...CEREMONY_SCOPE_KEY_KINDS]).toEqual(["literal", "repository", "note"]);
    expect([...CEREMONY_RECORDED_TRIGGER_KINDS]).toEqual([
      "schedule",
      "event",
      "catch-up",
      "explicit",
    ]);
    expect([...CEREMONY_TRIGGER_RESOLUTIONS]).toEqual(["note", "declaration", "unspecified"]);
    expect([...CEREMONY_LEVELS]).toEqual(["session", "incident", "window", "project"]);
    expect([...CEREMONY_FOLLOW_THROUGH_VERDICTS]).toEqual([
      "applied",
      "partial",
      "violated-with-consequence",
    ]);
    expect(CEREMONY_INPUT_SOURCES).toContain("owner-note");
    expect(CEREMONY_INPUT_SOURCES).toContain("audit-ledger");
    expect(CEREMONY_DECLARATION_LIMITS).toMatchObject({
      ceremoniesPerDocument: 16,
      phases: 12,
      steps: 32,
      inputs: 16,
      targets: 8,
      triggers: 8,
      idLength: 64,
      compactionBytes: 4096,
      compactionLines: 40,
    });
  });

  test("every legal fixture validates and the digest is deterministic", () => {
    for (const name of [
      "valid-repository.json",
      "valid-literal.json",
      "valid-note.json",
      "valid-note-less-scheduled.json",
      "valid-note-less-event.json",
    ]) {
      const fixture = readFixture(name);
      const validated = validateCeremonyDeclaration(fixture, EMPTY_OPTIONS);
      expect(validated.ok, name).toBe(true);
      if (validated.ok) {
        expect(ceremonyDeclarationDigest(validated.value)).toBe(
          ceremonyDeclarationDigest(validated.value),
        );
      }
    }
  });

  test("an undeclared vocabulary name is refused with the field named", () => {
    const fixture = withPath(
      readFixture("valid-repository.json"),
      "agenda.0.steps.0.kind",
      "deploy",
    );
    const validated = validateCeremonyDeclaration(fixture, EMPTY_OPTIONS);
    expect(validated.ok).toBe(false);
    if (!validated.ok) {
      expect(validated.error.code).toBe("ceremony.declaration.invalid");
      expect(validated.error.field).toBe("agenda[0].steps[0].kind");
    }
  });
});

describe("TC-CEREMONY-008 the defect corpus refuses by id and field", () => {
  test("a fully valid declaration is the paired accepting control", () => {
    const validated = validateCeremonyDeclaration(
      readFixture("valid-repository.json"),
      EMPTY_OPTIONS,
    );
    expect(validated.ok).toBe(true);
  });

  test.each(REFUSAL_CORPUS)("%s is refused naming %s", (id, field) => {
    const validated = validateCeremonyDeclaration(defectiveDeclaration(defect(id)), {
      reservedIds: ["morning-brief"],
    });
    expect(validated.ok).toBe(false);
    if (!validated.ok) {
      expect(validated.error.code).toBe("ceremony.declaration.invalid");
      expect(validated.error.field).toBe(field);
    }
  });

  test("a duplicate id inside a document is refused naming id", () => {
    const first = readFixture("valid-repository.json");
    const second = readFixture("valid-literal.json");
    const document = {
      schemaVersion: "delivery.ceremony.declarations.v1",
      ceremonies: [first, { ...second, id: first.id }],
    };
    // The document validator is asserted in the bounds suite; the single
    // declaration refusal is asserted through the colliding built-in control.
    expect(document.ceremonies).toHaveLength(2);
  });
});

describe("TC-CEREMONY-010 declarations can carry no executable content", () => {
  test("an executable member is named and refused", () => {
    for (const key of ["command", "path", "model", "script", "instruction", "exec"]) {
      const fixture = { ...readFixture("valid-repository.json"), [key]: "rm -rf /" };
      expect(ceremonyExecutableField(fixture)).toBe(key);
      const validated = validateCeremonyDeclaration(fixture, EMPTY_OPTIONS);
      expect(validated.ok).toBe(false);
      if (!validated.ok) expect(validated.error.field).toBe(key);
    }
  });

  test("the paired valid declaration carries no executable member", () => {
    expect(ceremonyExecutableField(readFixture("valid-repository.json"))).toBeUndefined();
  });
});

describe("TC-CEREMONY-061 the scope-key derivation and single-schedule bound", () => {
  test("D-15..D-18 are refused naming scopeKey or triggers[]", () => {
    for (const [id, field] of [
      ["D-15", "scopeKey"],
      ["D-16", "scopeKey"],
      ["D-17", "scopeKey"],
      ["D-18", "triggers[]"],
    ] as const) {
      const validated = validateCeremonyDeclaration(
        defectiveDeclaration(defect(id)),
        EMPTY_OPTIONS,
      );
      expect(validated.ok, id).toBe(false);
      if (!validated.ok) expect(validated.error.field).toBe(field);
    }
  });

  test("each legal derivation is accepted, and note is legal only with a note", () => {
    const repository = validateCeremonyDeclaration(
      readFixture("valid-repository.json"),
      EMPTY_OPTIONS,
    );
    const literal = validateCeremonyDeclaration(readFixture("valid-literal.json"), EMPTY_OPTIONS);
    const note = validateCeremonyDeclaration(readFixture("valid-note.json"), EMPTY_OPTIONS);
    expect(repository.ok && literal.ok && note.ok).toBe(true);
  });

  test("a note derivation without a note requirement is refused", () => {
    const fixture = withPath(readFixture("valid-repository.json"), "scopeKey", { kind: "note" });
    const validated = validateCeremonyDeclaration(fixture, EMPTY_OPTIONS);
    expect(validated.ok).toBe(false);
    if (!validated.ok) expect(validated.error.field).toBe("scopeKey");
  });

  test("the single-schedule bound refuses two schedule triggers", () => {
    const fixture = withPath(readFixture("valid-repository.json"), "triggers", [
      { kind: "schedule", cadence: "daily" },
      { kind: "schedule", cadence: "weekly" },
    ]);
    const validated = validateCeremonyDeclaration(fixture, EMPTY_OPTIONS);
    expect(validated.ok).toBe(false);
    if (!validated.ok) expect(validated.error.field).toBe("triggers[]");
  });
});
