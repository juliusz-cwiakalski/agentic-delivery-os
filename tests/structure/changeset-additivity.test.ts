/**
 * TC-SYNC-011 — the release additivity pin. The delivered `.changeset/*.md` set
 * equals the phase-1 baseline plus exactly the three declared added files — the
 * GH-349 delivery's own changeset plus the two upstream deliveries that landed on
 * the integration base after the pin was captured (PR #363, PR #364); each of them
 * declares exactly the five fixed-group packages at `minor` with
 * `@delivery-os/testkit` absent, no sixth package and a non-empty body; all 64
 * baseline files keep
 * their SHA-256 digest; and each of the five package `version` values equals its
 * baseline value, so the bump belongs to changesets and never to a hand edit.
 *
 * The baseline is captured in phase 1 from the pre-change tree
 * (`tests/fixtures/pins/changeset-baseline.json`) and is read-only afterwards:
 * a permanent suite must not assert a diff against a moving base branch, so the
 * pin is a tree fixture rather than a `git diff` (`.ai/rules/testing-strategy.md`).
 * The baseline keeps the pre-GH-349 file set; upstream's two later deliveries are
 * recognised as declared additions, never as violations, so the pin still proves
 * the GH-349 delivery adds exactly its own one changeset.
 * Every failure mode of the register M117..M123 is a mutation control over the
 * same validator the live assertion runs, so a control cannot pass vacuously.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const PIN_PATH = "tests/fixtures/pins/changeset-baseline.json";
const CHANGESET_DIR = ".changeset";
/**
 * The declared additions over the pre-GH-349 baseline, sorted: the two upstream
 * deliveries that landed on the integration base after capture (PR #363's install
 * lifecycle, PR #364's dispatch core parity) and GH-349's own changeset.
 */
const ADDED_CHANGESETS = [
  "gh-347-dispatch-core-parity-minor.md",
  "gh-349-merge-closeout-queue-repair-minor.md",
  "install-lifecycle-minor.md",
] as const;
const PINNED_CHANGESET_COUNT = 64;

/** The fixed group of `.changeset/config.json`: five packages, testkit excluded. */
const FIXED_PACKAGES = [
  "@delivery-os/core",
  "@delivery-os/adapters",
  "@delivery-os/cli",
  "@delivery-os/mcp",
  "@delivery-os/opencode",
] as const;
const FIXED_PACKAGE_SET: ReadonlySet<string> = new Set(FIXED_PACKAGES);

type ChangesetBaseline = {
  readonly provenance: string;
  readonly fixedPackages: Readonly<Record<string, string>>;
  readonly changesets: Readonly<Record<string, string>>;
  /** The declared additions; the tree fixture omits it and takes the live set. */
  readonly expectedAdded?: readonly string[];
};

type TreeSnapshot = {
  /** Content of every `.changeset/*.md` file, keyed by file name. */
  readonly files: Readonly<Record<string, string>>;
  /** Version of every fixed-group package, keyed by package name. */
  readonly versions: Readonly<Record<string, string>>;
};

export type ReleaseViolation = {
  /** The register-named failure mode: `changeset.<surface>.<condition>`. */
  readonly code: string;
  /** The offending file, package or value, stated so the control fails by name. */
  readonly detail: string;
};

const digestOf = (content: string): string => createHash("sha256").update(content).digest("hex");

const parseChangeset = (
  text: string,
): { readonly packages: Readonly<Record<string, string>>; readonly body: string } | null => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
  if (match === null) return null;
  const packages: Record<string, string> = {};
  for (const line of (match[1] ?? "").split(/\r?\n/)) {
    if (line.trim().length === 0) continue;
    const entry = /^"([^"]+)":\s*(minor|patch|major)\s*$/.exec(line);
    if (entry === null) return null;
    packages[entry[1] as string] = entry[2] as string;
  }
  return { packages, body: match[2] ?? "" };
};

/** The exact five-package `minor` front matter the fixed group requires. */
const expectedFrontMatter = (): Record<string, string> =>
  Object.fromEntries(FIXED_PACKAGES.map((pkg) => [pkg, "minor"]));

