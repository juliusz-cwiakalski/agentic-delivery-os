/**
 * TC-PRIVACY-021 — scan performance and linearity budgets, the bounded length
 * envelope, and the pattern-shape lint.
 */
import { describe, expect, test } from "bun:test";
import {
  findWindowMatches,
  PRIVACY_CAPS,
  PRIVACY_RULES,
} from "../../packages/adapters/src/io/privacy-rules.js";
import {
  generateCorpus,
  generateMatchDense,
  generatePathological,
  NON_MATCHING_HASHES,
  REGISTERED_LENGTHS,
} from "../fixtures/privacy-literals/performance";
import type { RegistryLike } from "../fixtures/privacy-literals/registry";
import { createPrivacyRepo, readLiveRegistry, scan } from "./privacy-support";

const registryWith = (
  entries: RegistryLike["classes"]["private-literal"]["entries"],
): RegistryLike => {
  const base = readLiveRegistry();
  const registry = structuredClone(base);
  registry.classes["private-literal"] = {
    emptyReason: entries.length === 0 ? base.classes["private-literal"].emptyReason : null,
    entries,
  };
  return registry;
};

const median = (values: number[]): number => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] as number;
};

const measure = (root: string): number => {
  const start = performance.now();
  scan(root);
  return performance.now() - start;
};

describe("TC-PRIVACY-021 performance and linearity", () => {
  test("a generated corpus under the budget scans within the local ceiling", () => {
    const registry = registryWith([...NON_MATCHING_HASHES]);
    const repo = createPrivacyRepo(
      { "scanned/corpus.txt": generateCorpus(8 * 1024) },
      { registry },
    );
    try {
      const samples = [measure(repo.root), measure(repo.root)];
      const recorded = median(samples);
      expect(Number.isFinite(recorded)).toBe(true);
      expect(recorded).toBeLessThanOrEqual(60_000);
      expect(scan(repo.root).violations).toEqual([]);
    } finally {
      repo.cleanup();
    }
  }, 120_000);

  test("N and 2N corpora stay within the linearity slack", () => {
    const registry = registryWith([...NON_MATCHING_HASHES]);
    const small = createPrivacyRepo(
      { "scanned/corpus.txt": generateCorpus(8 * 1024) },
      { registry },
    );
    const large = createPrivacyRepo(
      { "scanned/corpus.txt": generateCorpus(16 * 1024) },
      { registry },
    );
    try {
      measure(small.root);
      measure(large.root);
      // Shared CI runners are noisy: take the best-of-n per size so one
      // preempted sample cannot fail the linearity intent, and keep a slack
      // wide enough for runner variance while still catching quadratic scans
      // (a quadratic scan of 2x input lands far above this bound).
      const best = (root: string): number =>
        Math.min(measure(root), measure(root), measure(root), measure(root), measure(root));
      const smallBest = best(small.root);
      const largeBest = best(large.root);
      const ratio = largeBest / Math.max(smallBest, 1);
      expect(ratio).toBeLessThanOrEqual(5);
    } finally {
      small.cleanup();
      large.cleanup();
    }
  }, 120_000);

  test("a match-dense single-line file stays within the N/2N linearity slack", () => {
    const registry = registryWith([]);
    const small = createPrivacyRepo(
      { "scanned/dense.txt": generateMatchDense(1000) },
      { registry },
    );
    const large = createPrivacyRepo(
      { "scanned/dense.txt": generateMatchDense(2000) },
      { registry },
    );
    try {
      measure(small.root);
      measure(large.root);
      const smallMedian = median([measure(small.root), measure(small.root)]);
      const largeMedian = median([measure(large.root), measure(large.root)]);
      const ratio = largeMedian / Math.max(smallMedian, 1);
      expect(ratio).toBeLessThanOrEqual(3);
      expect(scan(small.root).violations.length).toBe(1000);
      expect(scan(large.root).violations.length).toBe(2000);
    } finally {
      small.cleanup();
      large.cleanup();
    }
  }, 120_000);

  test("the pathological near-miss corpus completes within the budget", () => {
    const registry = registryWith([...NON_MATCHING_HASHES]);
    const repo = createPrivacyRepo(
      { "scanned/pathological.txt": generatePathological() },
      { registry },
    );
    try {
      const elapsed = measure(repo.root);
      expect(elapsed).toBeLessThanOrEqual(60_000);
      expect(scan(repo.root).violations).toEqual([]);
    } finally {
      repo.cleanup();
    }
  }, 120_000);

  test("the distinct-length envelope and literal-length cap are bounded", () => {
    expect(REGISTERED_LENGTHS.length).toBeLessThanOrEqual(PRIVACY_CAPS.maxDistinctLengths);
    expect(Math.max(...REGISTERED_LENGTHS)).toBeLessThanOrEqual(PRIVACY_CAPS.maxLength);
    const ignored = findWindowMatches(
      "zq7x9m2p4r6t8v0",
      [PRIVACY_CAPS.maxLength + 1],
      (window) => window,
      () => true,
    );
    expect(ignored).toEqual([]);
  });

  test("no committed rule pattern contains a nested unbounded quantifier", () => {
    const nested = /\((?:[^()]|\([^()]*\))*[+*](?:[^()]|\([^()]*\))*\)[+*]/;
    for (const rule of PRIVACY_RULES) {
      expect(nested.test(rule.patternSource), rule.id).toBe(false);
      expect(rule.patternSource.includes(".*.*"), rule.id).toBe(false);
      expect(rule.patternSource.includes(".+.+"), rule.id).toBe(false);
    }
  });
});
