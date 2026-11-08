/**
 * TC-DISP-008 (phase-1 structure slice) / TC-TOKEN-001 — the eleven-token set
 * has exactly one home, the taxonomy is total, and no dispatch production
 * module declares a second token list or an out-of-set token literal.
 *
 * Phase 1 declares the vocabulary; the pure closure behaviour slice lands with
 * phase 2 in `tests/behaviour/dispatch-token-closure.test.ts`.
 */
import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DELIVERY_RESULT_PROJECTION_CLASSES,
  DELIVERY_RESULT_TAXONOMY,
  DELIVERY_RESULT_TOKENS,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const BASH_ORDER = [
  "merged",
  "blocked",
  "pr-open",
  "pr-open-unverified",
  "failed",
  "finished",
  "max-restarts",
  "state-unverified",
  "partial",
  "noop-lane-permission",
  "noop-lane-nothing-to-do",
] as const;

const PACKAGES = ["core", "adapters", "cli", "mcp", "opencode"] as const;

const listSources = (root: string): string[] => {
  const results: string[] = [];
  for (const name of PACKAGES) {
    const base = join(root, "packages", name, "src");
    if (!existsSync(base)) continue;
    const walk = (relative: string): void => {
      for (const entry of readdirSync(join(base, relative), { withFileTypes: true })) {
        const next = relative.length === 0 ? entry.name : `${relative}/${entry.name}`;
        if (entry.isDirectory()) {
          if (entry.name === "dist" || entry.name === "node_modules") continue;
          walk(next);
        } else if (entry.name.endsWith(".ts")) {
          results.push(`packages/${name}/src/${next}`);
        }
      }
    };
    walk("");
  }
  return results.sort();
};

const TOKEN_LITERAL = /["'](merged|blocked|pr-open|pr-open-unverified|failed|finished|max-restarts|state-unverified|partial|noop-lane-permission|noop-lane-nothing-to-do)["'`]/g;

/** Dispatch production modules: dispatch-named sources outside the contracts home. */
const dispatchProductionSources = (root: string): string[] =>
  listSources(root).filter(
    (file) => /\/dispatch[^/]*\.ts$/.test(file) && !file.startsWith("packages/core/src/contracts/"),
  );

const tokenLiteralViolations = (root: string): string[] => {
  const failures: string[] = [];
  for (const file of dispatchProductionSources(root)) {
    const source = readFileSync(join(root, file), "utf8");
    for (const match of source.matchAll(TOKEN_LITERAL)) {
      failures.push(`${file}: token literal ${match[1]}`);
    }
    if (/DELIVERY_RESULT_TOKENS\s*=\s*\[/.test(source)) {
      failures.push(`${file}: second token list`);
    }
  }
  return failures;
};

describe("TC-TOKEN-001 the eleven-token home is total and ordered", () => {
  test("the delivered token set equals the bash reference order", () => {
    expect([...DELIVERY_RESULT_TOKENS]).toEqual([...BASH_ORDER]);
    expect(DELIVERY_RESULT_TOKENS).toHaveLength(11);
  });

  test("the taxonomy has exactly one row per token and no extra row", () => {
    const tokens = DELIVERY_RESULT_TAXONOMY.map((row) => row.token);
    expect(tokens).toEqual([...DELIVERY_RESULT_TOKENS]);
    expect(new Set(tokens).size).toBe(tokens.length);
    for (const row of DELIVERY_RESULT_TAXONOMY) {
      expect(DELIVERY_RESULT_PROJECTION_CLASSES).toContain(row.projectionClass);
      expect(row.derivationClass.length).toBeGreaterThan(0);
    }
  });

  test("no dispatch production module declares a token literal or a second token list", () => {
    expect(tokenLiteralViolations(ROOT)).toEqual([]);
  });

  test("the scan detects an injected second token list and token literal by file", () => {
    const root = mkdtempSync(join(tmpdir(), "dispatch-token-home-"));
    try {
      const file = join(root, "packages/core/src/domain/dispatch-probe.ts");
      mkdirSync(join(root, "packages/core/src/domain"), { recursive: true });
      writeFileSync(
        file,
        'export const DELIVERY_RESULT_TOKENS = ["merged", "failed"];\nexport const value = "pr-open";\n',
      );
      const failures = tokenLiteralViolations(root);
      expect(failures.join("\n")).toContain("packages/core/src/domain/dispatch-probe.ts");
      expect(failures.join("\n")).toContain("second token list");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
