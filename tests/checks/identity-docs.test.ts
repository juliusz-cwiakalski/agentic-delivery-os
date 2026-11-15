/**
 * GH-320 TC-BIN-071/072 — documentation truth for the identity change.
 *
 * The new distributable guide declares its marker, is registered in the
 * forbidden-literal scan, carries the promised content, and is discoverable from
 * all four affected specification pages. The four declared divergences are
 * stated with the fourth by role, and the guide is clean under the delivered
 * scan's per-line, line-allowlisted semantics — never a whole-text equality.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  EXPECTED_SEED_LITERALS,
  matchSeedLiteral,
  readRegistry,
  scan,
} from "../../scripts/checks/forbidden-literals";

const ROOT = process.cwd();
const GUIDE = "doc/guides/local-install.md";
const VIEW_PAGES = [
  "doc/spec/features/feature-cli-entrypoint.md",
  "doc/spec/features/feature-branding-seam.md",
  "doc/spec/features/feature-config-layer.md",
  "doc/spec/features/feature-projects.md",
] as const;
const SPEC_PAGE = "doc/changes/2026-11/2026-11-15--GH-320--jaiship-binary/chg-GH-320-spec.md";

const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

const registry = readRegistry(ROOT);

/** The guide's frontmatter block, split from the body. */
const frontmatter = (text: string): string => {
  const end = text.indexOf("\n---\n", 4);
  return end < 0 ? "" : text.slice(0, end + 5);
};

/** The delivered scan's line allowlist: the identity header and the marker. */
const HEADER_PATTERNS = ["ados_distribution:", "source:", "Copyright", "Apache-2.0"];

/**
 * The per-line cleanliness rule the delivered scan applies: only the allowlisted
 * identity-header lines may match a seed. A bare whole-text matcher is never used
 * (the mandatory `ados_distribution:` marker itself matches the `ados` seed).
 */
export const bodySeedViolations = (text: string, seeds: readonly string[]): string[] => {
  const violations: string[] = [];
  const lines = text.split(/\r?\n/u);
  lines.forEach((line, index) => {
    if (HEADER_PATTERNS.some((pattern) => line.includes(pattern))) return;
    const hit = matchSeedLiteral(line, seeds);
    if (hit !== undefined) violations.push(`${GUIDE}:${String(index + 1)}: ${hit}`);
  });
  return violations;
};

/** The five pre-freeze installer identifiers the guide delegates by role. */
const INSTALLER_IDENTIFIERS = [
  "ADOS_HOME",
  "ADOS_REPO_DIR",
  "ADOS_SOURCE_DIR",
  "ADOS_RAW_URL",
  "ADOS_REPO_URL",
] as const;
const RAW_URL_DEFAULT =
  "https://raw.githubusercontent.com/juliusz-cwiakalski/agentic-delivery-os/main";

/** The scope files the delivered registry declares, so a scratch scan validates. */
const SCAN_SCOPE_FILES = [
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.json",
  "tsconfig.base.json",
  "biome.json",
  "commitlint.config.js",
  ".dependency-cruiser.cjs",
  ".bun-version",
  ".changeset/config.json",
  "bunfig.toml",
  ".gitignore",
] as const;

