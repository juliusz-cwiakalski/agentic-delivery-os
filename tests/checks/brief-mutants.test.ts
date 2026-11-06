/**
 * TC-BRIEF-021 — non-vacuity meta-check: every named guard is load-bearing.
 *
 * The loader ports the GH-183 pattern: it reads the production
 * `packages/core/src/domain/brief.ts`, rewrites the `#contracts` and
 * `./status.js` specifiers to `file://` URLs of the real modules, writes the
 * mutated source under `tmp/tmpdir` (never the live tree), and imports it with
 * a cache-busting query. Each source mutation disables exactly one guard; the
 * clean module must resist its prohibited observable and the mutant must emit
 * it, naming the case and the intended suite. Guards that live outside the
 * brief domain are cross-referenced to the seeded controls that prove them.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  type BriefDomainModule,
  briefSeededControls,
  briefSourceMutations,
} from "../fixtures/brief/mutants/catalog";

const ROOT = process.cwd();
const DOMAIN_SOURCE = join(ROOT, "packages/core/src/domain/brief.ts");
const CONTRACTS = join(ROOT, "packages/core/src/contracts/index.ts");
const STATUS = join(ROOT, "packages/core/src/domain/status.ts");
const TMP = join(ROOT, "tmp", "tmpdir");
const TMP_PREFIX = "gh228-mutant";

const ALL_ACS = [
  "AC-F1-1",
  "AC-F1-2",
  "AC-F2-1",
  "AC-F2-2",
  "AC-F3-1",
  "AC-F4-1",
  "AC-F5-1",
  "AC-F6-1",
  "AC-F6-2",
  "AC-F6-3",
] as const;

const sourceFor = (): string =>
  readFileSync(DOMAIN_SOURCE, "utf8")
    .split('from "#contracts"')
    .join(`from ${JSON.stringify(pathToFileURL(CONTRACTS).href)}`)
    .split('from "./status.js"')
    .join(`from ${JSON.stringify(pathToFileURL(STATUS).href)}`);

let sequence = 0;

const loadModule = async (source: string): Promise<BriefDomainModule> => {
  mkdirSync(TMP, { recursive: true });
  sequence += 1;
  const file = join(TMP, `${TMP_PREFIX}-${process.pid}-${sequence}.ts`);
  writeFileSync(file, source);
  try {
    return (await import(`${pathToFileURL(file).href}?x=${sequence}`)) as BriefDomainModule;
  } finally {
    rmSync(file, { force: true });
  }
};

describe("TC-BRIEF-021 source-mutation non-vacuity", () => {
  test("the corpus is non-empty and covers every acceptance criterion", () => {
    expect(briefSourceMutations.length).toBeGreaterThan(0);
    expect(briefSeededControls.length).toBeGreaterThan(0);
    const covered = new Set<string>([
      ...briefSourceMutations.map((mutation) => mutation.ac),
      ...briefSeededControls.map((control) => control.ac),
    ]);
    for (const ac of ALL_ACS) expect(covered.has(ac), ac).toBe(true);
    const sourceIds = briefSourceMutations.map((mutation) => mutation.id);
    const controlIds = briefSeededControls.map((control) => control.id);
    expect(new Set([...sourceIds, ...controlIds]).size).toBe(sourceIds.length + controlIds.length);
  });

  test("the unchanged production source passes every intended assertion (control)", async () => {
    const module = await loadModule(sourceFor());
    for (const mutation of briefSourceMutations) {
      expect(
        mutation.fires(module),
        `${mutation.caseName} (${mutation.ac}) [${mutation.intendedSuite}]: clean source must resist`,
      ).toBe(false);
    }
  });

  test("each mutated production source fires its prohibited observable naming the case", async () => {
    const cleanSource = sourceFor();
    for (const mutation of briefSourceMutations) {
      const mutated = mutation.mutate(cleanSource);
      expect(mutated, `${mutation.caseName}: mutation must change the source`).not.toBe(
        cleanSource,
      );
      const module = await loadModule(mutated);
      const fired = mutation.fires(module);
      if (!fired) {
        throw new Error(
          `${mutation.caseName} (${mutation.ac}) [${mutation.intendedSuite}]: ${mutation.prohibited} did not fire`,
        );
      }
      expect(fired, `${mutation.caseName} (${mutation.ac})`).toBe(true);
    }
  });

  test("every cross-referenced seeded control still exists under its test name", () => {
    for (const control of briefSeededControls) {
      const text = readFileSync(join(ROOT, control.file), "utf8");
      expect(text, `${control.id} (${control.ac}): ${control.file}`).toContain(
        `test("${control.testName}"`,
      );
    }
  });

  test("the loader writes only under tmp/tmpdir and never mutates the live source", async () => {
    const before = readFileSync(DOMAIN_SOURCE, "utf8");
    await loadModule(sourceFor());
    expect(readFileSync(DOMAIN_SOURCE, "utf8")).toBe(before);
    const leftovers = readdirSync(TMP).filter((entry) => entry.startsWith(TMP_PREFIX));
    expect(leftovers).toEqual([]);
  });
});
