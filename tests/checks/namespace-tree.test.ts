/**
 * GH-365 P4 — the repository-tree arm.
 *
 * TC-SCAN-003: the real tree is green, the reported prior-root prefix set equals
 * the declared set, the runtime files are ignored in a rule-world, and a tracked
 * runtime file fails by name. TC-SCAN-004/005: a tracked symlink into the prior
 * root and a tracked file under either declared prior prefix fail by name.
 * `M55`: a hardcoded/narrowed prefix set fails the AC-F1-2-named reported-set
 * assertion while the real-tree checks stay green (per-assertion attribution).
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readRegistry } from "../../scripts/checks/forbidden-literals";
import { declaredPriorRootPrefixes, scanTree } from "../../scripts/checks/namespace-tree";
import { liveShims } from "../fixtures/namespace/seeds";
import { createSyntheticTree, ruleWorldProbe } from "../fixtures/namespace/tree";
import { ROOT } from "./fixture-repo";

const shims = liveShims(ROOT);
const configLiteral = shims.find((shim) => shim.id === "prior-config-directory")?.literal ?? "";
const stateLiteral = shims.find((shim) => shim.id === "prior-state-root")?.literal ?? "";
const homeSeed =
  readRegistry(ROOT).priorNamespace?.seeds.find((seed) => seed.id === "prior-home-config")
    ?.literal ?? "";
const DECLARED = [`${configLiteral}/`, `${stateLiteral}/`, `${homeSeed}/`];

const status = (root: string): string =>
  (
    spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).stdout ?? ""
  ).trim();

describe("TC-SCAN-003 the real tree", () => {
  test("the tree arm is green and reports the declared prefix set", () => {
    const outcome = scanTree(ROOT);
    expect(outcome.failures).toEqual([]);
    expect(outcome.priorRootPrefixes).toEqual(DECLARED);
    for (const check of outcome.checks) {
      expect(check.ok, `${check.id}: ${check.detail ?? ""}`).toBe(true);
    }
    const summary = outcome.checks.find((check) => check.id === "declared-prior-root-prefix-set");
    expect(summary?.detail).toContain(DECLARED[0] as string);
    expect(summary?.detail).toContain(DECLARED[1] as string);
  });

  test("the runtime files are ignored by the repository's own rules", () => {
    const probe = ruleWorldProbe(readFileSync(join(ROOT, ".gitignore"), "utf8"), [
      ".jaiship/config.local.yaml",
      ".jaiship/projects.yaml",
      ".jaiship/config.yaml",
    ]);
    expect(probe[".jaiship/config.local.yaml"]).toBe(true);
    expect(probe[".jaiship/projects.yaml"]).toBe(true);
    expect(probe[".jaiship/config.yaml"]).toBe(false);
  });

  test("the arm is read-only and deterministic across two runs", () => {
    const before = status(ROOT);
    const first = JSON.stringify(scanTree(ROOT));
    const second = JSON.stringify(scanTree(ROOT));
    expect(second).toBe(first);
    expect(status(ROOT)).toBe(before);
  });

  test("M55: a narrowed prefix set fails only the declared-prefix assertion", () => {
    const narrowed = [DECLARED[0] as string];
    const outcome = scanTree(ROOT, { priorRootPrefixes: narrowed });
    expect(
      outcome.failures.some((message) =>
        message.includes("declared prior-root prefix set mismatch"),
      ),
      "the AC-F1-2-named assertion must fail",
    ).toBe(true);
    for (const id of [
      "tracked-prior-root-paths",
      "tracked-prior-root-symlinks",
      "committed-layer-present",
      "runtime-project-files-ignored",
      "runtime-project-files-not-tracked",
    ]) {
      expect(outcome.checks.find((check) => check.id === id)?.ok, id).toBe(true);
    }
    expect(outcome.priorRootPrefixes).toEqual(narrowed);
  });
});

describe("TC-SCAN-004/005 negative controls", () => {
  test("control A: a tracked .jaiship -> .delivery-os symlink fails naming path and target", () => {
    const tree = createSyntheticTree({ layer: false, symlink: true });
    try {
      const outcome = scanTree(tree.root);
      const message = outcome.failures.find((entry) =>
        entry.includes("tracked symlink resolves into a prior-namespace root"),
      );
      expect(message).toBeDefined();
      expect(message).toContain(".jaiship");
      expect(message).toContain(configLiteral);
      expect(outcome.checks.find((check) => check.id === "tracked-prior-root-symlinks")?.ok).toBe(
        false,
      );
    } finally {
      tree.dispose();
    }
  });

  test("control B: a tracked file under either declared prior prefix fails by name", () => {
    const tree = createSyntheticTree({ priorFile: true, priorStateFile: true });
    try {
      const outcome = scanTree(tree.root);
      expect(outcome.failures.some((entry) => entry.includes(".delivery-os/config.yaml"))).toBe(
        true,
      );
      expect(
        outcome.failures.some((entry) => entry.includes(".delivery-os-state/host-index.json")),
      ).toBe(true);
      expect(outcome.checks.find((check) => check.id === "tracked-prior-root-paths")?.ok).toBe(
        false,
      );
    } finally {
      tree.dispose();
    }
  });

  test("a tracked runtime-written project file fails by name", () => {
    const tree = createSyntheticTree({ runtimeFile: true });
    try {
      const outcome = scanTree(tree.root);
      expect(
        outcome.failures.some((entry) =>
          entry.includes("tracked runtime-written project file: .jaiship/projects.yaml"),
        ),
      ).toBe(true);
      expect(
        outcome.checks.find((check) => check.id === "runtime-project-files-not-tracked")?.ok,
      ).toBe(false);
    } finally {
      tree.dispose();
    }
  });

  test("the prefix set is read from the declaration, not hardcoded", () => {
    const tree = createSyntheticTree();
    try {
      const shimPath = join(tree.root, "scripts/checks/namespace-shims.registry.json");
      const shimsDocument = JSON.parse(readFileSync(shimPath, "utf8")) as {
        shims: { id: string; literal: string }[];
      };
      const config = shimsDocument.shims.find((shim) => shim.id === "prior-config-directory");
      if (config === undefined) throw new Error("no prior config-directory shim");
      config.literal = ".prior-alt";
      const state = shimsDocument.shims.find((shim) => shim.id === "prior-state-root");
      if (state === undefined) throw new Error("no prior state-root shim");
      state.literal = ".prior-state-alt";
      writeFileSync(shimPath, `${JSON.stringify(shimsDocument, null, 2)}\n`);

      const forbiddenPath = join(tree.root, "scripts/checks/forbidden-literals.registry.json");
      const forbidden = JSON.parse(readFileSync(forbiddenPath, "utf8")) as {
        priorNamespace: { seeds: { id: string; literal: string }[] };
      };
      const configSeed = forbidden.priorNamespace.seeds.find(
        (seed) => seed.id === "prior-config-directory",
      );
      if (configSeed === undefined) throw new Error("no prior config seed");
      configSeed.literal = ".prior-alt";
      const stateSeed = forbidden.priorNamespace.seeds.find(
        (seed) => seed.id === "prior-state-directory",
      );
      if (stateSeed === undefined) throw new Error("no prior state seed");
      stateSeed.literal = ".prior-state-alt";
      const homeSeedEntry = forbidden.priorNamespace.seeds.find(
        (seed) => seed.id === "prior-home-config",
      );
      if (homeSeedEntry === undefined) throw new Error("no prior home seed");
      homeSeedEntry.literal = "~/.prior-alt";
      writeFileSync(forbiddenPath, `${JSON.stringify(forbidden, null, 2)}\n`);

      const declared = declaredPriorRootPrefixes(tree.root);
      expect(declared.failures).toEqual([]);
      expect(declared.prefixes).toEqual([".prior-alt/", ".prior-state-alt/", "~/.prior-alt/"]);
    } finally {
      tree.dispose();
    }
  });
});
