/**
 * TC-CEREMONY-009 — every declared declaration bound is enforced and refused by
 * name, with an at-limit accepting control for each rung (the 8/9-trigger rung
 * included), and the document bound is measured rather than assumed.
 */
import { describe, expect, test } from "bun:test";
import {
  CEREMONY_DECLARATION_LIMITS,
  type CeremonyPhaseDeclaration,
} from "../../packages/core/src/contracts/index";
import {
  validateCeremonyDeclaration,
  validateCeremonyDocument,
} from "../../packages/core/src/domain/index";
import {
  defectiveDeclaration,
  readDefects,
  readFixture,
  type UnknownRecord,
  withPath,
} from "./../fixtures/ceremony/declarations";

const base = (): UnknownRecord => readFixture("valid-repository.json");

const step = (kind: string): unknown => ({
  kind,
  outputs: [{ slot: "ceremony-artifact", schema: "delivery.ceremony.bound.v1" }],
  verify: "artifact-conforms",
});

const phase = (index: number): CeremonyPhaseDeclaration => ({
  id: `phase-${String(index)}`,
  steps: [step("collect") as CeremonyPhaseDeclaration["steps"][number]],
});

const refusalField = (fixture: UnknownRecord): string | undefined => {
  const validated = validateCeremonyDeclaration(fixture, {});
  return validated.ok ? undefined : validated.error.field;
};

describe("TC-CEREMONY-009 declaration bounds are measured and refused", () => {
  test("12 phases are accepted; 13 are refused naming the phase bound", () => {
    const atLimit = withPath(
      base(),
      "agenda",
      Array.from({ length: CEREMONY_DECLARATION_LIMITS.phases }, (_, index) => phase(index)),
    );
    expect(refusalField(atLimit)).toBeUndefined();
    const over = withPath(
      base(),
      "agenda",
      Array.from({ length: CEREMONY_DECLARATION_LIMITS.phases + 1 }, (_, index) => phase(index)),
    );
    expect(refusalField(over)).toBe("agenda[]");
  });

  test("32 steps are accepted; 33 are refused naming the step bound", () => {
    const steps = Array.from({ length: CEREMONY_DECLARATION_LIMITS.steps }, () => step("collect"));
    const atLimit = withPath(base(), "agenda", [{ id: "one", steps }]);
    expect(refusalField(atLimit)).toBeUndefined();
    const over = withPath(base(), "agenda", [{ id: "one", steps: [...steps, step("collect")] }]);
    expect(refusalField(over)).toBe("agenda[].steps[]");
  });

  test("16 inputs are accepted; 17 are refused naming the input bound", () => {
    const inputs = Array.from({ length: CEREMONY_DECLARATION_LIMITS.inputs }, () => ({
      source: "audit-ledger",
    }));
    expect(refusalField(withPath(base(), "inputs", inputs))).toBeUndefined();
    expect(refusalField(withPath(base(), "inputs", [...inputs, { source: "queue-state" }]))).toBe(
      "inputs[]",
    );
  });

  test("8 mirror targets are accepted; 9 are refused naming the target bound", () => {
    const stepWithTargets = (count: number) => ({
      kind: "sync",
      outputs: Array.from({ length: count }, () => ({
        slot: "mirror-target",
        schema: "delivery.ceremony.mirror.v1",
      })),
      verify: "artifact-equals-source",
    });
    expect(
      refusalField(withPath(base(), "agenda", [{ id: "one", steps: [stepWithTargets(8)] }])),
    ).toBeUndefined();
    expect(
      refusalField(withPath(base(), "agenda", [{ id: "one", steps: [stepWithTargets(9)] }])),
    ).toBe("agenda[].outputs[]");
  });

  test("8 triggers are accepted; 9 are refused, and two schedules are refused at any count", () => {
    const triggers = Array.from({ length: CEREMONY_DECLARATION_LIMITS.triggers }, () => ({
      kind: "event",
      event: "owner-note",
    }));
    expect(refusalField(withPath(base(), "triggers", triggers))).toBeUndefined();
    expect(
      refusalField(
        withPath(base(), "triggers", [...triggers, { kind: "event", event: "owner-note" }]),
      ),
    ).toBe("triggers[]");
    expect(
      refusalField(
        withPath(base(), "triggers", [
          { kind: "schedule", cadence: "daily" },
          { kind: "schedule", cadence: "weekly" },
        ]),
      ),
    ).toBe("triggers[]");
  });

  test("a 64-character id is accepted; 65 characters is refused", () => {
    const atLimit = withPath(base(), "id", `a${"b".repeat(63)}`);
    expect(refusalField(atLimit)).toBeUndefined();
    expect(refusalField(withPath(base(), "id", `a${"b".repeat(64)}`))).toBe("id");
  });

  test("a document over 1 MiB is refused naming the document bound", () => {
    const declaration = base();
    const document = {
      schemaVersion: "delivery.ceremony.declarations.v1",
      ceremonies: [
        { ...declaration, title: "a".repeat(CEREMONY_DECLARATION_LIMITS.documentBytes) },
      ],
    };
    const validated = validateCeremonyDocument(document, {});
    expect(validated.ok).toBe(false);
    if (!validated.ok) expect(validated.error.field).toBe("document");
  });

  test("17 ceremonies are refused naming the document count bound", () => {
    const declaration = readFixture("valid-literal.json");
    const document = {
      schemaVersion: "delivery.ceremony.declarations.v1",
      ceremonies: Array.from({ length: 17 }, (_, index) => ({
        ...declaration,
        id: `project-ceremony-${String(index)}`,
      })),
    };
    const validated = validateCeremonyDocument(document, {});
    expect(validated.ok).toBe(false);
    if (!validated.ok) expect(validated.error.field).toBe("ceremonies[]");
  });

  test("16 ceremonies are the accepting control", () => {
    const declaration = readFixture("valid-literal.json");
    const document = {
      schemaVersion: "delivery.ceremony.declarations.v1",
      ceremonies: Array.from({ length: 16 }, (_, index) => ({
        ...declaration,
        id: `project-ceremony-${String(index)}`,
      })),
    };
    expect(validateCeremonyDocument(document, {}).ok).toBe(true);
  });

  test("a duplicated id and a built-in collision are refused naming id", () => {
    const declaration = readFixture("valid-repository.json");
    const duplicate = {
      schemaVersion: "delivery.ceremony.declarations.v1",
      ceremonies: [declaration, { ...declaration }],
    };
    const validated = validateCeremonyDocument(duplicate, {});
    expect(validated.ok).toBe(false);
    if (!validated.ok) expect(validated.error.field).toBe("id");
    const collision = {
      schemaVersion: "delivery.ceremony.declarations.v1",
      ceremonies: [{ ...declaration, id: "morning-brief" }],
    };
    const refused = validateCeremonyDocument(collision, { reservedIds: ["morning-brief"] });
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.error.field).toBe("id");
      expect(refused.error.summary).toContain("collides with a built-in");
    }
  });

  test("D-12's committed corpus entries are exercised through the same bounds", () => {
    for (const id of ["D-01", "D-08", "D-18"]) {
      const fixture = readDefects().find((entry) => entry.id === id);
      if (fixture === undefined) throw new Error(`missing defect ${id}`);
      expect(validateCeremonyDeclaration(defectiveDeclaration(fixture), {}).ok).toBe(false);
    }
  });
});
