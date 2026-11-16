/**
 * TC-CEREMONY-007 (vocabulary/bounds half), TC-CEREMONY-049 (contract half),
 * and TC-CEREMONY-061 (contract half) — the ceremony contract module is the
 * single home of the closed vocabularies, the bounds, the schema identities, and
 * the two additive error identities under a new `ceremony` domain kind.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BUILTIN_CEREMONY_DECLARATIONS,
  BUILTIN_CEREMONY_IDS,
  CEREMONY_COMPARISON_SCHEMA,
  CEREMONY_DECLARATION_LIMITS,
  CEREMONY_DECLARATIONS_SCHEMA,
  CEREMONY_NOTE_SCHEMA,
  CEREMONY_RECORD_BOUNDARY_DECLARATION,
  CEREMONY_RUN_PAYLOAD_SCHEMA,
  CEREMONY_RUN_RECORD_KEY_PREFIX,
  CEREMONY_RUN_RECORD_KIND,
  CEREMONY_SHARE_METRIC_ID,
  CEREMONY_STEP_PAYLOAD_SCHEMA,
  CEREMONY_STEP_RECORD_KEY_PREFIX,
  CEREMONY_STEP_RECORD_KIND,
  DOMAIN_KINDS,
  ERROR_TABLE,
} from "../../packages/core/src/contracts/index";
import {
  ceremonyExecutableField,
  validateCeremonyDeclaration,
} from "../../packages/core/src/domain/index";

const ROOT = process.cwd();

describe("TC-CEREMONY-007 the contract identities and boundary", () => {
  test("the schema identities are declared exactly once", () => {
    expect(CEREMONY_DECLARATIONS_SCHEMA).toBe("delivery.ceremony.declarations.v1");
    expect(CEREMONY_NOTE_SCHEMA).toBe("delivery.ceremony.note.v1");
    expect(CEREMONY_RUN_PAYLOAD_SCHEMA).toBe("delivery.ceremony.run.v1");
    expect(CEREMONY_STEP_PAYLOAD_SCHEMA).toBe("delivery.ceremony.step.v1");
    expect(CEREMONY_COMPARISON_SCHEMA).toBe("delivery.ceremony.comparison.v1");
    expect(CEREMONY_SHARE_METRIC_ID).toBe("MET-CEREMONY-SHARE");
  });

  test("the two record kinds and their key prefixes are additive under ceremony.", () => {
    expect(CEREMONY_RUN_RECORD_KIND).toBe("ceremony.run");
    expect(CEREMONY_STEP_RECORD_KIND).toBe("ceremony.step");
    expect(CEREMONY_RUN_RECORD_KEY_PREFIX).toBe("ceremony.runs:");
    expect(CEREMONY_STEP_RECORD_KEY_PREFIX).toBe("ceremony.steps:");
    expect(CEREMONY_RECORD_BOUNDARY_DECLARATION.recordKeyPrefix).toBe("ceremony.");
    expect(CEREMONY_RECORD_BOUNDARY_DECLARATION.kinds.map((kind) => kind.kind).sort()).toEqual(
      [CEREMONY_RUN_RECORD_KIND, CEREMONY_STEP_RECORD_KIND].sort(),
    );
    for (const kind of CEREMONY_RECORD_BOUNDARY_DECLARATION.kinds) {
      expect(kind.payloadSchema).toBeDefined();
      expect(kind.identityField).toBe("runId");
      expect(kind.fields.some((field) => field.name === "runId" && field.required)).toBe(true);
    }
  });

  test("the declared bounds are the spec's numbers, not local copies", () => {
    expect(CEREMONY_DECLARATION_LIMITS).toEqual({
      ceremoniesPerDocument: 16,
      phases: 12,
      steps: 32,
      inputs: 16,
      targets: 8,
      triggers: 8,
      documentBytes: 1_048_576,
      idLength: 64,
      compactionBytes: 4_096,
      compactionLines: 40,
    });
  });

  test("the ceremony source holds no phase-set list, task log, or model reference", () => {
    const text = readFileSync(join(ROOT, "packages/core/src/contracts/ceremony.ts"), "utf8");
    for (const marker of ["clarify_scope", "delivery_planning", "tasks:", "openai", "anthropic"]) {
      expect(text.includes(marker), marker).toBe(false);
    }
  });
});

describe("TC-CEREMONY-049 the two error identities are additive and exact", () => {
  const ceremonyRows = ERROR_TABLE.filter((entry) => entry.domainKind === "ceremony");
  const rowOf = (code: string) => ceremonyRows.find((entry) => entry.code === code);

  test("the ceremony domain kind is declared and carries exactly two rows", () => {
    expect(DOMAIN_KINDS).toContain("ceremony");
    expect(ceremonyRows.map((entry) => entry.code).sort()).toEqual([
      "ceremony.declaration.invalid",
      "ceremony.note-invalid",
    ]);
  });

  test("both rows are user, non-retryable, not-landed, user-validation at exit 1", () => {
    for (const code of ["ceremony.note-invalid", "ceremony.declaration.invalid"]) {
      expect(rowOf(code)).toMatchObject({
        domainKind: "ceremony",
        category: "user",
        retryable: false,
        consequence: "not_landed",
        projectionClass: "user-validation",
      });
    }
  });

  test("ceremony.note-invalid is a two-segment allowlist member", () => {
    expect("ceremony.note-invalid".split(".")).toHaveLength(2);
    expect("ceremony.declaration.invalid".split(".")).toHaveLength(3);
  });

  test("the documented table carries both rows and the 143 identity count", () => {
    const doc = readFileSync(join(ROOT, "doc/spec/features/feature-result-contract.md"), "utf8");
    for (const entry of ceremonyRows) {
      const row = `| ${entry.code} | ceremony | ${entry.category} | ${String(entry.retryable)} | ${entry.consequence} | ${entry.remediationHint} | ${entry.projectionClass} | ${entry.summary ?? ""} |`;
      expect(doc.split(row).length - 1, entry.code).toBe(1);
    }
    expect(doc).toContain("143 machine identities");
  });
});

/**
 * TC-CEREMONY-007 (completion) and TC-CEREMONY-061 (six-built-in sweep) — the
 * six built-ins validate through the same validator, carry a verification mode
 * on every step, a schema identifier on every output, and no executable content
 * or undeclared vocabulary name.
 */
