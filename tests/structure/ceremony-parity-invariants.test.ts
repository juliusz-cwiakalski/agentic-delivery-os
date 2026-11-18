/**
 * TC-CEREMONY-011 (structure half) — parity is a property, not a claim: the six
 * built-ins are declarations on one contract, no per-ceremony branch exists, the
 * follow-through position is load-bearing, and the scope-key derivations are the
 * declared four-repository/two-note split.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BUILTIN_CEREMONY_DECLARATIONS,
  BUILTIN_CEREMONY_IDS,
  builtinCeremonyDeclaration,
  CEREMONY_SCOPE_KEY_KINDS,
  CEREMONY_STEP_KINDS,
  CEREMONY_VERIFICATION_MODES,
} from "../../packages/core/src/contracts/index";
import {
  ceremonyFollowThroughFirst,
  retroDeclarationShape,
  validateCeremonyDeclaration,
} from "../../packages/core/src/domain/index";

const ROOT = process.cwd();
const ENGINE = "packages/core/src/domain/ceremony-run.ts";

const perCeremonyBranchViolations = (text: string): readonly string[] => {
  const violations: string[] = [];
  for (const match of text.matchAll(
    /(?:declaration|ceremony)\.id\s*===\s*"([^"]+)"|case\s+"([a-z][a-z0-9-]*)":/g,
  )) {
    violations.push(match[0]);
  }
  return violations;
};

describe("TC-CEREMONY-011 the six built-ins share one contract", () => {
  test("the declared id set is exactly the six and each validates", () => {
    expect(BUILTIN_CEREMONY_IDS).toEqual([
      "morning-brief",
      "retro-evidence-pass",
      "sprint-rollover",
      "night-watch",
      "testing-session-assessment",
      "decision-record-mirror-sync",
    ]);
    for (const declaration of BUILTIN_CEREMONY_DECLARATIONS) {
      expect(validateCeremonyDeclaration(declaration).ok, declaration.id).toBe(true);
    }
  });

  test("every step names a declared kind and verification mode, and every output a schema", () => {
    for (const declaration of BUILTIN_CEREMONY_DECLARATIONS) {
      for (const phase of declaration.agenda) {
        for (const step of phase.steps) {
          expect(CEREMONY_STEP_KINDS).toContain(step.kind as never);
          expect(CEREMONY_VERIFICATION_MODES).toContain(step.verify as never);
          expect(step.outputs.length).toBeGreaterThan(0);
          for (const output of step.outputs) expect(output.schema.length).toBeGreaterThan(0);
        }
      }
    }
  });

  test("four built-ins derive their key from the repository and two from a note", () => {
    const derivations = BUILTIN_CEREMONY_DECLARATIONS.map(
      (declaration) => declaration.scopeKey.kind,
    );
    expect(derivations.filter((kind) => kind === "repository")).toHaveLength(4);
    expect(derivations.filter((kind) => kind === "note")).toHaveLength(2);
    for (const kind of derivations) expect(CEREMONY_SCOPE_KEY_KINDS).toContain(kind as never);
    for (const declaration of BUILTIN_CEREMONY_DECLARATIONS) {
      if (declaration.scopeKey.kind === "note") {
        expect(declaration.note?.required).toBe(true);
      }
    }
  });

  test("no per-ceremony branch exists in the runner and a planted branch fails", () => {
    const engine = readFileSync(join(ROOT, ENGINE), "utf8");
    expect(perCeremonyBranchViolations(engine)).toEqual([]);
    const mutant = `${engine}\nif (declaration.id === "morning-brief") { return null; }\n`;
    expect(perCeremonyBranchViolations(mutant).length).toBeGreaterThan(0);
  });
});

describe("TC-CEREMONY-011 the retro declaration keeps follow-through first", () => {
  test("the first phase is follow-through verification and the trigger set is the four levels", () => {
    const retro = builtinCeremonyDeclaration("retro-evidence-pass");
    if (retro === undefined) throw new Error("retro declaration missing");
    expect(ceremonyFollowThroughFirst(retro)).toBe(true);
    const shape = retroDeclarationShape(retro);
    expect(shape.levels).toEqual(["session", "incident", "window", "project"]);
    expect(shape.declaresChangeMerged).toBe(false);
  });

  test("moving the follow-through phase fails the position assertion", () => {
    const retro = builtinCeremonyDeclaration("retro-evidence-pass");
    if (retro === undefined) throw new Error("retro declaration missing");
    const moved = {
      ...retro,
      agenda: [...retro.agenda].reverse(),
    };
    expect(ceremonyFollowThroughFirst(moved)).toBe(false);
  });
});
