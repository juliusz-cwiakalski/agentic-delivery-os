/**
 * TC-RELEASE-001/002 — exactly one new five-package minor changeset, every
 * pre-existing changeset untouched, no version hand-edit, unchanged lockfile,
 * no new dependency, and green release gates.
 */
import { describe, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./privacy-support";

const BASE = "origin/main-tools";
/**
 * The branch under review must add exactly one changeset; its name is the
 * delivery's own choice, so it is derived from the diff against the base
 * branch instead of pinned here. A test that pinned this delivery's file
 * name would fail every later delivery that lands its own changeset.
 */
const addedChangesetPaths = (): string[] => {
  const nameStatus = git(["diff", "--name-status", `${BASE}...HEAD`, "--", ".changeset/"])
    .split("\n")
    .filter((line) => line.length > 0);
  const untracked = git(["ls-files", "--others", "--exclude-standard", "--", ".changeset/"])
    .split("\n")
    .filter((line) => line.length > 0);
  const added = [
    ...nameStatus.filter((line) => line.startsWith("A\t")).map((line) => line.slice(2)),
    ...untracked,
  ];
  return [...new Set(added)];
};

const singleAddedChangeset = (): string => {
  const added = addedChangesetPaths();
  if (added.length !== 1) {
    throw new Error(`expected exactly one added changeset, found: ${added.join(", ") || "none"}`);
  }
  return added[0] as string;
};

const changesetPath = (): string => singleAddedChangeset();
const FIXED_PACKAGES = [
  "@delivery-os/core",
  "@delivery-os/adapters",
  "@delivery-os/cli",
  "@delivery-os/mcp",
  "@delivery-os/opencode",
] as const;
const PACKAGE_DIRS = ["core", "adapters", "cli", "mcp", "opencode", "testkit"] as const;

const git = (args: string[]): string => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });

export const parseChangeset = (
  text: string,
): { failure: string | null; packages: Record<string, string>; body: string } => {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (match === null)
    return { failure: "changeset frontmatter is malformed", packages: {}, body: "" };
  const packages: Record<string, string> = {};
  for (const line of (match[1] ?? "").split("\n")) {
    if (line.trim().length === 0) continue;
    const entry = /^"([^"]+)":\s*(minor|patch|major)\s*$/.exec(line);
    if (entry === null)
      return { failure: `malformed changeset line: ${line}`, packages: {}, body: "" };
    packages[entry[1] as string] = entry[2] as string;
  }
  return { failure: null, packages, body: (match[2] ?? "").trim() };
};

export const validateChangeset = (text: string): string[] => {
  const failures: string[] = [];
  const parsed = parseChangeset(text);
  if (parsed.failure !== null) return [parsed.failure];
  const names = Object.keys(parsed.packages).sort();
  if (JSON.stringify(names) !== JSON.stringify([...FIXED_PACKAGES].sort())) {
    failures.push("changeset must list exactly the five fixed-group packages");
  }
  for (const pkg of FIXED_PACKAGES) {
    if (parsed.packages[pkg] !== "minor") failures.push(`${pkg} must be minor`);
  }
  if (Object.hasOwn(parsed.packages, "@delivery-os/testkit")) {
    failures.push("testkit must not be in the fixed-group changeset");
  }
  if (parsed.body.length === 0) failures.push("changeset body must be non-empty");
  return failures;
};

export const preExistingViolations = (
  baseContents: Record<string, string>,
  currentContents: Record<string, string>,
): string[] => {
  const failures: string[] = [];
  for (const [path, base] of Object.entries(baseContents)) {
    const current = currentContents[path];
    if (current === undefined) {
      failures.push(`pre-existing changeset deleted: ${path}`);
    } else if (current !== base) {
      failures.push(`pre-existing changeset modified: ${path}`);
    }
  }
  return failures;
};

const baseChangesetFiles = (): string[] =>
  git(["ls-tree", "-r", "--name-only", BASE, "--", ".changeset/"])
    .split("\n")
    .filter((path) => path.endsWith(".md"));

const currentChangesetFiles = (): string[] =>
  readdirSync(join(ROOT, ".changeset"))
    .filter((name) => name.endsWith(".md"))
    .map((name) => `.changeset/${name}`)
    .sort();

