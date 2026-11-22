/**
 * TC-F7-001 / TC-F7-002 / AC-F7-1 — the F1 regression, named for the defect in
 * which a declared merge refusal reached the containment identity
 * (spec §24.6 Appendix F F1; AC-F2-5, DM-2, NFR-6).
 *
 * The suite owns its oracle. It derives the set of codes the merge
 * composition's refusal branches can emit — the transaction's code literals plus
 * every instance of the declared `merge.gate.<gate-id>.failed` family over the
 * effective gate ids — and asks one totality predicate whether a declaration
 * covers that set:
 *
 * - the production declaration covers it (empty uncovered set) and expresses the
 *   family as a family, never as an enumerated gate list;
 * - a gate-family refusal carries the family code, the row's `merge` kind and
 *   exit 1, and `fallback.internal` appears in neither the outcome nor the
 *   summary of a live refusal;
 * - the two additive rows resolve to their own code/kind/exit;
 * - a live kind/code mismatch still classifies as `fallback.internal`, so the
 *   containment branch is not dead and the assertion cannot pass vacuously.
 *
 * The control SUBSTITUTES the PRE-FIX DECLARATION — the seventeen members the
 * composition declared before this change, with no family expression — for the
 * production one and runs the same predicate over it. No case executes pre-fix
 * code from an earlier commit (test plan GAP-TP-4, M73, M99); the control fails
 * by name because the family code is outside its domain.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { classifyThrown, resolveAppErrorCode } from "../../packages/cli/src/classify";
import {
  isMergeCompositionFamilyInstance,
  MERGE_COMPOSITION_EMITTABLE_CODES,
  MERGE_COMPOSITION_GATE_FAMILY,
} from "../../packages/cli/src/production";
import { projectExitCode } from "../../packages/cli/src/projection";
import {
  ERROR_TABLE,
  FALLBACK_INTERNAL_CODE,
  MERGE_DEFAULT_GATE_ENTRIES,
  MERGE_GATE_ERROR_PREFIX,
  MERGE_GATE_ERROR_SUFFIX,
} from "../../packages/core/src/contracts/index";
import { resolveMergeGateSet } from "../../packages/core/src/domain/merge-gate-set";
import { declaredGateSetWith } from "../fixtures/merge/harness";
import {
  createMergeProductionHarness,
  MERGE_PROD_REF,
  type MergeProviderReply,
} from "../fixtures/merge/production-composition";

const ROOT = process.cwd();
const TRANSACTION = "packages/core/src/domain/merge-transaction.ts";
const PRODUCTION = "packages/cli/src/production.ts";

const GATE_FAMILY_PREFIX = MERGE_GATE_ERROR_PREFIX;
const GATE_FAMILY_SUFFIX = MERGE_GATE_ERROR_SUFFIX;

/** One declared emittable set: exact members plus its family expression. */
type Declaration = {
  readonly codes: readonly string[];
  readonly family: boolean;
};

/** Whether a code is an instance of the declared gate family (a valid slot). */
const isFamilyInstance = (code: string): boolean => isMergeCompositionFamilyInstance(code);

/** Whether a declaration covers one code: exact membership or the family. */
const covers = (declaration: Declaration, code: string): boolean =>
  declaration.codes.includes(code) || (declaration.family && isFamilyInstance(code));

/** The gate ids the effective declared set can resolve, plus a declared extra. */
const effectiveGateIds = (): readonly string[] => {
  const defaultSet = resolveMergeGateSet(undefined);
  if (!defaultSet.ok) throw new Error(defaultSet.failure.detail);
  const declared = resolveMergeGateSet(
    declaredGateSetWith([
      ...MERGE_DEFAULT_GATE_ENTRIES,
      {
        id: "workspace-tests",
        recipe: "required-ci-job",
        surface: "both",
        job: "workspace-tests",
      },
    ]),
  );
  if (!declared.ok) throw new Error(declared.failure.detail);
  return [...new Set([...defaultSet.value.ids, ...declared.value.ids, "ci-required"])];
};

/** Every code the transaction's refusal branches can emit, derived from its source. */
const emittedCodes = (): readonly string[] => {
  const source = readFileSync(join(ROOT, TRANSACTION), "utf8");
  const literals = [...source.matchAll(/"((?:merge|provider|config|state|input)\.[a-z0-9.-]+)"/gu)]
    .map((match) => match[1] as string)
    // The declared prefix is a matcher, not an emitted code.
    .filter((code) => code !== GATE_FAMILY_PREFIX)
    // A documented statement inside the source is not an emitted code.
    .filter((code) => !code.endsWith("."));
  const family = effectiveGateIds().map((id) => `${GATE_FAMILY_PREFIX}${id}${GATE_FAMILY_SUFFIX}`);
  return [...new Set([...literals, ...family])];
};

