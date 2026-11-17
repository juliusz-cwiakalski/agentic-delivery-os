/**
 * TC-SUP-046 (structure half) — the record-kind, payload-schema, and key-prefix
 * constant set is unchanged, the only new schema identity is the supervision
 * report, and the battery appends through delivered record kinds only
 * (GH-295 DM-4, EVT-1).
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SUPERVISION_SCHEMA_VERSION } from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const CONTRACTS = "packages/core/src/contracts";
const SUFFIXES = ["_RECORD_KIND", "_SCHEMA", "_PAYLOAD_SCHEMA", "_KEY_PREFIX", "_SCHEMA_ID"];

const baseline = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/events/state-additivity-baseline.json"), "utf8"),
) as { readonly constants: Readonly<Record<string, string>> };

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

describe("TC-SUP-046 the declared record and schema constant set is unchanged", () => {
  test("no record kind, payload schema, or key prefix was added", () => {
    expect(currentConstants()).toEqual(baseline.constants);
  });

  test("the only new schema identity is the supervision report", () => {
    expect(SUPERVISION_SCHEMA_VERSION).toBe("delivery.supervision.v1");
    expect(Object.values(currentConstants())).not.toContain(SUPERVISION_SCHEMA_VERSION);
  });

  test("the battery source appends through the delivered park kind only", () => {
    const source = readFileSync(join(ROOT, "packages/core/src/app/supervise.ts"), "utf8");
    expect(source).toContain("QUEUE_PARK_RECORD_KIND");
    // No generic document replace and no supervision-owned record kind.
    expect(source).not.toContain("replaceDocument");
    expect(source).not.toMatch(/"supervision\.[a-z-]+\.v1"/u);
  });

  test("no migration, backfill, or seed module was added to the state tier", () => {
    const files = readdirSync(join(ROOT, "packages/core/src/state"));
    expect(files.filter((file) => /migrat|backfill/iu.test(file))).toEqual([]);
  });
});
