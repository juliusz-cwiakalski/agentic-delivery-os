/**
 * GH-374 TC-POL-SCAN-001, TC-POL-SCAN-002, TC-POL-SCAN-003, TC-POL-SCAN-005 —
 * the delivery-surface legacy-source scan.
 *
 * The scanner reports three forbidden source classes over a DECLARED surface
 * (its include set and every exclusion with its reason), never reports the two
 * allowed idioms, fails on an empty include set, and proves the second half:
 * the adopter blueprint is the only hook installer in the tree and no
 * delivery-surface file references it.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

/** The declared delivery surface: the include roots. */
export const LEGACY_SCAN_INCLUDE = ["scripts", "tools", ".opencode", "packages", "tests"] as const;

/** Every declared exclusion, by exact path prefix, with its reason. */
export const LEGACY_SCAN_EXCLUSIONS = [
  { prefix: "scripts/hooks", reason: "inactive adopter examples shipped for other adopters" },
  { prefix: "scripts/.tests", reason: "the adopter examples' own tests" },
  { prefix: "tests/fixtures", reason: "fixture text is data, not a delivery script" },
  {
    prefix: "doc/templates/blueprints",
    reason: "adopter scaffolding, separately counted as the only hook installer (TC-POL-SCAN-005)",
  },
  {
    prefix: "doc",
    reason: "documentation describes the legacy surface without being on a delivery path",
  },
  {
    prefix: "tests/checks/provider-legacy-source-scan.test.ts",
    reason: "the scan module itself (its planted samples are in-memory strings)",
  },
] as const;

/** The declared allowed exception: install.sh's example copy ships example paths. */
export const LEGACY_SCAN_ALLOWED_EXCEPTION =
  "scripts/install.sh's ADOS_HOOK_EXAMPLES copy ships each example under its example path inside the target, never as hooks/pre-opencode-iteration" as const;

/** The adopter blueprint path, excluded from the surface and counted separately. */
export const LEGACY_BLUEPRINT_PATH =
  "doc/templates/blueprints/zai-peak-hours-hook--install.sh" as const;

const TEXT_EXTENSIONS = [".sh", ".ts", ".md", ".json", ".yaml", ".yml", ".txt", ".js"] as const;

export type LegacyFindingClass = "sourced-profiles" | "hook-installation" | "hooks-directory";

export type LegacyFinding = {
  readonly path: string;
  readonly line: number;
  readonly class: LegacyFindingClass;
  readonly text: string;
};

export type LegacyScanRefusal = {
  readonly ok: false;
  readonly code: "scan.empty-include" | "scan.missing-root";
  readonly summary: string;
};

export type LegacyScanReport =
  | {
      readonly ok: true;
      readonly findings: readonly LegacyFinding[];
      readonly scanned: readonly string[];
      readonly include: readonly string[];
      readonly exclusions: typeof LEGACY_SCAN_EXCLUSIONS;
    }
  | LegacyScanRefusal;

const isTextFile = (path: string): boolean =>
  TEXT_EXTENSIONS.some((extension) => path.endsWith(extension));

const isExcluded = (path: string): boolean =>
  LEGACY_SCAN_EXCLUSIONS.some(
    (exclusion) => path === exclusion.prefix || path.startsWith(`${exclusion.prefix}/`),
  );