const addedFileViolations = (
  name: string,
  content: string,
  violations: ReleaseViolation[],
): void => {
  const parsed = parseChangeset(content);
  if (parsed === null) {
    violations.push({
      code: "changeset.frontmatter.malformed",
      detail: `${name} has no parseable "---" front matter of "package": bump lines`,
    });
    return;
  }
  for (const pkg of FIXED_PACKAGES) {
    if (!Object.hasOwn(parsed.packages, pkg)) {
      violations.push({
        code: "changeset.package.missing",
        detail: `${pkg} is missing from ${name}, which must declare exactly the five fixed-group packages`,
      });
    }
  }
  for (const pkg of Object.keys(parsed.packages).sort()) {
    if (!FIXED_PACKAGE_SET.has(pkg)) {
      violations.push({
        code: "changeset.package.unexpected",
        detail: `${pkg} is declared in ${name}; only the five fixed-group packages may appear`,
      });
    }
  }
  for (const pkg of FIXED_PACKAGES) {
    const bump = parsed.packages[pkg];
    if (bump !== undefined && bump !== "minor") {
      violations.push({
        code: "changeset.bump.not-minor",
        detail: `${pkg} is declared ${bump} in ${name}, expected minor`,
      });
    }
  }
  if (parsed.body.trim().length === 0) {
    violations.push({
      code: "changeset.body.empty",
      detail: `${name} has an empty body`,
    });
  }
};

/**
 * The whole TC-SYNC-011 invariant over one snapshot. The live assertion calls it
 * with the tree; each mutation control calls it with a mutated copy, so every
 * control exercises the same code path it protects.
 */
export const releaseViolations = (
  snapshot: TreeSnapshot,
  baseline: ChangesetBaseline,
): ReleaseViolation[] => {
  const violations: ReleaseViolation[] = [];
  const present = Object.keys(snapshot.files).sort();
  const added = present.filter((name) => !Object.hasOwn(baseline.changesets, name));

  const expected = [...(baseline.expectedAdded ?? ADDED_CHANGESETS)];
  if (added.length === 0) {
    violations.push({
      code: "changeset.added.zero",
      detail: `expected exactly ${expected.join(", ")}, found none across ${present.length} files`,
    });
  } else {
    const unexpected = added.filter((name) => !expected.includes(name));
    const missing = expected.filter((name) => !added.includes(name));
    if (unexpected.length > 0 || missing.length > 0) {
      violations.push({
        code: "changeset.added.multiple",
        detail: `expected exactly ${expected.join(", ")}, found ${added.join(", ")}`,
      });
    }
  }

  for (const name of Object.keys(baseline.changesets).sort()) {
    const expected = baseline.changesets[name] ?? "<unpinned>";
    const content = snapshot.files[name];
    const actual = content === undefined ? "<deleted>" : digestOf(content);
    if (actual !== expected) {
      violations.push({
        code: "changeset.baseline.digest",
        detail: `${name} expected ${expected} received ${actual}`,
      });
    }
  }

  for (const name of added) {
    addedFileViolations(name, snapshot.files[name] ?? "", violations);
  }

  for (const pkg of FIXED_PACKAGES) {
    const expected = baseline.fixedPackages[pkg] ?? "<unpinned>";
    const actual = snapshot.versions[pkg] ?? "<missing>";
    if (actual !== expected) {
      violations.push({
        code: "changeset.version.hand-edited",
        detail: `${pkg} expected ${expected} received ${actual}`,
      });
    }
  }

  return violations;
};

const readTree = (): TreeSnapshot => {
  const files: Record<string, string> = {};
  for (const name of readdirSync(join(ROOT, CHANGESET_DIR)).sort()) {
    if (!name.endsWith(".md")) continue;
    files[name] = readFileSync(join(ROOT, CHANGESET_DIR, name), "utf8");
  }
  const versions: Record<string, string> = {};
  for (const pkg of FIXED_PACKAGES) {
    const dir = pkg.slice("@delivery-os/".length);
    const manifest = JSON.parse(
      readFileSync(join(ROOT, "packages", dir, "package.json"), "utf8"),
    ) as { version?: string };
    versions[pkg] = manifest.version ?? "<missing>";
  }
  return { files, versions };
};

const baseline = JSON.parse(readFileSync(join(ROOT, PIN_PATH), "utf8")) as ChangesetBaseline;

