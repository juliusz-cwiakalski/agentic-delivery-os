/**
 * TC-F7-005 / AC-F7-4 — the defect-suite presence and control-shape meta-check
 * (spec §24.6 Appendix F; RSK-TP-8, RSK-TP-10, M74/M75/M99).
 *
 * A defect suite is a proof only if it can fail. This case declares, per suite,
 * the primary assertions and the control it must carry, then checks the files:
 *
 * - every declared assertion id is present exactly once as a tag, and every tag
 *   is declared — a removed assertion, or a tag with no declaration, fails
 *   naming the suite and the id;
 * - every control declares its SHAPE (`substituted-derivation` for the three
 *   defect suites; `derived-comparison` or `deliberately-broken-double` for the
 *   seven queue properties), and the control-differs assertion that makes a
 *   control returning the production value a named failure;
 * - none of the three suites re-runs old code: they substitute a derivation, a
 *   declaration or an attempt, and import no child-process seam;
 * - the two metrics are reported separately — **3/3** named defects with a
 *   defect-named regression and **7/7** queue property suites with a declared
 *   control shape.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  QUEUE_INTEGRITY_CONTROL_SHAPE_BY_PROPERTY,
  QUEUE_INTEGRITY_CONTROL_SHAPES,
  QUEUE_INTEGRITY_PROPERTIES,
} from "../fixtures/queue/integrity-breaches";

const ROOT = process.cwd();

/** One declared primary assertion plus the control the suite must carry. */
type DefectSuite = {
  readonly file: string;
  readonly defect: "F1" | "F4" | "F8";
  readonly assertions: readonly string[];
  readonly control: {
    readonly id: string;
    readonly shape: "substituted-derivation" | "value-substitution";
    /** The assertion that makes a control equal to production fail by name. */
    readonly differsSnippet: string;
  };
  /** The pre-fix artefact the control substitutes (never re-runs). */
  readonly substitutes: string;
};

const DEFECT_SUITES: readonly DefectSuite[] = [
  {
    file: "tests/structure/defect-f1-merge-refusal-containment.test.ts",
    defect: "F1",
    assertions: [
      "f1.declaration-exhaustive-over-emitted-family",
      "f1.gate-family-code-kind-exit",
      "f1.two-additive-rows-declared",
      "f1.members-resolve-to-their-own-kind",
      "f1.containment-absent-from-live-outcome",
      "f1.mismatch-control-still-contains",
    ],
    control: {
      id: "f1.declaration-removed",
      shape: "value-substitution",
      differsSnippet: "expect(preFix.length).toBeGreaterThan(0);",
    },
    substitutes: "PRE-FIX DECLARATION",
  },
  {
    file: "tests/behaviour/defect-f4-phase-mirror.test.ts",
    defect: "F4",
    assertions: [
      "f4.second-completion-on-three-surfaces",
      "f4.no-op-reports-the-fold",
      "f4.hand-edited-completion-is-named",
      "f4.document-only-completion-is-excluded",
      "f4.detection-performs-zero-writes-and-fences",
    ],
    control: {
      id: "f4.substituted-history-lookup",
      shape: "substituted-derivation",
      differsSnippet: "expect(retired).not.toBe(secondCompletion);",
    },
    substitutes: "pre-fix derivation",
  },
  {
    file: "tests/behaviour/defect-f8-serial-merge-churn.test.ts",
    defect: "F8",
    assertions: [
      "f8.one-landing-per-invocation",
      "f8.zero-head-mutations",
      "f8.no-rebase-attempt",
      "f8.typed-sync-refusals",
      "f8.control-differs-from-production",
    ],
    control: {
      id: "f8.substituted-prefix-refresh",
      shape: "substituted-derivation",
      differsSnippet:
        "expect(differs.preFixHeadMutations).not.toBe(differs.productionHeadMutations);",
    },
    substitutes: "PRE-FIX ATTEMPT",
  },
];

const QUEUE_SUITE = "tests/behaviour/queue-integrity.test.ts";

const sourceOf = (file: string): string => readFileSync(join(ROOT, file), "utf8");

/** The assertion tags a file carries, in file order. */
const assertionTags = (text: string): readonly string[] =>
  [...text.matchAll(/^\s*\/\/ assertion: ([a-z0-9.-]+)\s*$/gmu)].map((match) => match[1] as string);

/** The control tag a file carries, as `id` and `shape`. */
const controlTag = (text: string): { readonly id: string; readonly shape: string } | undefined => {
  const match = /^\s*\/\/ control: ([a-z0-9.-]+) shape=([a-z-]+)\s*$/mu.exec(text);
  return match === null ? undefined : { id: match[1] as string, shape: match[2] as string };
};