const SOURCE_VERB = /(?:^|[\s;&|(])(?:source|\.)(?=\s)\s+(["']?)([^\s"'`;)]+)\1/g;
const HOOK_TARGET = /(?:^|[\s"'=(])(?:[^\s"'();]*\/)?pre-opencode-iteration(?:["'\s;)]|$)/;
const INSTALL_VERB = /\b(?:cp|install|tee)\s/;
const REDIRECT = /(?:>|>>)\s*["']?[^\s"']*pre-opencode-iteration\b/;
const HOOKS_MKDIR = /\bmkdir\b[^#]*\bhooks\b/;

/** Scan one text as data; each line contributes at most one finding per class. */
export const scanLegacyText = (path: string, text: string): readonly LegacyFinding[] => {
  const findings: LegacyFinding[] = [];
  for (const [index, line] of text.split("\n").entries()) {
    let sourced = false;
    for (const match of line.matchAll(SOURCE_VERB)) {
      const target = match[2] ?? "";
      if (target.split("/").includes("profiles")) {
        sourced = true;
        break;
      }
    }
    if (sourced) {
      findings.push({ path, line: index + 1, class: "sourced-profiles", text: line.trim() });
    }
    if ((INSTALL_VERB.test(line) || REDIRECT.test(line)) && HOOK_TARGET.test(line)) {
      findings.push({ path, line: index + 1, class: "hook-installation", text: line.trim() });
    }
    if (HOOKS_MKDIR.test(line)) {
      findings.push({ path, line: index + 1, class: "hooks-directory", text: line.trim() });
    }
  }
  return findings;
};

/** The exported seam: an empty include set is a scan defect, never a pass. */
export const scanLegacyFiles = (input: {
  readonly files: readonly { readonly path: string; readonly text: string }[];
  readonly include: readonly string[];
  readonly rootExists?: (path: string) => boolean;
}): LegacyScanReport => {
  if (input.include.length === 0) {
    return {
      ok: false,
      code: "scan.empty-include",
      summary: "an empty legacy-source include set is a scan defect, never a pass",
    };
  }
  const rootExists = input.rootExists ?? (() => true);
  for (const root of input.include) {
    if (!rootExists(root)) {
      return {
        ok: false,
        code: "scan.missing-root",
        summary: `delivery-surface include root ${root} does not exist`,
      };
    }
  }
  const findings: LegacyFinding[] = [];
  const scanned: string[] = [];
  for (const file of input.files) {
    if (isExcluded(file.path)) continue;
    if (!input.include.some((root) => file.path === root || file.path.startsWith(`${root}/`))) {
      continue;
    }
    scanned.push(file.path);
    findings.push(...scanLegacyText(file.path, file.text));
  }
  return {
    ok: true,
    findings,
    scanned,
    include: input.include,
    exclusions: LEGACY_SCAN_EXCLUSIONS,
  };
};

const enumerate = (directory: string, into: { path: string; text: string }[]): void => {
  const absolute = join(ROOT, directory);
  if (!existsSync(absolute)) return;
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const child = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      if (["node_modules", "dist", ".git", "tmp"].includes(entry.name)) continue;
      enumerate(child, into);
      continue;
    }
    if (!isTextFile(child)) continue;
    into.push({ path: child, text: readFileSync(join(ROOT, child), "utf8") });
  }
};

const realFiles = (): readonly { readonly path: string; readonly text: string }[] => {
  const files: { path: string; text: string }[] = [];
  for (const root of LEGACY_SCAN_INCLUDE) enumerate(root, files);
  return files;
};

const scanRealSurface = (): LegacyScanReport =>
  scanLegacyFiles({
    files: realFiles(),
    include: LEGACY_SCAN_INCLUDE,
    rootExists: (root) => existsSync(join(ROOT, root)),
  });

/**
 * Executable installers anywhere in the tree that install at a path ending
 * `pre-opencode-iteration`. Only shell scripts install; documentation prose,
 * fixture data and golden text describe the legacy surface without being an
 * installer, which is exactly the boundary DEC-12 declares.
 */
const treeHookInstallers = (): readonly string[] => {
  const files: { path: string; text: string }[] = [];
  for (const root of ["scripts", "tools", ".opencode", "packages", "tests", "doc"]) {
    enumerate(root, files);
  }
  return files
    .filter((file) => file.path.endsWith(".sh"))
    .filter((file) =>
      scanLegacyText(file.path, file.text).some((finding) => finding.class === "hook-installation"),
    )
    .map((file) => file.path);
};

/* ------------------------------ SCAN-001 --------------------------------- */

describe("GH-374 TC-POL-SCAN-001 the declared delivery surface reports zero findings", () => {
  test("the real surface reports zero sourced profiles, zero installations and zero hooks directories", () => {
    const report = scanRealSurface();
    if (!report.ok) throw new Error(report.summary);
    expect(report.findings).toEqual([]);
    expect(report.findings.filter((finding) => finding.class === "sourced-profiles")).toHaveLength(
      0,
    );
    expect(report.findings.filter((finding) => finding.class === "hook-installation")).toHaveLength(
      0,
    );
    expect(report.findings.filter((finding) => finding.class === "hooks-directory")).toHaveLength(
      0,
    );
    // The report names the include set and every exclusion with its reason.
    expect([...report.include]).toEqual([...LEGACY_SCAN_INCLUDE]);
    expect(report.exclusions).toBe(LEGACY_SCAN_EXCLUSIONS);
    for (const exclusion of report.exclusions) expect(exclusion.reason.length).toBeGreaterThan(0);
    // Every include root exists and the scanned set equals the enumerated set.
    for (const root of LEGACY_SCAN_INCLUDE) expect(existsSync(join(ROOT, root))).toBe(true);
    expect(report.scanned.length).toBeGreaterThan(100);
    expect(new Set(report.scanned).size).toBe(report.scanned.length);
    // install.sh is inside the scanned set and produces no finding.
    expect(report.scanned).toContain("scripts/install.sh");
  });

  test("the include set and every exclusion are the declared constants", () => {
    expect([...LEGACY_SCAN_INCLUDE]).toEqual([
      "scripts",
      "tools",
      ".opencode",
      "packages",
      "tests",
    ]);
    expect(LEGACY_SCAN_EXCLUSIONS.map((entry) => entry.prefix)).toEqual([
      "scripts/hooks",
      "scripts/.tests",
      "tests/fixtures",
      "doc/templates/blueprints",
      "doc",
      "tests/checks/provider-legacy-source-scan.test.ts",
    ]);
    expect(LEGACY_SCAN_ALLOWED_EXCEPTION).toContain("ADOS_HOOK_EXAMPLES");
    expect(LEGACY_SCAN_ALLOWED_EXCEPTION).toContain("never as hooks/pre-opencode-iteration");
  });
});

/* ------------------------------ SCAN-002 --------------------------------- */

describe("GH-374 TC-POL-SCAN-002 three planted source classes are reported, the allowed idioms are not", () => {
  test("each forbidden class is reported and the allowed invocation and example copy are not", () => {
    const samples = [
      { path: "scripts/planted-source.sh", text: 'source "$HOME/.ados/config/profiles/mixed.sh"' },
      { path: "scripts/planted-dot.sh", text: '. "$PROFILE_DIR/profiles/deepseek.sh"' },
      {
        path: "scripts/planted-copy.sh",
        text: 'cp "$src" "$HOME/.ados/hooks/pre-opencode-iteration"',
      },
      {
        path: "scripts/planted-redirect.sh",
        text: 'cat "$body" > "$target/hooks/pre-opencode-iteration"',
      },
      { path: "scripts/planted-mkdir.sh", text: 'mkdir -p "$HOME/.ados/hooks"' },
    ] as const;
    const report = scanLegacyFiles({ files: samples, include: LEGACY_SCAN_INCLUDE });
    if (!report.ok) throw new Error(report.summary);
    expect(report.findings.filter((finding) => finding.class === "sourced-profiles")).toHaveLength(
      2,
    );
    expect(report.findings.filter((finding) => finding.class === "hook-installation")).toHaveLength(
      2,
    );
    expect(report.findings.filter((finding) => finding.class === "hooks-directory")).toHaveLength(
      1,
    );

    // The two ALLOWED idioms: invoking an installed hook (invoking is not
    // sourcing and not installing, DEC-12) and install.sh's example copy.
    const allowed = [
      { path: "scripts/deliver-ticket.sh", text: '"$HOOK" "$@"' },
      { path: "scripts/ceo-loop.sh", text: 'if [ -n "$ADOS_PRE_ITERATION_HOOK" ]; then' },
      {
        path: "scripts/install.sh",
        text: 'copy_updatable_file "$source_dir/$hook_example" "$hook_example" "$hook_example"',
      },
    ] as const;
    const allowedReport = scanLegacyFiles({ files: allowed, include: LEGACY_SCAN_INCLUDE });
    if (!allowedReport.ok) throw new Error(allowedReport.summary);
    expect(allowedReport.findings).toEqual([]);

    const clean = scanLegacyFiles({
      files: [{ path: "scripts/clean.sh", text: "set -euo pipefail\necho ok\n" }],
      include: LEGACY_SCAN_INCLUDE,
    });
    if (!clean.ok) throw new Error(clean.summary);
    expect(clean.findings).toEqual([]);
  });

  test("the identifier class is a pointer to TC-POL-SCAN-004, not an oracle here", () => {
    // This scanner classifies legacy source idioms only; the prompt identifier
    // class is owned by the prompt-scan suite (AC-F2-2), so a model token is
    // not a finding of this scan.
    const report = scanLegacyFiles({
      files: [{ path: "scripts/not-this-scan.sh", text: "model: deepseek/deepseek-3.2\n" }],
      include: LEGACY_SCAN_INCLUDE,
    });
    if (!report.ok) throw new Error(report.summary);
    expect(report.findings).toEqual([]);
  });
});

/* ------------------------------ SCAN-003 --------------------------------- */

describe("GH-374 TC-POL-SCAN-003 neither scan can pass on an empty or vacuous surface", () => {
  const promptScanSource = (): string =>
    readFileSync(join(ROOT, "tests/checks/provider-policy-adoption-prompt-scan.test.ts"), "utf8");

  test("an empty include set fails with a typed refusal and a missing root fails naming it", () => {
    const empty = scanLegacyFiles({ files: [], include: [] });
    expect(empty.ok).toBe(false);
    if (empty.ok) return;
    expect(empty.code).toBe("scan.empty-include");

    const missing = scanLegacyFiles({
      files: [],
      include: ["scripts"],
      rootExists: () => false,
    });
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.code).toBe("scan.missing-root");
    expect(missing.summary).toContain("scripts");
  });

  test("a planted finding in a one-file include set is reported, proving the seam is live", () => {
    const report = scanLegacyFiles({
      files: [{ path: "scripts/only.sh", text: 'source "$PROFILE_DIR/profiles/mixed.sh"' }],
      include: ["scripts"],
    });
    if (!report.ok) throw new Error(report.summary);
    expect(report.scanned).toEqual(["scripts/only.sh"]);
    expect(report.findings.map((finding) => finding.class)).toEqual(["sourced-profiles"]);
  });

  test("the prompt scanner declares the same typed empty-include refusal", () => {
    // The prompt suite's empty-include arm is an arm of this case (a declared
    // pointer, not a second owner). Its exported seam refuses an empty include
    // rather than returning an empty finding list.
    const source = promptScanSource();
    expect(source).toContain("export const scanPromptSamples");
    expect(source).toContain("prompt-scan.empty-include");
    expect(source).toContain("if (input.include.length === 0)");
  });
});

/* ------------------------------ SCAN-005 --------------------------------- */

describe("GH-374 TC-POL-SCAN-005 every exclusion is real, the exception is a rule, and the blueprint is the only installer", () => {
  test("excluded-path constructs produce no findings while the same construct in an included path does", () => {
    const forbidden = 'source "$PROFILE_DIR/profiles/mixed.sh"';
    const placed = [
      { path: "scripts/hooks/example.sh", text: forbidden },
      { path: "scripts/.tests/test-example.sh", text: forbidden },
      { path: "tests/fixtures/provider/legacy/sample.sh", text: forbidden },
      { path: "doc/templates/blueprints/sample.sh", text: forbidden },
      { path: "doc/guides/sample.md", text: forbidden },
      { path: "tests/checks/provider-legacy-source-scan.test.ts", text: forbidden },
      { path: "scripts/delivery.sh", text: forbidden },
    ] as const;
    const report = scanLegacyFiles({ files: placed, include: LEGACY_SCAN_INCLUDE });
    if (!report.ok) throw new Error(report.summary);
    expect(report.findings.map((finding) => finding.path)).toEqual(["scripts/delivery.sh"]);
    // doc/** is outside the include set entirely.
    expect(report.scanned).not.toContain("doc/guides/sample.md");
    expect(report.scanned).not.toContain("doc/templates/blueprints/sample.sh");
  });

  test("the install.sh example copy is not reported while a copy to hooks/pre-opencode-iteration is", () => {
    const report = scanLegacyFiles({
      files: [
        {
          path: "scripts/install.sh",
          text: 'copy_updatable_file "$source_dir/scripts/hooks/pre-opencode-iteration-zai.sh" "scripts/hooks/pre-opencode-iteration-zai.sh" "scripts/hooks/pre-opencode-iteration-zai.sh"',
        },
        {
          path: "scripts/unsafe.sh",
          text: 'cp "$src" "$target/hooks/pre-opencode-iteration"',
        },
      ],
      include: LEGACY_SCAN_INCLUDE,
    });
    if (!report.ok) throw new Error(report.summary);
    expect(report.findings.map((finding) => finding.path)).toEqual(["scripts/unsafe.sh"]);
    expect(report.findings[0]?.class).toBe("hook-installation");
  });

  test("exactly one file in the tree installs at the pre-opencode-iteration path, and no surface file references it", () => {
    const installers = treeHookInstallers();
    expect(installers).toEqual([LEGACY_BLUEPRINT_PATH]);
    expect(existsSync(join(ROOT, LEGACY_BLUEPRINT_PATH))).toBe(true);
    const surface = scanRealSurface();
    if (!surface.ok) throw new Error(surface.summary);
    for (const file of surface.scanned) {
      if (file === LEGACY_BLUEPRINT_PATH) continue;
      const text = readFileSync(join(ROOT, file), "utf8");
      expect([file, text.includes("zai-peak-hours-hook--install")]).toEqual([file, false]);
    }
  });
});
