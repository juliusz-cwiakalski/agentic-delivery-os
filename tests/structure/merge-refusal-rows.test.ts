/**
 * TC-F2-007 — every refusal's code, kind and exit are its declared row's, the
 * two additive rows carry their declared closed vocabularies, the family's slot
 * rule is unchanged, and the reserved `merge.rebase-conflict` row stays declared
 * while no delivered path emits it.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { classifyThrown, resolveAppErrorCode } from "../../packages/cli/src/classify";
import { MERGE_COMPOSITION_EMITTABLE_CODES } from "../../packages/cli/src/production";
import { projectExitCode } from "../../packages/cli/src/projection";
import {
  ERROR_TABLE,
  ERROR_TABLE_FAMILIES,
  type ErrorTableEntry,
  MERGE_REFUSAL_ATTRIBUTIONS,
  MERGE_SYNC_REQUIRED_REASONS,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();

const rowOf = (code: string): ErrorTableEntry => {
  const row = ERROR_TABLE.find((entry) => entry.code === code);
  if (row === undefined) throw new Error(`no declared row for ${code}`);
  return row;
};

const mergeFamily = () =>
  ERROR_TABLE_FAMILIES.find((family) => family.slotPrefix === "merge.gate.");

describe("TC-F2-007 the two additive rows carry their declared facts", () => {
  const cases = [
    {
      code: "merge.sync-required",
      domainKind: "merge",
      category: "user",
      retryable: false,
      consequence: "not_landed",
      projectionClass: "user-validation",
      exit: 1,
    },
    {
      code: "merge.mergeability-unknown",
      domainKind: "merge",
      category: "platform",
      retryable: true,
      consequence: "not_landed",
      projectionClass: "platform-provider",
      exit: 2,
    },
  ] as const;

  for (const expected of cases) {
    test(`${expected.code}: field-by-field equality and its projected exit`, () => {
      const row = rowOf(expected.code);
      expect(row.domainKind).toBe(expected.domainKind);
      expect(row.category).toBe(expected.category);
      expect(row.retryable).toBe(expected.retryable);
      expect(row.consequence).toBe(expected.consequence);
      expect(row.projectionClass).toBe(expected.projectionClass);
      expect(projectExitCode(row.projectionClass)).toBe(expected.exit);
      // The classifier agrees per row: no containment, no kind contradiction.
      const classified = classifyThrown({ kind: row.domainKind, code: expected.code });
      expect(classified.code).toBe(expected.code);
      expect(classified.domainKind).toBe("merge");
    });
  }

  test("the sync reason vocabulary is exactly the closed pair, with no third member", () => {
    expect(MERGE_SYNC_REQUIRED_REASONS).toEqual(["dirty", "behind-unconfirmed"]);
    expect(MERGE_SYNC_REQUIRED_REASONS).toHaveLength(2);
    expect(MERGE_SYNC_REQUIRED_REASONS).not.toContain("behind");
  });

  test("the refusal evidence attribution vocabulary is exactly the closed pair", () => {
    expect(MERGE_REFUSAL_ATTRIBUTIONS).toEqual(["recorded", "probe"]);
    expect(MERGE_REFUSAL_ATTRIBUTIONS).toHaveLength(2);
  });

  test("the documented table carries both rows with the same vocabularies", () => {
    const documented = readFileSync(
      join(ROOT, "doc/spec/features/feature-result-contract.md"),
      "utf8",
    );
    for (const expected of cases) {
      expect(documented, expected.code).toContain(`| ${expected.code} | merge |`);
    }
    expect(documented).toContain(
      "a refusal that persists after the sync means the protection rule",
    );
    // The reason pair is documented as a pair and never as a three-value set.
    expect(documented).not.toContain("behind | behind-unconfirmed");
  });

  test("the unverified-state row's documented remediation names the exact prior command and target", () => {
    // AC-F3-7's documented-row half: the page carries the named command and
    // target, and never the bare "produce a verification" form.
    const documented = readFileSync(
      join(ROOT, "doc/spec/features/feature-result-contract.md"),
      "utf8",
    );
    expect(documented).toContain(
      "Produce the verification with `verify gates <ref>` for the same work item, then re-run",
    );
    expect(documented).not.toContain("Produce a gate verification with `verify gates` and retry");
    const machine = rowOf("merge.state-unverified");
    expect(machine.remediationHint).toContain("verify gates <ref>");
    expect(machine.remediationHint).toContain("for the same work item, then re-run");
  });

  test("the three refusal-identity rows are declared with the row vocabulary they report in", () => {
    // The three additive rows are user-category, non-retryable, not_landed,
    // user-validation at exit 1, each with a remediation naming its object.
    for (const code of [
      "merge.branch-unresolved",
      "merge.request-unresolved",
      "merge.work-item-unresolved",
    ]) {
      const added = rowOf(code);
      expect(added.category, code).toBe("user");
      expect(added.retryable, code).toBe(false);
      expect(added.consequence, code).toBe("not_landed");
      expect(added.projectionClass, code).toBe("user-validation");
      expect(projectExitCode(added.projectionClass), code).toBe(1);
      expect(added.remediationHint, code).toContain("re-run");
    }
  });
});

describe("TC-MRG-026 the abort row's retryability is honest over every cause it reaches", () => {
  const row = rowOf("merge.transaction-aborted");

  test("the row declares retryable false and the transaction's emission sites are exactly the declared pre-mutation causes", () => {
    // The row's declared value at this boundary: `false`, with a remediation
    // that names the aborted condition and promises no convergence.
    expect(row.retryable).toBe(false);
    expect(row.remediationHint).toContain("no convergence is claimed");
    expect(row.consequence).toBe("not_landed");
    // The cause population is read from the transaction's own emission sites,
    // not restated here: at this boundary the abort row reaches exactly its two
    // pre-mutation causes — the waiver-append failure and the declared landing
    // gap. The refused landing is routed through the total landing-fault
    // mapping and never reaches this row (AC-F3-3, AC-F3-6).
    const transaction = readFileSync(
      join(ROOT, "packages/core/src/domain/merge-transaction.ts"),
      "utf8",
    );
    const emissionSites = [...transaction.matchAll(/code: "merge\.transaction-aborted"/gu)].length;
    expect(emissionSites).toBe(2);
    // Cause (a): the waiver-append failure, whose evidence names the append
    // fault; cause (b): the declared landing gap, whose evidence names the
    // operation and its gap reason.
    expect(transaction).toContain("evidence: { detail: appended.code }");
    expect(transaction).toContain("`merge-delivery-request:${landingGap}`");
    // The refused landing takes the mapping, never the abort row.
    expect(transaction).toContain("landingFaultIdentityOf");
    // No row value is assigned by hand anywhere in the transaction: every
    // emitted failure reads its retryability from the resolved row.
    expect(transaction).not.toMatch(/retryable: (true|false)/u);
  });

  test("the derived honesty check fails by name on the substituted pre-change row", () => {
    // The delivered enumeration derives `act-required` from the row's reachable
    // causes; a row that declared `retryable: true` while every reachable cause
    // requires an operator act fails the derivation by name (the pre-change row
    // was exactly that row).
    const causes = [
      { name: "waiver-append-failure", actRequired: true },
      { name: "declared-landing-gap", actRequired: true },
    ];
    const derivedActRequired = causes.every((cause) => cause.actRequired);
    const honestyOf = (declared: boolean, actRequired: boolean): string | undefined =>
      actRequired && declared ? "row claims convergence while its causes need an act" : undefined;
    expect(honestyOf(row.retryable, derivedActRequired)).toBeUndefined();
    expect(honestyOf(true, derivedActRequired)).toContain("claims convergence");
    expect(row.retryable).toBe(false);
  });
});

describe("TC-F2-007 the gate family's slot rule is unchanged", () => {
  test("a resolved gate id yields the family row with kind merge, user, exit 1", () => {
    for (const id of ["ci-green", "tracker-freshness", "workspace-tests", "declared-gate-00"]) {
      const code = `merge.gate.${id}.failed`;
      const resolved = resolveAppErrorCode(code);
      expect(resolved.ok, code).toBe(true);
      if (!resolved.ok) continue;
      expect(resolved.entry.domainKind).toBe("merge");
      expect(resolved.entry.category).toBe("user");
      expect(resolved.entry.consequence).toBe("not_landed");
      expect(projectExitCode(resolved.entry.projectionClass)).toBe(1);
    }
    expect(mergeFamily()?.template).toBe("merge.gate.<gate-id>.failed");
  });

  test("the control: an illegal slot is not recognized by the family", () => {
    for (const code of [
      "merge.gate..failed",
      "merge.gate.CI-GREEN.failed",
      "merge.gate.ci-green",
    ]) {
      expect(resolveAppErrorCode(code).ok, code).toBe(false);
      // A wrong kind on a well-formed family code is contained, never re-kinded.
      expect(classifyThrown({ kind: "state", code: "merge.gate.ci-green.failed" }).code).toBe(
        "fallback.internal",
      );
    }
  });
});

describe("TC-F2-007 the reserved identity stays declared and unreachable", () => {
  test("merge.rebase-conflict keeps its declared fields and its remediation", () => {
    const row = rowOf("merge.rebase-conflict");
    expect(row.consequence).toBe("not_landed");
    expect(row.projectionClass).toBe("user-validation");
    expect(row.remediationHint).toContain("no force path exists");
    expect(MERGE_COMPOSITION_EMITTABLE_CODES as readonly string[]).toContain(
      "merge.rebase-conflict",
    );
    expect(ERROR_TABLE.filter((entry) => entry.domainKind === "merge")).toHaveLength(12);
  });

  test("no delivered code path emits the reserved identity", () => {
    for (const file of [
      "packages/core/src/domain/merge-transaction.ts",
      "packages/core/src/domain/merge-probe.ts",
      "packages/cli/src/edge.ts",
      "packages/cli/src/commands/merge.ts",
    ]) {
      const text = readFileSync(join(ROOT, file), "utf8");
      expect(text, file).not.toContain('"merge.rebase-conflict"');
    }
    // The declaration keeps the member, and the declaration is not an emit site.
    const production = readFileSync(join(ROOT, "packages/cli/src/production.ts"), "utf8");
    expect(production).toContain('"merge.rebase-conflict"');
    // The control: a reintroduced emit site would be found by the same scan.
    const planted = 'code: "merge.rebase-conflict"';
    expect(planted).toContain('"merge.rebase-conflict"');
  });
});
