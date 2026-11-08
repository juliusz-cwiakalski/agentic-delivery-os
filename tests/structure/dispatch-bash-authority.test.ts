/**
 * TC-BASH-005 (phase 8) — the authority decision is a pure file read: zero typed
 * CLI invocations, zero network calls, and zero model calls in the resolver or
 * the four scripts' authority region. A mutation that adds a binary invocation
 * is detected and named.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = process.cwd();
const RESOLVER = "scripts/lib/dispatch-authority.sh";
const SCRIPTS = [
  "scripts/deliver-ticket.sh",
  "scripts/batch-deliver.sh",
  "scripts/pm-liveness.sh",
  "scripts/ceo-loop.sh",
] as const;

const FORBIDDEN = [
  { pattern: /(?:^|[;&|({]\s*)(?:delivery-os|pnpm|npx|bunx)\b/u, name: "typed CLI invocation" },
  { pattern: /\$\(\s*(?:delivery-os|pnpm|npx|bunx)\b/u, name: "typed CLI invocation" },
  { pattern: /\bcurl\b|\bwget\b|https?:\/\//u, name: "network call" },
  { pattern: /\bopencode\b|\bclaude\b/u, name: "model/harness call" },
] as const;

type Violation = { readonly file: string; readonly line: number; readonly name: string };

/** The authority region of a script: the documented source block plus the hook. */
const authorityRegion = (source: string): string => {
  const start = source.indexOf("# CLI-independent dispatch authority read");
  const end = source.indexOf("fi\n", start);
  return start < 0 || end < 0 ? "" : source.slice(start, end + 3);
};

export const scanAuthority = (
  files: readonly { readonly file: string; readonly text: string }[],
): Violation[] => {
  const violations: Violation[] = [];
  for (const candidate of files) {
    candidate.text.split("\n").forEach((line, index) => {
      if (line.trimStart().startsWith("#")) return;
      for (const rule of FORBIDDEN) {
        if (rule.pattern.test(line)) {
          violations.push({ file: candidate.file, line: index + 1, name: rule.name });
        }
      }
    });
  }
  return violations;
};

const liveFiles = (): { readonly file: string; readonly text: string }[] => [
  { file: RESOLVER, text: readFileSync(join(ROOT, RESOLVER), "utf8") },
  ...SCRIPTS.map((file) => ({
    file,
    text: authorityRegion(readFileSync(join(ROOT, file), "utf8")),
  })),
];

describe("TC-BASH-005 bash never invokes the typed CLI to decide authority", () => {
  test("the resolver exists, is a plain file reader, and is sourced by all four scripts", () => {
    expect(existsSync(join(ROOT, RESOLVER))).toBe(true);
    const resolver = readFileSync(join(ROOT, RESOLVER), "utf8");
    expect(resolver).toContain("find ");
    expect(resolver).toContain("dispatch-authority.json");
    expect(resolver).toContain("dual-run");
    for (const script of SCRIPTS) {
      const source = readFileSync(join(ROOT, script), "utf8");
      expect(source, script).toContain('source "${SCRIPT_DIR}/lib/dispatch-authority.sh"');
      expect(source, script).toContain("dispatch_authority_announce");
    }
  });

  test("no authority region contains a typed CLI, network, or model call", () => {
    expect(scanAuthority(liveFiles())).toEqual([]);
  });

  test("the scan detects an injected binary invocation and names the file and line", () => {
    const root = mkdtempSync(join(tmpdir(), "dispatch-bash-scan-"));
    try {
      const mutated = join(root, "dispatch-authority.sh");
      writeFileSync(
        mutated,
        `${readFileSync(join(ROOT, RESOLVER), "utf8")}\n# probe\n_dispatch_authority_probe() { delivery-os dispatch "$1"; }\n`,
      );
      const violations = scanAuthority([{ file: mutated, text: readFileSync(mutated, "utf8") }]);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0]?.name).toBe("typed CLI invocation");
      expect(violations[0]?.file).toBe(mutated);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("mutation-detects a network call and a model call as well", () => {
    const violations = scanAuthority([
      { file: "probe.sh", text: '_x() { curl https://example.test; }\n_y() { opencode run; }\n' },
    ]);
    expect(violations.map((entry) => entry.name).sort()).toEqual([
      "model/harness call",
      "network call",
    ]);
  });
});
