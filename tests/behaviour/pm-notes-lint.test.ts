/**
 * TC-LINT-005 / TC-LINT-006 — variant semantics, pinned LITE omissions, and
 * opaque-key acceptance at rule level.
 *
 * LITE omission fixtures are derived from the committed lite-six control so each
 * case omits exactly one pinned phase; the same test restores it. Opaque extras
 * are proven never inspected while the same shapes on applicable entries fail.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LITE_REQUIRED_PHASES } from "../../packages/core/src/contracts/index";
import { lintPmNotes } from "../../packages/core/src/domain/pm-notes-lint";
import { documentOf, entryOf, loadPmNotes, mutated, parsePmNotes } from "./pm-notes-lint-support";

const CANARY = "planted-payload-variant-0002";
const LITE = loadPmNotes("valid/lite-six.yaml");
const FULL = loadPmNotes("valid/full-complete.yaml");

const failureOf = (value: Parameters<typeof lintPmNotes>[0]) => {
  const verdict = lintPmNotes(value);
  if (verdict.ok) throw new Error("expected a finding");
  return verdict.finding;
};

describe("TC-LINT-005 LITE required-phase omissions", () => {
  for (const phase of LITE_REQUIRED_PHASES) {
    test(`omitting ${phase} fails lint.phases.incomplete naming exactly it`, () => {
      const finding = failureOf(
        mutated(LITE, CANARY, (document) => {
          const phases = document.phases as Record<string, unknown>;
          delete phases[phase];
        }),
      );
      expect(finding.code).toBe("lint.phases.incomplete");
      expect(finding.offenders).toEqual([phase]);
      expect(JSON.stringify(finding)).not.toContain(CANARY);
    });
  }

  test("restoring each omitted phase passes (restored control)", () => {
    for (const phase of LITE_REQUIRED_PHASES) {
      const document = documentOf(LITE);
      const phases = { ...(document.phases as Record<string, unknown>) };
      phases[phase] = { started: null, completed: null };
      expect(lintPmNotes({ ok: true, value: { ...document, phases } })).toEqual({
        ok: true,
        variant: "lite",
      });
    }
  });

  test("the all-six control passes and non-required phases are not required", () => {
    expect(lintPmNotes(LITE)).toEqual({ ok: true, variant: "lite" });
    const withOpaque = mutated(LITE, CANARY, (document) => {
      (document.phases as Record<string, unknown>).test_planning = "plain string";
    });
    expect(lintPmNotes(withOpaque)).toEqual({ ok: true, variant: "lite" });
  });

  test("a two-phase omission names both missing phases", () => {
    const finding = failureOf(
      mutated(LITE, CANARY, (document) => {
        const phases = document.phases as Record<string, unknown>;
        delete phases.dod_check;
        delete phases.pr_creation;
      }),
    );
    expect(finding.code).toBe("lint.phases.incomplete");
    expect(finding.offenders.sort()).toEqual(["dod_check", "pr_creation"]);
  });
});

describe("TC-LINT-006 variant semantics and opaque keys", () => {
  test("absent variant means full: omitting a canonical phase fails", () => {
    const finding = failureOf(
      mutated(FULL, CANARY, (document) => {
        delete (document.phases as Record<string, unknown>).test_planning;
      }),
    );
    expect(finding.code).toBe("lint.phases.incomplete");
    expect(finding.offenders).toEqual(["test_planning"]);
  });

  test("explicit full requires the canonical eleven", () => {
    const finding = failureOf(
      mutated(FULL, CANARY, (document) => {
        document.variant = "full";
        delete (document.phases as Record<string, unknown>).review_fix;
      }),
    );
    expect(finding.code).toBe("lint.phases.incomplete");
    expect(finding.offenders).toEqual(["review_fix"]);
  });

  test("declaring lite while keeping only the six control passes", () => {
    expect(lintPmNotes(LITE)).toEqual({ ok: true, variant: "lite" });
  });

  test("opaque extra entries, extra top-level keys, and non-canonical phases pass", () => {
    expect(lintPmNotes(loadPmNotes("valid/full-with-opaque-extras.yaml"))).toEqual({
      ok: true,
      variant: "full",
    });
    expect(lintPmNotes(loadPmNotes("opaque/non-canonical-phase.yaml"))).toEqual({
      ok: true,
      variant: "full",
    });
  });

  test("opaque phase keys are never inspected, even with entry-like shapes", () => {
    const opaque = mutated(FULL, CANARY, (document) => {
      (document.phases as Record<string, unknown>).ci_remediation = {
        started: 42,
        completed: {},
        reason: ["not", "inspected"],
      };
    });
    expect(lintPmNotes(opaque)).toEqual({ ok: true, variant: "full" });
  });

  test("the same missing/typed defects on an applicable entry still fail", () => {
    const missing = failureOf(
      mutated(FULL, CANARY, (document) => {
        delete entryOf(document, "review_fix").started;
      }),
    );
    expect(missing.code).toBe("lint.keys.missing");
    expect(missing.offenders).toEqual(["review_fix.started"]);

    const wrongType = failureOf(
      mutated(FULL, CANARY, (document) => {
        entryOf(document, "review_fix").completed = 42;
      }),
    );
    expect(wrongType.code).toBe("lint.notes.malformed");
    expect(wrongType.offenders).toEqual(["review_fix.completed"]);
  });

  test("the committed GH-170 pm-notes passes as the real opaque-extra control", () => {
    const path = join(
      process.cwd(),
      "doc/changes/2026-10/2026-10-29--GH-170--monorepo-scaffold-toolchain/chg-GH-170-pm-notes.yaml",
    );
    expect(lintPmNotes(parsePmNotes(readFileSync(path, "utf8"), path))).toEqual({
      ok: true,
      variant: "full",
    });
  });

  test("GH-179's own pm-notes conforms (A-T8 corpus membership)", () => {
    const path = join(
      process.cwd(),
      "doc/changes/2026-10/2026-10-31--GH-179--pm-notes-registry-lint-phase-transitions/chg-GH-179-pm-notes.yaml",
    );
    expect(lintPmNotes(parsePmNotes(readFileSync(path, "utf8"), path))).toEqual({
      ok: true,
      variant: "full",
    });
  });
});
