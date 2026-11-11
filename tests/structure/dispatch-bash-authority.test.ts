/**
 * TC-BASH-005 (phase 8) — the authority decision is a pure file read: zero typed
 * CLI invocations, zero network calls, and zero model calls in the resolver or
 * the four scripts' authority region. A mutation that adds a binary invocation
 * is detected and named.
 */
import { describe, expect, it, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the literal source line is the assertion
      expect(source, script).toContain('source "${SCRIPT_DIR}/lib/dispatch-authority.sh"');
      expect(source, script).toContain("dispatch_authority_announce");
    }
  });

  test("the resolver resolves the project root and keeps its bounded search", () => {
    const resolver = readFileSync(join(ROOT, RESOLVER), "utf8");
    // The document now lives at `<host root>/projects/<key>/documents.<ws>/`, so
    // the resolver resolves the project root instead of widening its search.
    expect(resolver).toContain("_dispatch_authority_project_root");
    expect(resolver).toContain("project-identity.json");
    expect(resolver).toContain("projects/");
    expect(resolver).toContain("-maxdepth 2");
    expect(resolver).not.toContain("-maxdepth 3");
    // Override precedence is unchanged: the override is read first.
    const hostRoot = resolver.slice(
      resolver.indexOf("_dispatch_authority_host_root()"),
      resolver.indexOf("_dispatch_authority_common_dir()"),
    );
    expect(hostRoot.indexOf("ADOS_DISPATCH_STATE_ROOT")).toBeGreaterThan(-1);
    expect(hostRoot.indexOf("ADOS_DISPATCH_STATE_ROOT")).toBeLessThan(
      hostRoot.indexOf(".ai/local/state"),
    );
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
      { file: "probe.sh", text: "_x() { curl https://example.test; }\n_y() { opencode run; }\n" },
    ]);
    expect(violations.map((entry) => entry.name).sort()).toEqual([
      "model/harness call",
      "network call",
    ]);
  });
});

/** Source the resolver in a subshell and return the reported authority state. */
const resolveState = (input: {
  readonly hostRoot: string;
  readonly checkout: string;
  readonly environment?: Readonly<Record<string, string>>;
}): string => {
  const script = [`source "${join(ROOT, RESOLVER)}"`, "dispatch_authority_state"].join("\n");
  return execFileSync("bash", ["-c", script], {
    cwd: input.checkout,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH ?? "/usr/bin:/bin",
      HOME: join(input.checkout, "..", "home"),
      ROOT_DIR: input.checkout,
      DISPATCH_REPOSITORY: "github.com/owner/repo",
      ...(input.environment ?? {}),
    },
  }).trim();
};

const seedMarker = (checkout: string, key: string): void => {
  mkdirSync(join(checkout, ".git"), { recursive: true });
  writeFileSync(
    join(checkout, ".git", "project-identity.json"),
    JSON.stringify({
      schema: "delivery.projects.identity.v1",
      projectKey: key,
      projectIdentifier: "0123abcd000000000000000000000000",
      basename: "fixture",
    }),
  );
};

const seedDocument = (root: string, authority: "authoritative" | "dual-run"): void => {
  mkdirSync(join(root, "documents.default"), { recursive: true });
  writeFileSync(
    join(root, "documents.default", "dispatch-authority.json"),
    JSON.stringify({
      schema: "delivery.dispatch.authority.v1",
      repository: "github.com/owner/repo",
      authority,
      recordedAt: "",
      reversalAvailable: false,
    }),
  );
};

describe("TC-PROJ-024 the resolver reads the project root and refuses to compensate", () => {
  const key = "fixture-repo-0123abcd";

  it("reads the migrated layout, never the old host-root location", () => {
    const root = mkdtempSync(join(ROOT, "tmp", "tmpdir", "gh288-bash-authority-"));
    try {
      const checkout = join(root, "checkout");
      const hostRoot = join(root, "host");
      mkdirSync(checkout, { recursive: true });
      seedMarker(checkout, key);
      seedDocument(join(hostRoot, "projects", key), "authoritative");
      expect(
        resolveState({ hostRoot, checkout, environment: { ADOS_DISPATCH_STATE_ROOT: hostRoot } }),
      ).toBe("authoritative");

      // The old location is not consulted: the document at the host root is
      // invisible to the resolver, and the search depth was not widened.
      const legacyHost = join(root, "legacy-host");
      seedDocument(legacyHost, "authoritative");
      expect(
        resolveState({
          hostRoot: legacyHost,
          checkout,
          environment: { ADOS_DISPATCH_STATE_ROOT: legacyHost },
        }),
      ).toBe("dual-run");

      // No project state root at all stays dual-run.
      const emptyHost = join(root, "empty-host");
      mkdirSync(emptyHost, { recursive: true });
      expect(
        resolveState({
          hostRoot: emptyHost,
          checkout,
          environment: { ADOS_DISPATCH_STATE_ROOT: emptyHost },
        }),
      ).toBe("dual-run");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("the repository-local default still wins when no override is set", () => {
    const root = mkdtempSync(join(ROOT, "tmp", "tmpdir", "gh288-bash-default-"));
    try {
      const checkout = join(root, "checkout");
      mkdirSync(checkout, { recursive: true });
      seedMarker(checkout, key);
      seedDocument(join(checkout, ".ai", "local", "state", "projects", key), "authoritative");
      expect(resolveState({ hostRoot: "", checkout })).toBe("authoritative");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