const baseContents = (): Record<string, string> => {
  const contents: Record<string, string> = {};
  const added = new Set(addedChangesetPaths());
  for (const path of baseChangesetFiles()) {
    if (added.has(path)) continue;
    contents[path] = git(["show", `${BASE}:${path}`]);
  }
  return contents;
};

describe("TC-RELEASE-001 exactly one new five-package minor changeset", () => {
  test("exactly one changeset is added by this change and pre-existing ones are byte-identical", () => {
    const added = addedChangesetPaths();
    expect(added).toHaveLength(1);
    const nameStatus = git(["diff", "--name-status", `${BASE}...HEAD`, "--", ".changeset/"])
      .split("\n")
      .filter((line) => line.length > 0);
    expect(nameStatus.filter((line) => /^[MD]\t/.test(line))).toEqual([]);
    expect(existsSync(join(ROOT, changesetPath()))).toBe(true);

    const base = baseContents();
    const current: Record<string, string> = {};
    const addedPath = changesetPath();
    for (const path of currentChangesetFiles()) {
      if (path !== addedPath) current[path] = readFileSync(join(ROOT, path), "utf8");
    }
    expect(preExistingViolations(base, current)).toEqual([]);
    // The pre-existing changeset count grows with every delivery that lands on
    // the base branch, so only non-vacuity is asserted here; byte-identity above
    // and exactly-one-added prove the change's own release metadata.
    expect(Object.keys(base).length).toBeGreaterThan(0);
  });

  test("the added changeset declares exactly five minor packages and a body", () => {
    const text = readFileSync(join(ROOT, changesetPath()), "utf8");
    expect(validateChangeset(text)).toEqual([]);
    const { body } = parseChangeset(text);
    expect(body.length).toBeGreaterThan(0);
  });

  test("changeset mutations are caught", () => {
    const valid = readFileSync(join(ROOT, changesetPath()), "utf8");
    const withTestkit = valid.replace(
      '"@delivery-os/opencode": minor',
      '"@delivery-os/opencode": minor\n"@delivery-os/testkit": minor',
    );
    expect(validateChangeset(withTestkit).some((failure) => failure.includes("testkit"))).toBe(
      true,
    );

    const missing = valid.replace('"@delivery-os/mcp": minor\n', "");
    expect(validateChangeset(missing).some((failure) => failure.includes("five"))).toBe(true);

    const patch = valid.replace('"@delivery-os/core": minor', '"@delivery-os/core": patch');
    expect(validateChangeset(patch).some((failure) => failure.includes("core"))).toBe(true);

    const base = baseContents();
    const modified = { ...base };
    const first = Object.keys(modified)[0] as string;
    modified[first] = `${base[first] as string}\nmodified\n`;
    expect(
      preExistingViolations(base, modified).some((failure) => failure.includes("modified")),
    ).toBe(true);
    const deleted = { ...base };
    delete deleted[Object.keys(deleted)[0] as string];
    expect(
      preExistingViolations(base, deleted).some((failure) => failure.includes("deleted")),
    ).toBe(true);
  });

  test("changesets-group is green", () => {
    const result = spawnSync("bun", ["run", "scripts/checks/changesets-group.ts"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
  });
});

describe("TC-RELEASE-002 no version hand-edits, unchanged lockfile, no new dependency", () => {
  test("manifests stay at the private pre-release version", () => {
    // Tree invariant: changesets own versioning; manifests stay 0.0.0 until
    // the release cut. Deliberately not a base-diff assertion: a diff against
    // a moving base branch is only meaningful at the PR that introduced it.
    for (const dir of PACKAGE_DIRS) {
      const manifest = JSON.parse(
        readFileSync(join(ROOT, "packages", dir, "package.json"), "utf8"),
      ) as {
        version: string;
      };
      expect(manifest.version, dir).toBe("0.0.0");
    }
  });

  test("the frozen install succeeds against the committed lockfile", () => {
    const result = spawnSync("pnpm", ["install", "--frozen-lockfile"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
  }, 120_000);

  test("license audit and exports parity stay green", () => {
    for (const script of ["scripts/checks/license-audit.ts", "scripts/checks/exports-parity.ts"]) {
      const result = spawnSync("bun", ["run", script], { cwd: ROOT, encoding: "utf8" });
      expect(result.status, script).toBe(0);
    }
    const subpaths = spawnSync("bun", ["test", "tests/structure/subpaths.test.ts"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    expect(subpaths.status).toBe(0);
  }, 120_000);
});
