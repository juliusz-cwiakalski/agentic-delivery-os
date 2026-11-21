/**
 * TC-SHIM-001 (AC-F4-1) — the shim registry is shape-complete, id-unique,
 * window-ordered, site-present, budget-bounded and wildcard-free.
 *
 * The registry is `namespace.shims.v1`, the single authority for every declared
 * prior-namespace compatibility input. Presence is validated for every site; a
 * match and its occurrence budget are validated only for a site inside a scanned
 * corpus. The two lineages' site sets never overlap. The delivery-os window is
 * derived from the change's own changeset, and the change ships exactly one.
 */
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  changesetWindow,
  EXPECTED_SHIM_IDS,
  LOCKSTEP_PACKAGES,
  loadShimRegistry,
  mutantBuilders,
  siteReports,
  validateRegistry,
} from "../fixtures/namespace/shim-registry";

const ROOT = process.cwd();
const registry = loadShimRegistry(ROOT);

const DECLARATION_ONLY = [
  "doc/spec/features/feature-autonomous-delivery.md",
  "doc/guides/delivery-modes.md",
  "doc/quality/test-specs/test-spec-autonomous-delivery.md",
  "tests/fixtures/entrypoint/prior-identity/harness.ts",
  "tests/fixtures/namespace/pre-freeze-env.ts",
] as const;

describe("TC-SHIM-001 shim registry", () => {
  test("the live registry validates with the seven declared families", () => {
    expect(validateRegistry(registry, ROOT)).toEqual([]);
    expect(registry.schemaId).toBe("namespace.shims.v1");
    const ids = registry.shims.map((shim) => shim.id).sort();
    expect(ids).toEqual([...EXPECTED_SHIM_IDS].sort());
    expect(new Set(ids).size).toBe(ids.length);
    expect(registry.shims).toHaveLength(EXPECTED_SHIM_IDS.length);
  });

  test("every shim carries the declared fields and a bounded notice", () => {
    for (const shim of registry.shims) {
      expect(shim.kind.length).toBeGreaterThan(0);
      expect(shim.literal.length).toBeGreaterThan(0);
      expect(shim.direction.length).toBeGreaterThan(0);
      expect(shim.lineage.length).toBeGreaterThan(0);
      expect(shim.noticeId.length).toBeGreaterThan(0);
      expect(shim.owner.length).toBeGreaterThan(0);
      expect(shim.notice.includes("\n")).toBe(false);
      expect(shim.notice.length).toBeLessThanOrEqual(240);
      expect(shim.sites.length).toBeGreaterThan(0);
    }
  });

  test("every declared site exists and no site is a wildcard", () => {
    for (const shim of registry.shims) {
      for (const site of shim.sites) {
        expect(site.file).not.toContain("*");
        expect(existsSync(join(ROOT, site.file))).toBe(true);
        expect(site.maxOccurrences ?? 1).toBeGreaterThan(0);
      }
    }
  });

  test("presence spans every site; match and budget apply only in-corpus", () => {
    const reports = siteReports(registry, ROOT);
    for (const report of reports) {
      if (!report.inCorpus) {
        expect(report.matched).toBe(false);
        continue;
      }
      expect(report.matched).toBe(true);
      expect(report.occurrences).toBeGreaterThan(0);
      expect(report.occurrences).toBeLessThanOrEqual(report.budget);
    }
    const declarationOnly = new Set(
      reports.filter((report) => !report.inCorpus).map((r) => r.file),
    );
    for (const file of DECLARATION_ONLY) {
      expect(declarationOnly).toContain(file);
    }
    for (const report of reports.filter((entry) => declarationOnly.has(entry.file))) {
      expect(report.matched).toBe(false);
    }
  });

  test("the two lineages' site sets are disjoint", () => {
    const preFreeze = new Set(
      registry.shims
        .filter((shim) => shim.lineage === "pre-freeze")
        .flatMap((shim) => shim.sites.map((site) => site.file)),
    );
    const delivery = new Set(
      registry.shims
        .filter((shim) => shim.lineage === "delivery-os")
        .flatMap((shim) => shim.sites.map((site) => site.file)),
    );
    for (const file of preFreeze) expect(delivery.has(file)).toBe(false);
    expect(delivery.has("tests/fixtures/namespace/pre-freeze-env.ts")).toBe(false);
  });

  test("the delivery-os window is strictly ordered and equals the changeset window", () => {
    const changeset = changesetWindow(ROOT);
    expect(changeset.failures).toEqual([]);
    expect(changeset.files).toEqual(["gh-365-jaiship-namespace-migration-minor.md"]);
    expect(changeset.declaredIn).toBe("0.1.0");
    expect(changeset.removalRelease).toBe("0.2.0");

    expect(registry.window.declaredIn).toBe(changeset.declaredIn);
    expect(registry.window.removalRelease).toBe(changeset.removalRelease);
    for (const shim of registry.shims) {
      if (shim.lineage !== "delivery-os") continue;
      expect(shim.window.declaredIn).toBe(changeset.declaredIn);
      expect(shim.window.removalRelease).toBe(changeset.removalRelease);
    }
    for (const shim of registry.shims) {
      if (shim.lineage !== "pre-freeze") continue;
      expect(shim.window.removalRelease).toBeNull();
      expect(shim.owner.length).toBeGreaterThan(0);
    }
  });

  test("the changeset lists exactly the five lockstep packages", () => {
    const changeset = changesetWindow(ROOT);
    expect(changeset.files).toHaveLength(1);
    expect([...LOCKSTEP_PACKAGES]).toHaveLength(5);
  });

  test("each mutant family fails by name", () => {
    const expectations: ReadonlyArray<readonly [keyof typeof mutantBuilders, string]> = [
      ["duplicateId", "duplicate shim id:"],
      ["unknownKind", "unknown shim kind:"],
      ["unknownDirection", "unknown shim direction:"],
      ["emptySites", "declares no sites"],
      ["absentSite", "declared site absent:"],
      ["wildcardSite", "wildcard site refused:"],
      ["nonIncreasingWindow", "window not strictly increasing: executable-alias"],
    ];
    for (const [builder, message] of expectations) {
      const failures = validateRegistry(mutantBuilders[builder](registry), ROOT);
      expect(failures.join("\n")).toContain(message);
    }
  });
});
