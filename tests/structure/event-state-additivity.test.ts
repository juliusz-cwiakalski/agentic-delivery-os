/**
 * TC-EVT-073 — the taxonomy persists nothing: the state schema version, record
 * kinds, payload schemas, and key prefixes are unchanged, and no migration,
 * backfill, or seed module appears.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { STATE_SCHEMA_VERSION } from "../../packages/core/src/contracts/state";

const ROOT = process.cwd();
const CONTRACTS = "packages/core/src/contracts";
const SUFFIXES = ["_RECORD_KIND", "_SCHEMA", "_PAYLOAD_SCHEMA", "_KEY_PREFIX", "_SCHEMA_ID"];

const baseline = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/events/state-additivity-baseline.json"), "utf8"),
) as { readonly constants: Readonly<Record<string, string>> };

/** The declared string constants that name a record kind, schema, or key prefix. */
const currentConstants = (): Record<string, string> => {
  const pattern = /export const (\w+) = "([^"]*)" as const;/gu;
  const constants: Record<string, string> = {};
  for (const file of readdirSync(join(ROOT, CONTRACTS)).sort()) {
    if (!file.endsWith(".ts") || file === "taxonomy.ts") continue;
    const text = readFileSync(join(ROOT, CONTRACTS, file), "utf8");
    for (const match of text.matchAll(pattern)) {
      const name = match[1] as string;
      if (name !== "STATE_SCHEMA_VERSION" && !SUFFIXES.some((suffix) => name.endsWith(suffix))) {
        continue;
      }
      constants[`${file}:${name}`] = match[2] as string;
    }
  }
  return constants;
};

describe("TC-EVT-073 state additivity", () => {
  test("STATE_SCHEMA_VERSION is unchanged", () => {
    expect(STATE_SCHEMA_VERSION).toBe(baseline.constants["state.ts:STATE_SCHEMA_VERSION"]);
  });

  test("the record-kind, payload-schema, and key-prefix constant set is unchanged", () => {
    expect(currentConstants()).toEqual(baseline.constants);
  });

  test("no migration, backfill, or seed module exists in the state tier", () => {
    const files = readdirSync(join(ROOT, "packages/core/src/state"));
    expect(files.filter((file) => /migrat|backfill|seed/iu.test(file))).toEqual([]);
  });

  test("no delivery-domain record kind was added outside the enumerated set", () => {
    const kinds = Object.entries(currentConstants())
      .filter(([name]) => name.endsWith("_RECORD_KIND"))
      .map(([, value]) => value);
    expect(kinds).toContain("queue.entry");
    expect(kinds).toContain("blocker.question");
    expect(kinds.some((kind) => kind.startsWith("events."))).toBe(false);
    expect(kinds.some((kind) => kind.startsWith("taxonomy."))).toBe(false);
  });
});
