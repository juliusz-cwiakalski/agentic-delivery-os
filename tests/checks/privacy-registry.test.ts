/**
 * TC-PRIVACY-010..013 — the RV-01..RV-30 fail-closed registry matrix, caps at
 * their exact boundaries, and the phase-tracked allowlist exact-set assertion.
 */
import { describe, expect, test } from "bun:test";
import {
  boundaryRegistry,
  type EntryLike,
  EXPECTED_ALLOWLIST,
  exactSizeRegistryJson,
  mutateRegistry,
  oversizeRegistryJson,
  type RegistryLike,
} from "../fixtures/privacy-literals/registry";
import { RULE_POSITIVES } from "../fixtures/privacy-literals/rules";
import { createPrivacyRepo, makeMutantCheck, readLiveRegistry, scan } from "./privacy-support";

const RV_CASES: Array<[string, string]> = [
  ["RV-01", "schema version"],
  ["RV-02", "schema version"],
  ["RV-03", "scope mode"],
  ["RV-04", "scope mode"],
  ["RV-05", "rule id"],
  ["RV-06", "rule id"],
  ["RV-07", "class"],
  ["RV-08", "class"],
  ["RV-09", "emptyReason"],
  ["RV-10", "rule id"],
  ["RV-11", "entry"],
  ["RV-12", "entry id"],
  ["RV-13", "digest"],
  ["RV-14", "digest"],
  ["RV-15", "algorithm"],
  ["RV-16", "digest"],
  ["RV-17", "length"],
  ["RV-18", "length"],
  ["RV-19", "reason"],
  ["RV-20", "entry id"],
  ["RV-21", "allowlist"],
  ["RV-22", "allowlist"],
  ["RV-23", "reason"],
  ["RV-24", "exclusion"],
  ["RV-25", "reason"],
  ["RV-26", "exact"],
  ["RV-27", "entry cap"],
  ["RV-28", "class cap"],
  ["RV-29", "length cap"],
];

const withRegistry = (registry: RegistryLike | string, files: Record<string, string> = {}) => {
  const repo = createPrivacyRepo(files, { registry });
  return repo;
};

const validEntry = (index: number, length = 8): EntryLike => ({
  id: `alpha-entry-${index}`,
  class: "private-literal",
  algorithm: "sha256",
  hash: index.toString(16).padStart(64, "0"),
  length,
  reason: "Synthetic boundary entry.",
});

const registryWithEntries = (entries: EntryLike[]): RegistryLike => {
  const base = readLiveRegistry();
  const registry = structuredClone(base);
  registry.classes["private-literal"] = {
    emptyReason: entries.length === 0 ? base.classes["private-literal"].emptyReason : null,
    entries,
  };
  return registry;
};

