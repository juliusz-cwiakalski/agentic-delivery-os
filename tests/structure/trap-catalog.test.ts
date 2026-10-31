/**
 * TC-TRAP-001 — trap catalogs are reviewable data: exactly four DM-2 fields per
 * entry, unique stable names, resolvable `path#/json-pointer` fixture
 * references, per-provider minima, and every ticket-named quirk family covered.
 *
 * Mutations run on deep copies; committed catalogs are never rewritten.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const CATALOG_DIR = "tests/fixtures/providers/traps";
const FIXTURE_PREFIX = "tests/fixtures/providers/";
const REQUIRED_KEYS = [
  "expectedNormalizedOutcome",
  "fixtureReference",
  "providerBehavior",
  "trapName",
];

const MINIMA: Readonly<Record<string, number>> = { gitlab: 3, jira: 4, github: 7 };

const EXPECTED_TRAPS: Readonly<Record<string, readonly string[]>> = {
  jira: [
    "JIRA-LABEL-REPLACE",
    "JIRA-CUSTOM-FIELD-TYPING",
    "JIRA-TRANSITIONS-AS-DATA",
    "JIRA-COMMENT-OMISSION",
    "JIRA-UPDATED-ABSENT",
  ],
  gitlab: ["GL-PIPELINE-MULTIPLICITY", "GL-MERGE-STATUS-ASYNC", "GL-MERGE-STATUS-MULTIVALUED"],
  github: [
    "GH-REVIEW-STATE",
    "GH-CHECK-RUNS-PER-SHA",
    "GH-ISSUE-TO-WORKITEM",
    "GITHUB-LIST-EXCLUDES-PRS",
    "GITHUB-LIST-PAGE-LIMIT",
    "GITHUB-ISSUE-RELATIONS-ABSENT",
    "GITHUB-PR-LIST-REVIEW-DEFAULT",
  ],
};

type CatalogEntry = Record<string, unknown>;

type Catalog = {
  readonly provider: string;
  readonly provenance: string;
  readonly entries: CatalogEntry[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseCatalog = (provider: string, value: unknown): Catalog => {
  if (!isRecord(value)) throw new Error(`${provider}: catalog is not an object`);
  if (value.provider !== provider) throw new Error(`${provider}: provider field mismatch`);
  if (typeof value.provenance !== "string") throw new Error(`${provider}: provenance missing`);
  if (!Array.isArray(value.entries)) throw new Error(`${provider}: entries missing`);
  const entries: CatalogEntry[] = [];
  for (const entry of value.entries) {
    if (!isRecord(entry)) throw new Error(`${provider}: an entry is not an object`);
    entries.push({ ...entry });
  }
  return { provider, provenance: value.provenance, entries };
};

export const loadCatalogs = (root: string): Record<string, Catalog> => {
  const directory = join(root, CATALOG_DIR);
  const catalogs: Record<string, Catalog> = {};
  for (const file of readdirSync(directory)
    .filter((entry) => entry.endsWith(".traps.json"))
    .sort()) {
    const provider = file.replace(".traps.json", "");
    const parsed: unknown = JSON.parse(readFileSync(join(directory, file), "utf8"));
    catalogs[provider] = parseCatalog(provider, parsed);
  }
  return catalogs;
};

const referencesOf = (entry: CatalogEntry): string[] => {
  const reference = entry.fixtureReference;
  if (typeof reference === "string") return [reference];
  if (Array.isArray(reference)) {
    return reference.filter((candidate): candidate is string => typeof candidate === "string");
  }
  return [];
};

const resolvePointer = (value: unknown, pointer: string): boolean => {
  if (pointer.length === 0) return true;
  if (!pointer.startsWith("/")) return false;
  let current: unknown = value;
  for (const raw of pointer.slice(1).split("/")) {
    const token = raw.replaceAll("~1", "/").replaceAll("~0", "~");
    if (Array.isArray(current)) {
      const index = Number(token);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return false;
      current = current[index];
    } else if (isRecord(current)) {
      if (!(token in current)) return false;
      current = current[token];
    } else {
      return false;
    }
  }
  return true;
};

const referenceFailure = (root: string, reference: string): string | undefined => {
  const hashIndex = reference.indexOf("#");
  const path = hashIndex === -1 ? reference : reference.slice(0, hashIndex);
  const pointer = hashIndex === -1 ? "" : reference.slice(hashIndex + 1);
  if (!path.startsWith(FIXTURE_PREFIX)) return `${reference}: not under ${FIXTURE_PREFIX}`;
  if (!existsSync(join(root, path))) return `${reference}: fixture file is missing`;
  const parsed: unknown = JSON.parse(readFileSync(join(root, path), "utf8"));
  if (!resolvePointer(parsed, pointer)) return `${reference}: JSON pointer does not resolve`;
  return undefined;
};

/** Validate catalogs read from disk (mutations pass deep copies of the same shape). */
export const validateCatalogs = (root: string, catalogs: Record<string, Catalog>): string[] => {
  const failures: string[] = [];
  const trapNames = new Map<string, string>();
  for (const [provider, catalog] of Object.entries(catalogs)) {
    if (catalog.provider !== provider) {
      failures.push(`${provider}: provider field is ${catalog.provider}`);
    }
    if (!/^hand-authored-synthetic \d{4}-\d{2}-\d{2}$/.test(catalog.provenance)) {
      failures.push(`${provider}: provenance marker is missing or malformed`);
    }
    if (catalog.entries.length < (MINIMA[provider] ?? 0)) {
      failures.push(
        `${provider}: ${catalog.entries.length} entries is below the minimum ${MINIMA[provider] ?? 0}`,
      );
    }
    for (const [index, entry] of catalog.entries.entries()) {
      const label = typeof entry.trapName === "string" ? entry.trapName : `${provider}#${index}`;
      const keys = Object.keys(entry).sort();
      if (keys.join(",") !== [...REQUIRED_KEYS].sort().join(",")) {
        failures.push(`${label}: expected exactly the four DM-2 fields, found ${keys.join(",")}`);
      }
      for (const key of ["trapName", "providerBehavior", "expectedNormalizedOutcome"]) {
        const value = entry[key];
        if (typeof value !== "string" || value.trim().length === 0) {
          failures.push(`${label}: ${key} must be a non-empty string`);
        }
      }
      const references = referencesOf(entry);
      if (references.length === 0) failures.push(`${label}: no fixture reference`);
      for (const reference of references) {
        const failure = referenceFailure(root, reference);
        if (failure !== undefined) failures.push(`${label}: ${failure}`);
      }
      if (typeof entry.trapName === "string") {
        if (trapNames.has(entry.trapName)) {
          failures.push(
            `${entry.trapName}: duplicate trap name in ${trapNames.get(entry.trapName)}`,
          );
        }
        trapNames.set(entry.trapName, provider);
      }
    }
    const expected = EXPECTED_TRAPS[provider] ?? [];
    const present = catalog.entries.map((entry) => entry.trapName);
    for (const name of expected.filter((entry) => !present.includes(entry))) {
      failures.push(`${provider}: ticket-named trap ${name} is missing`);
    }
  }
  return failures;
};