const writeAt = (root: string, relative: string, content: string): void => {
  const path = join(root, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
};

const gitAt = (root: string, args: readonly string[]): string => {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return (result.stdout ?? "").trim();
};

/**
 * Materialise a scratch repository the DELIVERED scan can run over: the declared
 * scope files, an empty `packages/` tree, a registry whose only registered doc is
 * the guide (or none), a baseline commit without the guide, and the guide itself
 * as an untracked file. Nothing is written outside the scratch root.
 */
const scratchScanRoot = (options: {
  readonly label: string;
  readonly guideText: string;
  readonly register: boolean;
}): string => {
  const root = mkdtempSync(join(tmpdir(), `gh320-scan-${options.label}-`));
  for (const file of SCAN_SCOPE_FILES) writeAt(root, file, "{}\n");
  mkdirSync(join(root, "packages"), { recursive: true });
  const registryCopy = JSON.parse(read("scripts/checks/forbidden-literals.registry.json")) as {
    corpusBaseline: string;
    registered: string[];
  };
  registryCopy.registered = options.register ? [GUIDE] : [];
  const registryPath = "scripts/checks/forbidden-literals.registry.json";
  writeAt(root, registryPath, JSON.stringify(registryCopy, null, 2));
  gitAt(root, ["init", "-q", "."]);
  gitAt(root, ["add", "-A"]);
  gitAt(root, [
    "-c",
    "user.email=fixture@example.test",
    "-c",
    "user.name=fixture",
    "commit",
    "-qm",
    "baseline",
  ]);
  registryCopy.corpusBaseline = gitAt(root, ["rev-parse", "HEAD"]);
  writeAt(root, registryPath, JSON.stringify(registryCopy, null, 2));
  writeAt(root, GUIDE, options.guideText);
  return root;
};

const withScanRoot = <T>(
  options: Parameters<typeof scratchScanRoot>[0],
  body: (root: string) => T,
): T => {
  const root = scratchScanRoot(options);
  try {
    return body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

describe("TC-BIN-071 the local-install guide ships with its marker, registration, and content", () => {
  test("the guide exists, declares the marker, and is registered", () => {
    expect(existsSync(join(ROOT, GUIDE))).toBe(true);
    const text = read(GUIDE);
    expect(frontmatter(text)).toContain("ados_distribution: redistributable");
    expect(registry.registered).toContain(GUIDE);
  });

  test("the guide carries the promised content", () => {
    const text = read(GUIDE);
    for (const phrase of [
      "--no-fetch",
      "~/.jaiship/bin/jaiship",
      "hands the process to the runtime",
      "Bun runtime at install time",
      "classified failures",
      "prior-identity-fallback",
      "config-read",
      "config-skipped",
      "state-read",
      "state-skipped",
      "Machine-global",
      "prior identity's environment variable names",
      "--print-install-path",
      "## Optional one-step move",
      "## What is not renamed in this slice",
      "MCP",
      "delivery-script shell fallback",
      "repository and documentation URLs",
      "installer's own home directory and environment-variable surface",
      "scripts/install.sh --help",
      "chg-GH-320-spec.md",
    ]) {
      expect({ phrase, present: text.includes(phrase) }).toEqual({ phrase, present: true });
    }
  });

  test("the guide is discoverable from all four affected spec pages", () => {
    for (const page of VIEW_PAGES) {
      expect({ page, linked: read(page).includes("guides/local-install.md") }).toEqual({
        page,
        linked: true,
      });
    }
    // The landing page carries no guide row by design: discoverability is via the
    // four pages, while the landing page's own CLI-entrypoint DESCRIPTOR row is
    // reconciled by this change (F-5, spec v1.6 §16).
    expect(read("doc/00-index.md")).not.toContain("local-install.md");
  });

  test("the landing page descriptor states the two-executable reality", () => {
    const landing = read("doc/00-index.md");
    const descriptor =
      landing.split("\n").find((line) => line.includes("feature-cli-entrypoint.md")) ?? "";
    expect(descriptor).toContain("two executables");
    expect(descriptor).toContain("--print-install-path");
    // No rebranding and no guide link on the descriptor row.
    expect(descriptor).not.toContain("local-install.md");
  });

  test("the five reconciled current-truth pages state the changed reality", () => {
    const pages: readonly (readonly [string, string])[] = [
      ["doc/spec/nonfunctional.md", "two CLI executables"],
      [
        "doc/spec/features/feature-state-layer.md",
        "declares a prior identity selects the host root",
      ],
      ["doc/overview/architecture-overview.md", "two declared Bun bins"],
      ["doc/overview/glossary.md", "Prior-identity fallback"],
      ["doc/quality/test-specs/test-spec-state-layer.md", "prior-identity-state-fallback.test.ts"],
    ];
    for (const [page, phrase] of pages) {
      expect({ page, phrase, present: read(page).includes(phrase) }).toEqual({
        page,
        phrase,
        present: true,
      });
    }
  });

  test("the drift guard is green for the marker-derived install set", () => {
    const result = Bun.spawnSync(["bash", "scripts/.tests/test-doc-distribution.sh"], {
      cwd: ROOT,
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(result.exitCode).toBe(0);
  });
});

describe("TC-BIN-072 the four divergences are stated, the guide stays seed-free, and public surfaces are unchanged", () => {
  test("divergences: every consumer is named in the change record and stated in the guide", () => {
    const spec = read(SPEC_PAGE);
    const guide = read(GUIDE);
    const roles: readonly (readonly [string, string])[] = [
      ["MCP", "MCP"],
      ["delivery-script shell fallback", "delivery-script shell fallback"],
      ["repository and documentation URLs", "scope-derived repository and docs URLs"],
      ["installer's own home directory and environment-variable surface", "installer"],
    ];
    for (const [guidePhrase, specPhrase] of roles) {
      expect({ guidePhrase, inGuide: guide.includes(guidePhrase) }).toEqual({
        guidePhrase,
        inGuide: true,
      });
      expect({ specPhrase, inSpec: spec.includes(specPhrase) }).toEqual({
        specPhrase,
        inSpec: true,
      });
    }
    // The fourth divergence is stated by role and delegates the identifiers.
    expect(guide).toContain("scripts/install.sh --help");
    expect(guide).toContain("chg-GH-320-spec.md");
  });

  test("divergences: the public surfaces are unchanged", () => {
    const branding = read("packages/core/src/branding/index.ts");
    expect(branding).toContain('PACKAGE_SCOPE = "@delivery-os"');
    expect(branding).toContain('SCOPE_ORG = "delivery-os"');
    const manifests = ["core", "adapters", "cli", "mcp", "opencode", "testkit"].map(
      (name) => JSON.parse(read(`packages/${name}/package.json`)) as { readonly name?: string },
    );
    expect(manifests.map((manifest) => manifest.name)).toEqual([
      "@delivery-os/core",
      "@delivery-os/adapters",
      "@delivery-os/cli",
      "@delivery-os/mcp",
      "@delivery-os/opencode",
      "@delivery-os/testkit",
    ]);
    expect(existsSync(join(ROOT, "doc/documentation-profile.md"))).toBe(false);
    const mcp = read("packages/mcp/src/serve.ts");
    expect(mcp).toContain('"delivery-os"');
    const shell = read("scripts/lib/dispatch-authority.sh");
    expect(shell).toContain("${HOME:-/nonexistent}/.delivery-os");
    expect(read("README.md")).not.toContain("~/.jaiship/bin/jaiship");
  });

  test("seed-cleanliness: the guide is clean under the delivered per-line scan", () => {
    const text = read(GUIDE);
    expect(bodySeedViolations(text, registry.seedLiterals)).toEqual([]);
    // The repo-wide scan is green with all five classes and zero violations.
    const outcome = scan(ROOT);
    expect(outcome.failures).toEqual([]);
    expect(outcome.violations).toEqual([]);
    expect(outcome.classes.map((entry) => entry.id)).toEqual([
      "packageTree",
      "rootManifests",
      "rootWorkspaceFiles",
      "ignoreRules",
      "userFacingDocs",
    ]);
    expect(outcome.registeredDocs).toContain(GUIDE);
  });

  test("seed-cleanliness: a spliced body token is reported by the scan and the line check", () => {
    const original = read(GUIDE);
    for (const token of EXPECTED_SEED_LITERALS) {
      const spliced = `${original}\nA body line mentioning ${token} must fail.\n`;
      expect(bodySeedViolations(spliced, registry.seedLiterals).join("\n")).toContain(token);
      const expectedLine =
        spliced.split(/\r?\n/u).findIndex((line) => line.startsWith("A body line mentioning")) + 1;
      // The delivered scan itself must name the token and the line over the
      // spliced copy, not a single re-checked line.
      withScanRoot({ label: "splice", guideText: spliced, register: true }, (root) => {
        const outcome = scan(root);
        const hit = outcome.violations.find(
          (violation) => violation.file === GUIDE && violation.token === token,
        );
        expect({ token, found: hit !== undefined }).toEqual({ token, found: true });
        expect({ token, line: hit?.line }).toEqual({ token, line: expectedLine });
      });
    }
  });

  test("seed-cleanliness: an unregistered guide fails the delivered scan closed", () => {
    const guideText = read(GUIDE);
    withScanRoot({ label: "unregistered", guideText, register: false }, (root) => {
      const outcome = scan(root);
      expect(outcome.failures.join("\n")).toContain(
        `unregistered user-facing doc absent at corpusBaseline: ${GUIDE}`,
      );
    });
    // The same tree with the guide registered proves the failure is the
    // registration, not the fixture: no unregistered-doc failure and the guide
    // is one of the scanned docs.
    withScanRoot({ label: "registered", guideText, register: true }, (root) => {
      const outcome = scan(root);
      expect(outcome.failures.join("\n")).not.toContain("unregistered user-facing doc");
      expect(outcome.registeredDocs).toContain(GUIDE);
      expect(outcome.violations).toEqual([]);
    });
  });

  test("discoverability: the installer surfaces carry the identifiers the guide delegates", () => {
    const installer = read("scripts/install.sh");
    const header = installer.slice(0, installer.indexOf("set -Eeuo pipefail"));
    for (const identifier of INSTALLER_IDENTIFIERS) {
      expect({ identifier, inHeader: header.includes(identifier) }).toEqual({
        identifier,
        inHeader: true,
      });
    }
    const help = spawnSync("bash", ["scripts/install.sh", "--help"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    expect(help.status).toBe(0);
    const environmentSection = help.stdout.slice(help.stdout.indexOf("Environment:"));
    // Four of the five names are documented; the fifth appears only as its
    // expanded value in the install one-liner.
    for (const identifier of ["ADOS_HOME", "ADOS_REPO_DIR", "ADOS_SOURCE_DIR", "ADOS_REPO_URL"]) {
      expect({ identifier, inHelp: environmentSection.includes(identifier) }).toEqual({
        identifier,
        inHelp: true,
      });
    }
    expect(environmentSection).not.toContain("ADOS_RAW_URL");
    expect(help.stdout).toContain(`${RAW_URL_DEFAULT}/scripts/install.sh`);
    // The change record names all five; the guide names none (stated by role).
    const spec = read(SPEC_PAGE);
    const guide = read(GUIDE);
    for (const identifier of INSTALLER_IDENTIFIERS) {
      expect({ identifier, inSpec: spec.includes(identifier) }).toEqual({
        identifier,
        inSpec: true,
      });
      expect({ identifier, inGuide: guide.includes(identifier) }).toEqual({
        identifier,
        inGuide: false,
      });
    }
  });
});
