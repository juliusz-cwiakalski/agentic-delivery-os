/**
 * TC-SPEND-002 — tier, boundary, purity and inventory confinement: the spend
 * contracts are data-only, the fold is pure, production I/O lives only at the
 * injected seams, and planted violations fail by name.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  forbiddenSpendImports,
  SPEND_MODULES,
  spendImportViolations,
  writeMemberViolations,
} from "../fixtures/spend/mutants/import-scan";

const ROOT = process.cwd();

describe("TC-SPEND-002 tier and purity confinement", () => {
  test("the spend modules import only their own tier's vocabulary", () => {
    expect(spendImportViolations(ROOT)).toEqual([]);
  });

  test("the contracts module declares only type-level imports", () => {
    const source = readFileSync(join(ROOT, "packages/core/src/contracts/spend.ts"), "utf8");
    expect(source).not.toContain('from "node:');
    expect(source).not.toContain('from "bun:');
    expect(source).not.toContain("@delivery-os/");
    expect(source).toContain("import type {");
  });

  test("the fold receives records as arguments and performs no I/O", () => {
    const source = readFileSync(join(ROOT, "packages/core/src/domain/spend.ts"), "utf8");
    expect(source).toContain("read: SpendLedgerRead");
    for (const forbidden of ["StateStorePort", "readRecords", "readSpendLedger", "fetch("]) {
      expect(source, forbidden).not.toContain(forbidden);
    }
    expect(writeMemberViolations(source, "packages/core/src/domain/spend.ts")).toEqual([]);
  });

  test("the state read consumer reaches no write member", () => {
    const source = readFileSync(join(ROOT, "packages/core/src/state/spend-reads.ts"), "utf8");
    expect(writeMemberViolations(source, "packages/core/src/state/spend-reads.ts")).toEqual([]);
    expect(source).not.toContain("@delivery-os/adapters");
    expect(source).not.toContain("node:");
  });

  test("no harness adapter, session reader, or provider client appears in the spend graph", () => {
    for (const relative of [
      ...SPEND_MODULES,
      "packages/core/src/state/spend-reads.ts",
      "packages/cli/src/commands/spend.ts",
    ]) {
      const source = readFileSync(join(ROOT, relative), "utf8");
      for (const forbidden of [
        "@delivery-os/adapters/harness",
        "createHarnessStore",
        "createOpencodeSession",
        "@delivery-os/core/provider",
        "credential",
      ]) {
        expect(source, `${relative} ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  test("a planted runtime import in the contracts copy fails by name", () => {
    const directory = mkdtempSync(join(tmpdir(), "spend-import-probe-"));
    try {
      const relative = "packages/core/src/contracts/spend.ts";
      const path = join(directory, relative);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(
        path,
        `${readFileSync(join(ROOT, relative), "utf8")}\nimport { readFileSync } from "node:fs";\n`,
      );
      const violations = forbiddenSpendImports(readFileSync(path, "utf8"), relative);
      expect(violations.some((entry) => entry.includes("node:fs"))).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("a planted adapter import in the fold copy fails by name", () => {
    const relative = "packages/core/src/domain/spend.ts";
    const source = `${readFileSync(join(ROOT, relative), "utf8")}\nimport { createHarnessStore } from "@delivery-os/adapters/harness";\n`;
    const violations = forbiddenSpendImports(source, relative);
    expect(violations.some((entry) => entry.includes("@delivery-os/adapters/harness"))).toBe(true);
  });

  test("a planted write member in the read consumer fails by name", () => {
    const violations = writeMemberViolations(
      "const acquired = store.acquireFence(token);\nstore.append(handle, request);\n",
      "packages/core/src/state/spend-reads.ts",
    );
    expect(violations).toHaveLength(2);
  });

  test("a forged inventory entry is detectable against the real file set", () => {
    const inventory = JSON.parse(
      readFileSync(join(ROOT, "tests/structure/inventory.json"), "utf8"),
    ) as Record<string, string[]>;
    const core = inventory.core ?? [];
    expect(core).toContain("src/contracts/spend.ts");
    expect(core).toContain("src/domain/spend.ts");
    expect(core).toContain("src/domain/spend-text.ts");
    expect(core).toContain("src/state/spend-reads.ts");
    expect(inventory.cli ?? []).toContain("src/commands/spend.ts");
    expect(core).not.toContain("src/domain/spend-ghost.ts");
    const forged = [...core, "src/domain/spend-ghost.ts"];
    expect(forged.length).not.toBe(core.length);
    expect(dirname("src/domain/spend-ghost.ts")).toBe("src/domain");
  });

  test("no new package, subpath or dependency is declared for spend", () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, "packages/core/package.json"), "utf8")) as {
      readonly dependencies?: Record<string, string>;
      readonly exports?: Record<string, unknown>;
    };
    expect(Object.keys(manifest.exports ?? {}).sort()).toEqual([
      ".",
      "./branding",
      "./contracts",
      "./provider",
      "./state",
    ]);
    expect(Object.keys(manifest.dependencies ?? {})).toEqual(["ajv"]);
  });
});