const addedFrom = (snapshot: TreeSnapshot): string[] =>
  Object.keys(snapshot.files)
    .filter((name) => !Object.hasOwn(baseline.changesets, name))
    .sort();

const codesOf = (violations: readonly ReleaseViolation[]): string[] =>
  violations.map((violation) => violation.code);

const detailOf = (violations: readonly ReleaseViolation[], code: string): string =>
  violations.find((violation) => violation.code === code)?.detail ?? "";

const validAddedText = (frontMatter: string, body = "A release note.\n"): string =>
  `---\n${frontMatter}\n---\n\n${body}`;

const fiveMinorLines = (): string => FIXED_PACKAGES.map((pkg) => `"${pkg}": minor`).join("\n");

/** A synthetic, self-consistent baseline so the controls never depend on the tree. */
const controlFiles = (): Record<string, string> => ({
  "baseline-one-minor.md": validAddedText(`"@delivery-os/core": minor`),
  "baseline-two-minor.md": validAddedText(`"@delivery-os/core": minor`),
});

const controlVersions = (): Record<string, string> =>
  Object.fromEntries(FIXED_PACKAGES.map((pkg) => [pkg, "0.0.0"]));

const controlBaseline = (): ChangesetBaseline => {
  const files = controlFiles();
  return {
    provenance: "mutation-control fixture, not a tree pin",
    expectedAdded: ["control-added-minor.md"],
    fixedPackages: controlVersions(),
    changesets: Object.fromEntries(
      Object.entries(files).map(([name, content]) => [name, digestOf(content)]),
    ),
  };
};

/** The valid control tree: two pinned files, the five packages and one added changeset. */
const controlTree = (): TreeSnapshot => ({
  files: {
    ...controlFiles(),
    "control-added-minor.md": validAddedText(fiveMinorLines()),
  },
  versions: controlVersions(),
});

/**
 * The control baseline with its expected set replaced by the live declared
 * additions, so the zero- and two-added controls exercise the same declared set
 * the live assertion reads.
 */
const declaredControlBaseline = (): ChangesetBaseline => ({
  ...controlBaseline(),
  expectedAdded: [...ADDED_CHANGESETS],
});