describe("TC-PRIVACY-010..013 fail-closed registry matrix", () => {
  test("the valid control is green and the exact allowlist set is asserted", () => {
    const live = readLiveRegistry();
    const repo = withRegistry(live);
    try {
      const outcome = scan(repo.root);
      expect(outcome.failures).toEqual([]);
      expect(outcome.violations).toEqual([]);
      expect(
        live.allowlist.map((entry) => ({
          id: entry.id,
          kind: entry.kind,
          path: entry.path,
          rules: entry.rules,
        })),
      ).toEqual(EXPECTED_ALLOWLIST);
      expect(live.allowlist.filter((entry) => entry.kind === "directory")).toHaveLength(1);
      for (const entry of live.allowlist) expect(entry.reason.length).toBeGreaterThan(0);
    } finally {
      repo.cleanup();
    }
  });

  test("RV-01..RV-29 each fail closed with one named failure and no scan pass", () => {
    for (const [rv, keyword] of RV_CASES) {
      const mutated = mutateRegistry(readLiveRegistry(), rv);
      const repo = withRegistry(mutated);
      try {
        const outcome = scan(repo.root);
        expect(outcome.failures.length, rv).toBe(1);
        expect(outcome.failures[0], rv).toContain(keyword);
        expect(outcome.violations, rv).toEqual([]);
        expect(outcome.summary, rv).toBeNull();
      } finally {
        repo.cleanup();
      }
    }
  });

  test("RV-30 fails closed on the registry size cap", () => {
    const repo = withRegistry(oversizeRegistryJson(readLiveRegistry()));
    try {
      const outcome = scan(repo.root);
      expect(outcome.failures).toHaveLength(1);
      expect(outcome.failures[0]).toContain("cap");
      expect(outcome.violations).toEqual([]);
    } finally {
      repo.cleanup();
    }
  });

  test("a JSON parse failure emits a content-free diagnostic", () => {
    const canary = "snippet-canary-value";
    const invalid = `{\n  "schemaVersion": ${JSON.stringify(canary)},\n  "broken": CANARY\n}\n`;
    const repo = withRegistry(invalid);
    try {
      const outcome = scan(repo.root);
      expect(outcome.failures).toHaveLength(1);
      expect(outcome.failures[0]).toContain("not valid JSON");
      expect(outcome.failures[0]).not.toContain(canary);
      expect(outcome.failures[0]).not.toContain("CANARY");
    } finally {
      repo.cleanup();
    }
  });

  test("a malformation plus a planted violation reports only the registry failure", () => {
    const mutated = mutateRegistry(readLiveRegistry(), "RV-01");
    const repo = withRegistry(mutated, {
      "scanned/planted.txt": `${RULE_POSITIVES[4]?.value as string}\n`,
    });
    try {
      const outcome = scan(repo.root);
      expect(outcome.failures).toHaveLength(1);
      expect(outcome.failures[0]).toContain("schema version");
      expect(outcome.violations).toEqual([]);
    } finally {
      repo.cleanup();
    }
  });

  test("a malformed entry does not blame its neighbouring valid entry", () => {
    const alpha = validEntry(1);
    const beta = { ...validEntry(2), id: "beta-entry", algorithm: "sha1" };
    const repo = withRegistry(registryWithEntries([alpha, beta]));
    try {
      const outcome = scan(repo.root);
      expect(outcome.failures).toHaveLength(1);
      expect(outcome.failures[0]).toContain("beta-entry");
      expect(outcome.failures[0]).not.toContain("alpha-entry");
    } finally {
      repo.cleanup();
    }
  });

  test("caps accept the exact boundary and reject one past it", () => {
    const base = readLiveRegistry();

    const boundary = withRegistry(boundaryRegistry(base));
    try {
      const outcome = scan(boundary.root);
      expect(outcome.failures).toEqual([]);
      expect(outcome.summary?.entriesByClass["private-literal"]).toBe(128);
      expect(outcome.summary?.entriesByClass["cloud-term"]).toBe(128);
      expect(outcome.summary?.distinctLengths).toBe(32);
    } finally {
      boundary.cleanup();
    }

    const extremeLengths = withRegistry(
      registryWithEntries([validEntry(1, 4), { ...validEntry(2, 512), id: "extreme-512" }]),
    );
    try {
      expect(scan(extremeLengths.root).failures).toEqual([]);
    } finally {
      extremeLengths.cleanup();
    }

    const exact = withRegistry(exactSizeRegistryJson(base));
    try {
      expect(scan(exact.root).failures).toEqual([]);
    } finally {
      exact.cleanup();
    }

    for (const rv of ["RV-27", "RV-28", "RV-29"]) {
      const repo = withRegistry(mutateRegistry(base, rv));
      try {
        const outcome = scan(repo.root);
        expect(outcome.failures.length, rv).toBe(1);
        expect(outcome.violations, rv).toEqual([]);
      } finally {
        repo.cleanup();
      }
    }
  });

  test("an uncapped mutant accepts 257 entries while the real check rejects them", async () => {
    const mutated = mutateRegistry(readLiveRegistry(), "RV-27");
    const repo = withRegistry(mutated);
    const mutant = makeMutantCheck({
      replacements: [
        {
          search: "const validateEntries = (registry: Record<string, unknown>): string | null => {",
          replacement:
            "const validateEntries = (_registry: Record<string, unknown>) => { return null; };\nconst validateEntriesReal = (registry: Record<string, unknown>) => {",
        },
      ],
    });
    try {
      expect(scan(repo.root).failures).toHaveLength(1);
      const mutantCheck = await mutant.importCheck();
      expect(mutantCheck.runPrivacyScan(repo.root).failures).toEqual([]);
    } finally {
      mutant.cleanup();
      repo.cleanup();
    }
  });

  test("a validation-short-circuit mutant accepts an unknown schema version", async () => {
    const mutated = mutateRegistry(readLiveRegistry(), "RV-02");
    const repo = withRegistry(mutated);
    const mutant = makeMutantCheck({
      replacements: [
        {
          search: "if (parsed.schemaVersion !== SCHEMA_VERSION) {",
          replacement: "if (false) {",
        },
      ],
    });
    try {
      expect(scan(repo.root).failures).toHaveLength(1);
      const mutantCheck = await mutant.importCheck();
      expect(mutantCheck.runPrivacyScan(repo.root).failures).toEqual([]);
    } finally {
      mutant.cleanup();
      repo.cleanup();
    }
  });
});