/** The uncovered codes of one declaration over the derived emission set. */
const uncoveredBy = (declaration: Declaration): readonly string[] =>
  emittedCodes().filter((code) => !covers(declaration, code));

/**
 * The named totality failures of one declaration over the emission set: the
 * proof follows the VALUE, so a deleted declaration and a bare exact-member
 * list each fail by name and a behaviour-preserving refactor passes.
 */
const totalityFailures = (
  declaration: Declaration | undefined,
  emitted: readonly string[],
): readonly string[] => {
  if (declaration === undefined) return ["merge composition family declaration missing"];
  const failures: string[] = [];
  if (!declaration.family) {
    failures.push("merge composition family slot rule missing");
  }
  const uncovered = emitted.filter((code) => !covers(declaration, code));
  if (uncovered.length > 0) {
    failures.push(`declaration leaves emitted codes uncovered: ${uncovered.join(", ")}`);
  }
  return failures;
};

/** The runtime declaration, read from the composition's own exports. */
const productionDeclaration = (): Declaration => ({
  codes: MERGE_COMPOSITION_EMITTABLE_CODES,
  family: isMergeCompositionFamilyInstance(
    `${MERGE_COMPOSITION_GATE_FAMILY.prefix}ci-green${MERGE_COMPOSITION_GATE_FAMILY.suffix}`,
  ),
});

/**
 * THE PRE-FIX DECLARATION, substituted by the control: seven forwarded
 * configuration codes, the three read identities and the seven merge rows the
 * base declared, with NO family expression — seventeen members (Appendix F F1).
 * This is the declaration value, not pre-fix code.
 */
const PRE_FIX_DECLARATION: Declaration = {
  codes: [
    "config.file.malformed",
    "config.value.invalid",
    "config.key.unknown",
    "config.reset.invalid",
    "config.interpolation.rejected",
    "config.secret.forbidden",
    "config.path.forbidden",
    "config.credential.missing",
    "provider.auth.rejected",
    "provider.outage",
    "merge.transaction-aborted",
    "merge.state-unverified",
    "merge.gates-stale",
    "merge.waiver-unauthorized",
    "merge.owner-gate-override-without-waiver",
    "merge.rebase-conflict",
    "merge.landing-unverified",
  ],
  family: false,
};

const ADDITIVE_ROWS = ["merge.sync-required", "merge.mergeability-unknown"] as const;

const rowOf = (code: string) => {
  const row = ERROR_TABLE.find((entry) => entry.code === code);
  if (row === undefined) throw new Error(`no error-table row for ${code}`);
  return row;
};

/** A provider reply whose required check job is not green. */
const failingRequiredJob =
  (headSha: string, branch: string): ((url: string) => MergeProviderReply) =>
  (url) => {
    if (url.includes("/issues/")) {
      return {
        status: 200,
        body: { number: 293, title: "Serial fixture work item", state: "open", labels: [] },
      };
    }
    if (url.includes("/check-runs")) {
      return {
        status: 200,
        body: {
          check_runs: [{ id: 9001, name: "CI / test", status: "completed", conclusion: "failure" }],
        },
      };
    }
    if (url.includes("/pulls?")) {
      return {
        status: 200,
        body: [
          {
            number: 401,
            state: "open",
            head: { ref: branch, sha: headSha },
            base: { ref: "main-tools" },
            commits: 1,
            changed_files: 1,
            mergeable: true,
          },
        ],
      };
    }
    if (url.includes("/graphql")) return { status: 200, body: { data: {} } };
    return { status: 404, body: {} };
  };

const GATE_CONFIG = `merge:\n  gates:\n    schemaVersion: delivery.merge.gates.v1\n    entries:\n      - {id: lifecycle-finalization, recipe: lifecycle-finalization, surface: battery}\n      - {id: ci-green, recipe: ci-green, surface: battery}\n      - {id: push-parity, recipe: push-parity, surface: battery}\n      - {id: owner-gate, recipe: owner-gate, surface: battery, class: owner-review}\n      - {id: squash-preflight, recipe: squash-preflight, surface: battery}\n      - {id: tracker-freshness, recipe: tracker-freshness, surface: merge}\n      - {id: ci-required, recipe: required-ci-job, surface: merge, job: "CI / test"}\n`;