describe("TC-SYNC-011 the phase-1 changeset baseline pin", () => {
  test("the pin holds the 64 delivered changesets and the five fixed packages", () => {
    expect(baseline.provenance.length).toBeGreaterThan(0);
    const pinned = Object.keys(baseline.changesets).sort();
    expect(pinned).toHaveLength(PINNED_CHANGESET_COUNT);
    expect(Object.keys(baseline.fixedPackages).sort()).toEqual([...FIXED_PACKAGES].sort());
    for (const [name, value] of Object.entries(baseline.changesets)) {
      expect(value, name).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  test("the delivered changeset directory is the baseline plus exactly the three declared additions", () => {
    const added = addedFrom(readTree());
    expect(added).toEqual([...ADDED_CHANGESETS].sort());
  });

  test("each added changeset declares the five fixed packages at minor and no other", () => {
    const snapshot = readTree();
    for (const name of addedFrom(snapshot)) {
      const parsed = parseChangeset(snapshot.files[name] ?? "");
      expect(parsed, name).not.toBeNull();
      expect(parsed?.packages, name).toEqual(expectedFrontMatter());
      expect(Object.hasOwn(parsed?.packages ?? {}, "@delivery-os/testkit"), name).toBe(false);
      expect(parsed?.body.trim().length ?? 0, name).toBeGreaterThan(0);
    }
  });

  test("the release surface is additive and no package version is hand-edited", () => {
    const snapshot = readTree();
    expect(releaseViolations(snapshot, baseline)).toEqual([]);
    expect(snapshot.versions).toEqual(baseline.fixedPackages);
  });
});

describe("TC-SYNC-011 mutation controls fail by name", () => {
  test("M117 — zero added changesets", () => {
    const violations = releaseViolations(
      { files: controlFiles(), versions: controlVersions() },
      declaredControlBaseline(),
    );
    expect(codesOf(violations)).toContain("changeset.added.zero");
    expect(violations).toHaveLength(1);
    const detail = detailOf(violations, "changeset.added.zero");
    for (const name of ADDED_CHANGESETS) {
      expect(detail).toContain(name);
    }
    expect(detail).toContain("found none");
  });

  test("M118 — two added changesets", () => {
    const tree = controlTree();
    const files = {
      ...tree.files,
      "control-second-minor.md": validAddedText(fiveMinorLines()),
    };
    const violations = releaseViolations(
      { files, versions: tree.versions },
      declaredControlBaseline(),
    );
    expect(codesOf(violations)).toContain("changeset.added.multiple");
    const detail = detailOf(violations, "changeset.added.multiple");
    expect(detail).toContain("control-added-minor.md");
    expect(detail).toContain("control-second-minor.md");
    for (const name of ADDED_CHANGESETS) {
      expect(detail).toContain(name);
    }
  });

  test("M119 — a patch bump on one of the five packages", () => {
    const tree = controlTree();
    const files = {
      ...tree.files,
      "control-added-minor.md": validAddedText(
        `"@delivery-os/core": minor\n"@delivery-os/adapters": minor\n"@delivery-os/cli": patch\n"@delivery-os/mcp": minor\n"@delivery-os/opencode": minor`,
      ),
    };
    const violations = releaseViolations({ files, versions: tree.versions }, controlBaseline());
    expect(codesOf(violations)).toContain("changeset.bump.not-minor");
    const detail = detailOf(violations, "changeset.bump.not-minor");
    expect(detail).toContain("@delivery-os/cli");
    expect(detail).toContain("patch");
    expect(detail).toContain("minor");
  });

  test("M120 — a sixth package or testkit in the front matter", () => {
    const tree = controlTree();
    const sixth = releaseViolations(
      {
        files: {
          ...tree.files,
          "control-added-minor.md": validAddedText(
            `${fiveMinorLines()}\n"@delivery-os/sixth": minor`,
          ),
        },
        versions: tree.versions,
      },
      controlBaseline(),
    );
    expect(codesOf(sixth)).toContain("changeset.package.unexpected");
    expect(detailOf(sixth, "changeset.package.unexpected")).toContain("@delivery-os/sixth");

    const withTestkit = releaseViolations(
      {
        files: {
          ...tree.files,
          "control-added-minor.md": validAddedText(
            `${fiveMinorLines()}\n"@delivery-os/testkit": minor`,
          ),
        },
        versions: tree.versions,
      },
      controlBaseline(),
    );
    expect(codesOf(withTestkit)).toContain("changeset.package.unexpected");
    expect(detailOf(withTestkit, "changeset.package.unexpected")).toContain("@delivery-os/testkit");
  });

  test("M121 — an empty body", () => {
    const tree = controlTree();
    const violations = releaseViolations(
      {
        files: {
          ...tree.files,
          "control-added-minor.md": validAddedText(fiveMinorLines(), "  \n"),
        },
        versions: tree.versions,
      },
      controlBaseline(),
    );
    expect(codesOf(violations)).toContain("changeset.body.empty");
    expect(detailOf(violations, "changeset.body.empty")).toContain("control-added-minor.md");
  });

  test("M122 — a modified pre-existing changeset", () => {
    const baselineControl = controlBaseline();
    const tree = controlTree();
    const violations = releaseViolations(
      {
        files: {
          ...tree.files,
          "baseline-two-minor.md": `${tree.files["baseline-two-minor.md"] ?? ""}edited\n`,
        },
        versions: tree.versions,
      },
      baselineControl,
    );
    expect(codesOf(violations)).toContain("changeset.baseline.digest");
    const detail = detailOf(violations, "changeset.baseline.digest");
    expect(detail).toContain("baseline-two-minor.md");
    expect(detail).toContain(baselineControl.changesets["baseline-two-minor.md"] ?? "<unpinned>");
    expect(detail).toContain(digestOf(`${tree.files["baseline-two-minor.md"] ?? ""}edited\n`));
  });

  test("M123 — a hand-edited package version", () => {
    const tree = controlTree();
    const violations = releaseViolations(
      { files: tree.files, versions: { ...tree.versions, "@delivery-os/cli": "0.0.1" } },
      controlBaseline(),
    );
    expect(codesOf(violations)).toContain("changeset.version.hand-edited");
    const detail = detailOf(violations, "changeset.version.hand-edited");
    expect(detail).toContain("@delivery-os/cli");
    expect(detail).toContain("expected 0.0.0");
    expect(detail).toContain("received 0.0.1");
  });
});
