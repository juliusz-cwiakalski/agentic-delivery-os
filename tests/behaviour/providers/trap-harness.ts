/**
 * The shared trap-catalogue replay harness (TC-TRAP-002).
 *
 * One assertion per trap name; the harness keys every result by the trap name
 * and prefixes any failure with the trap name plus its fixture reference so a
 * normalization regression is diagnosable from the failing entry alone. The
 * catalog root is a parameter so negative controls can point at temp copies.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** One DM-2 trap entry: exactly the four required fields. */
export type TrapEntry = {
  readonly trapName: string;
  readonly providerBehavior: string;
  readonly expectedNormalizedOutcome: string;
  readonly fixtureReference: string | readonly string[];
};

/** A per-provider catalog. */
export type TrapCatalog = {
  readonly provider: string;
  readonly entries: readonly TrapEntry[];
};

/** One trap assertion; throwing fails only that entry. */
export type TrapAssertion = () => void | Promise<void>;

/** Assertions keyed by the stable trap name. */
export type TrapAssertions = Readonly<Record<string, TrapAssertion>>;

/** The per-entry outcome. */
export type TrapResult = {
  readonly trapName: string;
  readonly passed: boolean;
  readonly message: string;
};

export type TrapRun = {
  readonly results: readonly TrapResult[];
  readonly failures: readonly string[];
};

export const DEFAULT_TRAP_CATALOG_ROOT = "tests/fixtures/providers/traps";

/** Load one committed catalog. */
export const loadTrapCatalog = (
  catalogRoot: string = DEFAULT_TRAP_CATALOG_ROOT,
  provider?: string,
): TrapCatalog => {
  const file = provider === undefined ? catalogRoot : join(catalogRoot, `${provider}.traps.json`);
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
  return assertCatalog(parsed, file);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const assertCatalog = (value: unknown, file: string): TrapCatalog => {
  if (!isRecord(value) || typeof value.provider !== "string" || !Array.isArray(value.entries)) {
    throw new Error(`${file}: catalog shape is invalid`);
  }
  const entries = value.entries.map((entry, index): TrapEntry => {
    if (!isRecord(entry)) throw new Error(`${file}: entry ${index} is not an object`);
    const { trapName, providerBehavior, expectedNormalizedOutcome, fixtureReference } = entry;
    if (
      typeof trapName !== "string" ||
      typeof providerBehavior !== "string" ||
      typeof expectedNormalizedOutcome !== "string"
    ) {
      throw new Error(`${file}: entry ${index} is missing a required string field`);
    }
    let reference: string | readonly string[];
    if (typeof fixtureReference === "string") {
      reference = fixtureReference;
    } else if (
      Array.isArray(fixtureReference) &&
      fixtureReference.length > 0 &&
      fixtureReference.every((candidate: unknown) => typeof candidate === "string")
    ) {
      reference = fixtureReference.filter((candidate: unknown): candidate is string => {
        return typeof candidate === "string";
      });
    } else {
      throw new Error(`${file}: entry ${index} has no fixture reference`);
    }
    return { trapName, providerBehavior, expectedNormalizedOutcome, fixtureReference: reference };
  });
  return { provider: value.provider, entries };
};

/** Normalize a fixture reference to a list (one or many). */
export const fixtureReferences = (entry: TrapEntry): readonly string[] =>
  typeof entry.fixtureReference === "string"
    ? [entry.fixtureReference]
    : [...entry.fixtureReference];

/**
 * Bidirectional catalog↔assertion coverage: an entry without an assertion and an
 * assertion without an entry both fail (GH-188 F-5 / TC-TRAP-002 step 6).
 */
export const trapCoverageFailures = (
  catalog: TrapCatalog,
  assertions: TrapAssertions,
): string[] => {
  const failures: string[] = [];
  const catalogNames = catalog.entries.map((entry) => entry.trapName);
  const assertionNames = Object.keys(assertions);
  for (const name of catalogNames.filter((entry) => !assertionNames.includes(entry))) {
    failures.push(`${name}: catalog entry has no assertion`);
  }
  for (const name of assertionNames.filter((entry) => !catalogNames.includes(entry))) {
    failures.push(`${name}: assertion has no catalog entry`);
  }
  return failures;
};

export type TrapRunOptions = {
  readonly catalogRoot?: string;
  readonly provider: string;
  /** The client under test (closed over by the assertions). */
  readonly client?: unknown;
  /** The fixture transport used by the client (closed over by the assertions). */
  readonly transport?: unknown;
  readonly assertions: TrapAssertions;
};

/**
 * Replay every catalog entry through its assertion, preserving catalog order.
 * A failure message always starts with the trap name and its fixture reference.
 */
export const runTrapCatalog = async (options: TrapRunOptions): Promise<TrapRun> => {
  const catalog = loadTrapCatalog(options.catalogRoot, options.provider);
  const results: TrapResult[] = [];
  for (const entry of catalog.entries) {
    const reference = fixtureReferences(entry).join(", ");
    const assertion = options.assertions[entry.trapName];
    if (assertion === undefined) {
      results.push({
        trapName: entry.trapName,
        passed: false,
        message: `${entry.trapName} [${reference}]: no assertion registered`,
      });
      continue;
    }
    try {
      await assertion();
      results.push({
        trapName: entry.trapName,
        passed: true,
        message: `${entry.trapName} [${reference}]: passed`,
      });
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      results.push({
        trapName: entry.trapName,
        passed: false,
        message: `${entry.trapName} [${reference}]: ${detail}`,
      });
    }
  }
  return {
    results,
    failures: [
      ...trapCoverageFailures(catalog, options.assertions),
      ...results.filter((result) => !result.passed).map((result) => result.message),
    ],
  };
};