/** Every declared assertion missing from, or undeclared in, one suite. */
const registryViolations = (suite: DefectSuite, text: string): readonly string[] => {
  const violations: string[] = [];
  const tags = assertionTags(text);
  for (const id of suite.assertions) {
    const occurrences = tags.filter((tag) => tag === id).length;
    if (occurrences !== 1) {
      violations.push(`${suite.file}: assertion ${id} is tagged ${occurrences} times`);
    }
  }
  for (const tag of tags) {
    if (!suite.assertions.includes(tag)) {
      violations.push(`${suite.file}: assertion ${tag} is not declared in the registry`);
    }
  }
  const control = controlTag(text);
  if (control === undefined) {
    violations.push(`${suite.file}: control ${suite.control.id} is missing`);
  } else {
    if (control.id !== suite.control.id) {
      violations.push(`${suite.file}: control is ${control.id}, declared ${suite.control.id}`);
    }
    if (control.shape !== suite.control.shape) {
      violations.push(
        `${suite.file}: control shape is ${control.shape}, declared ${suite.control.shape}`,
      );
    }
  }
  return violations;
};

describe("TC-F7-005 the three named defects each carry a defect-named regression", () => {
  test("every declared assertion and control is present exactly once, and nothing is undeclared", () => {
    expect(DEFECT_SUITES.map((suite) => suite.defect)).toEqual(["F1", "F4", "F8"]);
    expect(DEFECT_SUITES).toHaveLength(3);
    for (const suite of DEFECT_SUITES) {
      expect(registryViolations(suite, sourceOf(suite.file)), suite.file).toEqual([]);
      // A suite with a handful of assertions is the floor; removing one is the
      // mutation this registry exists to catch.
      expect(suite.assertions.length, suite.defect).toBeGreaterThanOrEqual(5);
    }
  });

  test("each control declares its shape and asserts a value that differs from production", () => {
    for (const suite of DEFECT_SUITES) {
      const text = sourceOf(suite.file);
      // F1's control is GH-366's value substitution (the deleted runtime
      // declaration fails by name); F4/F8 keep the substituted derivation.
      const declaredShape = suite.defect === "F1" ? "value-substitution" : "substituted-derivation";
      expect(controlTag(text)?.shape, suite.defect).toBe(declaredShape);
      // The control-differs assertion is present verbatim, so a control that
      // returns the production value fails by name instead of passing.
      expect(text, suite.defect).toContain(suite.control.differsSnippet);
      // The substitution is textual and named: the suite substitutes the named
      // pre-fix artefact and claims no execution of pre-fix code from an
      // earlier commit (the child-process scan below enforces the mechanism).
      expect(text.toLowerCase(), suite.defect).toContain("substitute");
      expect(text.toLowerCase(), suite.defect).toContain(suite.substitutes.toLowerCase());
      expect(text.toLowerCase(), suite.defect).toContain("pre-fix");
    }
  });

  test("no defect suite re-runs old code through a child-process seam", () => {
    for (const suite of DEFECT_SUITES) {
      const text = sourceOf(suite.file);
      for (const forbidden of ["child_process", "execSync", "execFileSync", "spawnSync"]) {
        expect(text, `${suite.file}: ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  test("removing one assertion tag fails naming the suite and the missing id", () => {
    for (const suite of DEFECT_SUITES) {
      const target = suite.assertions[0] as string;
      const mutated = sourceOf(suite.file)
        .split("\n")
        .filter((line) => line.trim() !== `// assertion: ${target}`)
        .join("\n");
      expect(mutated).not.toBe(sourceOf(suite.file));
      const violations = registryViolations(suite, mutated);
      expect(violations.join("\n")).toContain(`assertion ${target} is tagged 0 times`);
    }
  });
});

describe("TC-F7-005 the two metrics are reported separately and honestly", () => {
  test("3/3 named defects carry a defect-named regression with a declared shape", () => {
    const shaped = DEFECT_SUITES.filter((suite) => {
      const shape = controlTag(sourceOf(suite.file))?.shape;
      return shape === "substituted-derivation" || shape === "value-substitution";
    });
    expect(shaped).toHaveLength(3);
    expect(`${shaped.length}/${DEFECT_SUITES.length}`).toBe("3/3");
    for (const suite of DEFECT_SUITES) {
      expect(sourceOf(suite.file)).toContain("defect-");
      expect(suite.file).toContain("defect-");
    }
  });

  test("7/7 queue property suites carry a declared control shape, reported separately", () => {
    expect(QUEUE_INTEGRITY_PROPERTIES).toHaveLength(7);
    for (const property of QUEUE_INTEGRITY_PROPERTIES) {
      expect(QUEUE_INTEGRITY_CONTROL_SHAPES).toContain(
        QUEUE_INTEGRITY_CONTROL_SHAPE_BY_PROPERTY[property],
      );
    }
    expect(Object.keys(QUEUE_INTEGRITY_CONTROL_SHAPE_BY_PROPERTY)).toHaveLength(7);
    const declared = Object.values(QUEUE_INTEGRITY_CONTROL_SHAPE_BY_PROPERTY);
    expect(declared.filter((shape) => shape === "derived-comparison")).toHaveLength(3);
    expect(declared.filter((shape) => shape === "deliberately-broken-double")).toHaveLength(4);
    const queue = sourceOf(QUEUE_SUITE);
    // The queue suite reports its own 7/7 and names the 3/3 defects as phase 7's
    // obligation, so the two counts are never conflated.
    expect(queue).toContain("7/7");
    expect(queue).toContain("3/3");
    expect(queue).toContain("property proved clean; no repair");
  });
});
