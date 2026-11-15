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
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

const body = (text: string): string => {
  const end = text.indexOf("\n---\n", 4);
  return end < 0 ? text : text.slice(end + 5);
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
    // The landing page stays untouched: discoverability is via the four pages.
    expect(read("doc/00-index.md")).not.toContain("local-install.md");
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
      // The delivered scan reports the same splice through its own semantics.
      const temp = mkdtempSync(join(tmpdir(), "gh320-guide-"));
      try {
        writeFileSync(join(temp, "guide.md"), spliced);
        const violation = matchSeedLiteral(
          spliced.split(/\r?\n/u).at(-2) ?? "",
          registry.seedLiterals,
        );
        expect(violation).toBeDefined();
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    }
  });

  test("seed-cleanliness: an unregistered guide fails the scan closed", () => {
    const temp = mkdtempSync(join(tmpdir(), "gh320-registry-"));
    try {
      writeFileSync(join(temp, "guide.md"), read(GUIDE).replace("\nA body line", "\nA body line"));
      const bodyWithoutMarker = body(read(GUIDE));
      expect(bodyWithoutMarker.length).toBeGreaterThan(0);
      // The registry is the single authority: dropping the entry from a copy is
      // what makes an unregistered user-facing doc fail closed.
      const registryCopy = JSON.parse(read("scripts/checks/forbidden-literals.registry.json")) as {
        registered: string[];
      };
      registryCopy.registered = registryCopy.registered.filter((entry) => entry !== GUIDE);
      expect(registryCopy.registered).not.toContain(GUIDE);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
});