describe("TC-PRIVACY-012 allowlist exactness", () => {
  test("the fixture root is the only directory entry and identical values differ inside vs outside", () => {
    const live = readLiveRegistry();
    const value = RULE_POSITIVES[4]?.value as string;
    const repo = withRegistry(live, {
      "tests/fixtures/privacy-literals/inside.txt": `${value}\n`,
      "scanned/outside.txt": `${value}\n`,
    });
    try {
      const outcome = scan(repo.root);
      expect(outcome.failures).toEqual([]);
      const files = outcome.violations.map((violation) => violation.file);
      expect(files).toContain("scanned/outside.txt");
      expect(files).not.toContain("tests/fixtures/privacy-literals/inside.txt");
      expect(outcome.summary?.allowlistedFiles).toBeGreaterThan(0);
    } finally {
      repo.cleanup();
    }
  });

  test("a rule-scoped entry suppresses only its named rule, not the whole file", () => {
    const live = readLiveRegistry();
    const repo = withRegistry(live, {
      "doc/changes/2026-03/2026-03-10--GH-32--bootstrap-onboarding-consistency/feedback/red-team-report-v3.md": `${RULE_POSITIVES[4]?.value as string}\n`,
    });
    try {
      const outcome = scan(repo.root);
      expect(outcome.failures).toEqual([]);
      expect(
        outcome.violations.some(
          (violation) =>
            violation.file ===
              "doc/changes/2026-03/2026-03-10--GH-32--bootstrap-onboarding-consistency/feedback/red-team-report-v3.md" &&
            violation.ruleOrEntryId === "secret.credential-assignment",
        ),
      ).toBe(true);
    } finally {
      repo.cleanup();
    }
  });

  test("a mutant that treats an exact allowlist path as a prefix accepts a directory-shaped file entry", async () => {
    const live = readLiveRegistry();
    const mutated = structuredClone(live);
    mutated.allowlist.push({
      id: "prefix-shaped-entry",
      kind: "file",
      path: "tests/structure",
      rules: ["*"],
      reason: "Synthetic prefix-shaped entry.",
    });
    const repo = withRegistry(mutated);
    const mutant = makeMutantCheck({
      replacements: [
        {
          search: "scannedFiles.includes(rawEntry.path)",
          replacement: "scannedFiles.some((file) => file.startsWith(rawEntry.path))",
        },
      ],
    });
    try {
      expect(scan(repo.root).failures).toHaveLength(1);
      const mutantCheck = await mutant.importCheck();
      expect(mutantCheck.runPrivacyScan(repo.root).failures).toEqual([]);
    } finally {
      mutant.cleanup();
      repo.cleanup();
    }
  });
});