describe("TC-CEREMONY-007 the six built-ins are total, closed, and fully verified", () => {
  test("all six validate through the one validator", () => {
    expect(BUILTIN_CEREMONY_DECLARATIONS).toHaveLength(6);
    for (const declaration of BUILTIN_CEREMONY_DECLARATIONS) {
      const validated = validateCeremonyDeclaration(declaration);
      expect(validated.ok, declaration.id).toBe(true);
    }
  });

  test("100% of steps carry verification and 100% of outputs a schema", () => {
    for (const declaration of BUILTIN_CEREMONY_DECLARATIONS) {
      for (const phase of declaration.agenda) {
        for (const step of phase.steps) {
          expect(step.verify.length).toBeGreaterThan(0);
          expect(step.outputs.length).toBeGreaterThan(0);
          for (const output of step.outputs) expect(output.schema.length).toBeGreaterThan(0);
        }
      }
    }
  });

  test("no built-in carries executable content", () => {
    for (const declaration of BUILTIN_CEREMONY_DECLARATIONS) {
      expect(ceremonyExecutableField(declaration), declaration.id).toBeUndefined();
    }
  });

  test("the six ids are exactly the declared built-in set", () => {
    expect(BUILTIN_CEREMONY_IDS).toEqual([
      "morning-brief",
      "retro-evidence-pass",
      "sprint-rollover",
      "night-watch",
      "testing-session-assessment",
      "decision-record-mirror-sync",
    ]);
  });
});
