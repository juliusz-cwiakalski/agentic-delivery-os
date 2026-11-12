/**
 * TC-EVT-084 (scan half) — the taxonomy module, the projection, the surface, and
 * the reconciled page introduce no committed private literal.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const FILES = [
  "packages/core/src/contracts/taxonomy.ts",
  "packages/core/src/domain/event-projection.ts",
  "packages/cli/src/commands/events.ts",
  "packages/cli/src/output/events-text.ts",
  "doc/planning/oss-tooling/milestones/m2/commands/events.md",
];

const FORBIDDEN_PATTERNS: readonly (readonly [string, RegExp])[] = [
  ["absolute home path", /\/home\/[A-Za-z0-9._-]+\//u],
  ["bearer token", /Bearer\s+[A-Za-z0-9._-]{8,}/u],
  ["sk- credential", /\bsk-[A-Za-z0-9]{8,}/u],
  ["private key block", /BEGIN [A-Z ]*PRIVATE KEY/u],
  ["credential query", /[?&](token|api_key|password)=/u],
  ["repository root canary", /repositoryRoot"\s*:/u],
];

describe("TC-EVT-084 privacy literal scan", () => {
  test("no committed private literal appears in the taxonomy surface or its page", () => {
    const failures: string[] = [];
    for (const file of FILES) {
      const text = readFileSync(join(ROOT, file), "utf8");
      for (const [label, pattern] of FORBIDDEN_PATTERNS) {
        if (pattern.test(text)) failures.push(`${file}: ${label}`);
      }
    }
    expect(failures).toEqual([]);
  });

  test("no payload field names repositoryRoot, a prompt, a transcript, or a diff", () => {
    const taxonomy = readFileSync(join(ROOT, FILES[0] as string), "utf8");
    for (const field of ["repositoryRoot", "prompt", "transcript", "diff"]) {
      expect(taxonomy).not.toContain(`"${field}`);
    }
  });
});