describe("TC-TRAP-001 trap catalog schema and coverage", () => {
  test("every catalog satisfies the four-field schema, minima, and coverage", () => {
    expect(validateCatalogs(ROOT, loadCatalogs(ROOT))).toEqual([]);
  });

  test("catalogs are data-only and carry a provenance marker", () => {
    for (const [provider, catalog] of Object.entries(loadCatalogs(ROOT))) {
      expect(catalog.provenance, provider).toMatch(/^hand-authored-synthetic \d{4}-\d{2}-\d{2}$/);
      for (const entry of catalog.entries) {
        for (const value of Object.values(entry)) {
          expect(["string", "object"], `${provider}: ${String(entry.trapName)}`).toContain(
            Array.isArray(value) ? "object" : typeof value,
          );
        }
      }
    }
  });

  test("deleting an entry fails by provider/name", () => {
    const catalogs = loadCatalogs(ROOT);
    const github = catalogs.github;
    if (github === undefined) throw new Error("github catalog missing");
    github.entries.pop();
    const failures = validateCatalogs(ROOT, catalogs);
    expect(failures.some((message) => message.startsWith("github:"))).toBe(true);
  });

  test("adding a fifth field fails by trap name", () => {
    const catalogs = loadCatalogs(ROOT);
    const entry = catalogs.github?.entries[0];
    if (entry === undefined) throw new Error("github catalog is missing");
    entry.extraField = "not allowed";
    const failures = validateCatalogs(ROOT, catalogs);
    expect(
      failures.some(
        (message) => message.includes("GH-REVIEW-STATE") && message.includes("four DM-2 fields"),
      ),
    ).toBe(true);
  });

  test("a broken fixture reference fails by trap name", () => {
    const catalogs = loadCatalogs(ROOT);
    const entry = catalogs.jira?.entries[0];
    if (entry === undefined) throw new Error("jira catalog is missing");
    entry.fixtureReference = "tests/fixtures/providers/jira/does-not-exist.json#/issue";
    const failures = validateCatalogs(ROOT, catalogs);
    expect(failures.some((message) => message.includes("fixture file is missing"))).toBe(true);
  });

  test("a broken JSON pointer fails by trap name", () => {
    const catalogs = loadCatalogs(ROOT);
    const entry = catalogs.jira?.entries[1];
    if (entry === undefined) throw new Error("jira catalog is missing");
    entry.fixtureReference = "tests/fixtures/providers/jira/custom-fields.json#/no-such-pointer";
    const failures = validateCatalogs(ROOT, catalogs);
    expect(failures.some((message) => message.includes("JSON pointer does not resolve"))).toBe(
      true,
    );
  });

  test("dropping Jira below four entries fails the minimum", () => {
    const catalogs = loadCatalogs(ROOT);
    const jira = catalogs.jira;
    if (jira === undefined) throw new Error("jira catalog missing");
    jira.entries = jira.entries.slice(0, 3);
    const failures = validateCatalogs(ROOT, catalogs);
    expect(
      failures.some((message) => message.includes("jira:") && message.includes("minimum")),
    ).toBe(true);
  });
});