describe("F1 defect-f1-merge-refusal-containment: a declared refusal never reaches containment", () => {
  // assertion: f1.declaration-exhaustive-over-emitted-family
  test("the production declaration covers every emitted code, including the family", () => {
    const production = productionDeclaration();
    expect(production.codes.length).toBeGreaterThan(0);
    expect(uncoveredBy(production)).toEqual([]);
    // The family is covered as a family, not by enumerated gate ids.
    for (const code of production.codes) {
      expect(code.startsWith(GATE_FAMILY_PREFIX), code).toBe(false);
    }
    const emitted = emittedCodes();
    expect(emitted.filter(isFamilyInstance).length).toBe(effectiveGateIds().length);
    for (const code of ADDITIVE_ROWS) {
      expect(emitted, code).toContain(code);
    }
  });

  // control: f1.declaration-removed shape=value-substitution
  test("deleting the runtime declaration fails the totality proof by name", () => {
    const emitted = emittedCodes();
    const failures = totalityFailures(undefined, emitted);
    expect(failures).toEqual(["merge composition family declaration missing"]);
    // The mismatch control still drives an undeclared code to containment, so
    // the deleted declaration cannot pass vacuously.
    const undeclared = "merge.gate.undeclared-gate.failed";
    expect(resolveAppErrorCode(undeclared).ok).toBe(true);
    expect(classifyThrown({ kind: "state", code: "merge.gate.ci-green.failed" }).code).toBe(
      FALLBACK_INTERNAL_CODE,
    );
  });

  // control: f1.declaration-flattened shape=value-substitution
  test("replacing the declaration by the bare exact-member list fails by name", () => {
    const emitted = emittedCodes();
    const bareList: Declaration = { codes: MERGE_COMPOSITION_EMITTABLE_CODES, family: false };
    const failures = totalityFailures(bareList, emitted);
    expect(failures).toContain("merge composition family slot rule missing");
    const familyUncovered = emitted.filter(isFamilyInstance);
    expect(failures.some((failure) => failure.includes(familyUncovered[0] ?? ""))).toBe(true);
    // The live proof over the real declaration stays clean: the failure is the
    // substitution's, never the tree's.
    expect(totalityFailures(productionDeclaration(), emitted)).toEqual([]);
  });

  // control: f1.substituted-prefix-declaration shape=substituted-derivation
  test("the pre-fix declaration is uncovered on the family, and the two results differ", () => {
    // The substituted declaration is the exact pre-fix value: seventeen
    // members, no family expression.
    expect(PRE_FIX_DECLARATION.codes).toHaveLength(17);
    expect(PRE_FIX_DECLARATION.family).toBe(false);
    expect(PRE_FIX_DECLARATION.codes).not.toContain("merge.gate.ci-green.failed");

    const preFix = uncoveredBy(PRE_FIX_DECLARATION);
    const production = uncoveredBy(productionDeclaration());
    // The named assertion: the pre-fix declaration leaves emitted codes
    // uncovered and the production declaration leaves none.
    expect(preFix.length).toBeGreaterThan(0);
    expect(production.length).toBe(0);
    // The uncovered codes name the family (the missing member class) and the
    // two additive rows the pre-fix set could not declare.
    const familyUncovered = preFix.filter(isFamilyInstance);
    expect(familyUncovered.length).toBe(effectiveGateIds().length);
    for (const code of ADDITIVE_ROWS) {
      expect(preFix, code).toContain(code);
    }
  });

  // assertion: f1.gate-family-code-kind-exit
  test("a gate-family refusal is the row's code, merge kind and exit 1", () => {
    const code = `${GATE_FAMILY_PREFIX}ci-green${GATE_FAMILY_SUFFIX}`;
    const resolved = resolveAppErrorCode(code);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.entry.code).toBe(code);
    expect(resolved.entry.domainKind).toBe("merge");
    expect(projectExitCode(resolved.entry.projectionClass)).toBe(1);
    const classified = classifyThrown({ kind: "merge", code });
    expect(classified.code).toBe(code);
    expect(classified.domainKind).toBe("merge");
    expect(classified.code).not.toBe(FALLBACK_INTERNAL_CODE);
  });

  // assertion: f1.two-additive-rows-declared
  test("the two additive rows resolve to their own code, kind and exit", () => {
    for (const code of ADDITIVE_ROWS) {
      const row = rowOf(code);
      expect(row.domainKind).toBe("merge");
      const resolved = resolveAppErrorCode(code);
      expect(resolved.ok, code).toBe(true);
      if (!resolved.ok) continue;
      expect(resolved.entry.code).toBe(code);
      expect(projectExitCode(resolved.entry.projectionClass)).toBe(
        code === "merge.sync-required" ? 1 : 2,
      );
      expect(classifyThrown({ kind: "merge", code }).code).toBe(code);
      // The declaration carries it and no member names a family instance.
      expect(MERGE_COMPOSITION_EMITTABLE_CODES as readonly string[]).toContain(code);
    }
  });

  // assertion: f1.members-resolve-to-their-own-kind
  test("no declared member resolves to a row of a different kind", () => {
    for (const code of MERGE_COMPOSITION_EMITTABLE_CODES) {
      const row = rowOf(code);
      const resolved = resolveAppErrorCode(code);
      expect(resolved.ok, code).toBe(true);
      if (!resolved.ok) continue;
      expect(resolved.entry.domainKind, code).toBe(row.domainKind);
      expect(classifyThrown({ kind: row.domainKind, code }).code, code).toBe(code);
    }
    // A member handed a declared kind its row denies is contained, never
    // resolved into a different kind's row.
    expect(classifyThrown({ kind: "config", code: "merge.sync-required" }).code).toBe(
      FALLBACK_INTERNAL_CODE,
    );
  });

  // assertion: f1.containment-absent-from-live-outcome
  test("a live gate refusal carries the family code and no containment identity", async () => {
    const harness = createMergeProductionHarness({
      label: "gh349-f1-defect",
      configYaml: GATE_CONFIG,
      reply: (url: string) => {
        const reply = failingRequiredJob(harness.headSha, harness.branch);
        return reply(url);
      },
    });
    try {
      const run = await harness.run(["merge", MERGE_PROD_REF, "--dry-run", "--json"]);
      expect(run.exitCode, run.stderr).toBe(1);
      const envelope = run.envelope ?? {};
      const error = (envelope.error ?? {}) as Record<string, unknown>;
      const code = String(error.code);
      expect(code).toBe("merge.gate.ci-required.failed");
      expect(code).not.toBe(FALLBACK_INTERNAL_CODE);
      const resolved = resolveAppErrorCode(code);
      expect(resolved.ok).toBe(true);
      if (resolved.ok) {
        expect(resolved.entry.domainKind).toBe("merge");
        expect(projectExitCode(resolved.entry.projectionClass)).toBe(1);
      }
      const summary = String(error.summary);
      expect(summary).toContain("ci-required");
      expect(summary).not.toContain(FALLBACK_INTERNAL_CODE);
      expect(JSON.stringify(envelope)).not.toContain(FALLBACK_INTERNAL_CODE);

      const text = await harness.run(["merge", MERGE_PROD_REF, "--dry-run"]);
      expect(text.exitCode).toBe(1);
      expect(text.stderr).toContain("merge.gate.ci-required.failed");
      expect(text.stderr).not.toContain(FALLBACK_INTERNAL_CODE);
      // No landing happened on a gate refusal.
      expect(harness.transportRequests.filter((request) => request.url.includes("/merge"))).toEqual(
        [],
      );
    } finally {
      harness.dispose();
    }
  });

  // assertion: f1.mismatch-control-still-contains
  test("a live kind/code mismatch still reaches the containment identity", () => {
    const contained = classifyThrown({ kind: "provider", code: "config.credential.missing" });
    expect(contained.code).toBe(FALLBACK_INTERNAL_CODE);
    const containedFamily = classifyThrown({
      kind: "provider",
      code: `${GATE_FAMILY_PREFIX}ci-green${GATE_FAMILY_SUFFIX}`,
    });
    expect(containedFamily.code).toBe(FALLBACK_INTERNAL_CODE);
    // The same code on its own kind resolves, so the control is the mismatch
    // and not a dead containment branch.
    expect(classifyThrown({ kind: "config", code: "config.credential.missing" }).code).toBe(
      "config.credential.missing",
    );
  });
});

/**
 * The control pair the meta-check reads: the same predicate over the
 * substituted pre-fix declaration and over the production one.
 */
export const controlDiffers = (): {
  readonly production: number;
  readonly preFix: number;
} => ({
  production: uncoveredBy(productionDeclaration()).length,
  preFix: uncoveredBy(PRE_FIX_DECLARATION).length,
});
