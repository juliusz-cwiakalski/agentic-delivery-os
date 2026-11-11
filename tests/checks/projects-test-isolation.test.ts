/**
 * GH-288 TC-PROJ-038 — test isolation: the guard, the leak detector, and the
 * fixture meta-assertions.
 *
 * The guard's own negative controls are what make it live: a guard that always
 * passes would fail step 2. The fingerprint is a read-only snapshot, so it is
 * valid on a machine whose real state directory is already populated — which is
 * exactly the machine a leak would damage.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { findGitRoot, nodeRepositoryIo } from "../../packages/adapters/src/repo/index";
import {
  APPROVED_BASE,
  brandOf,
  createHostFixture,
  guardStateFixtureRoot,
  nonCheckoutDirectory,
  realStateDirectory,
  realStateFingerprint,
} from "../fixtures/projects/state-scope";

const ROOT = process.cwd();

const ancestorDirectories = (directory: string): string[] => {
  const ancestors: string[] = [];
  let current = resolve(directory);
  for (;;) {
    const parent = dirname(current);
    if (parent === current) break;
    ancestors.push(parent);
    current = parent;
  }
  return ancestors;
};

describe("TC-PROJ-038 the fixture guard", () => {
  test("passes under the approved base and under the OS temp root outside the checkout", () => {
    mkdirSync(APPROVED_BASE, { recursive: true });
    expect(() => guardStateFixtureRoot(APPROVED_BASE)).not.toThrow();
    const outside = nonCheckoutDirectory("guard-pass");
    try {
      expect(() => guardStateFixtureRoot(outside)).not.toThrow();
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  test("refuses the live workspace root, its ancestors, and the real state directory", () => {
    const brand = brandOf();
    expect(() => guardStateFixtureRoot(process.cwd(), { brand })).toThrow(/live workspace/u);
    for (const ancestor of ancestorDirectories(process.cwd()).slice(0, 3)) {
      let threw = false;
      try {
        guardStateFixtureRoot(ancestor, { brand });
      } catch (error) {
        threw = true;
        expect((error as Error).message).toContain(resolve(ancestor));
      }
      expect(threw).toBe(true);
    }
    const real = realStateDirectory(brand);
    let message = "";
    try {
      guardStateFixtureRoot(real, { brand });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain(resolve(real));
    expect(message).toContain("real state directory");
  });

  test("refuses a path outside both the approved base and the OS temp root", () => {
    const outside = "/etc/gh288-not-an-approved-root";
    expect(() => guardStateFixtureRoot(outside)).toThrow(/outside the approved base/u);
  });

  test("the real state fingerprint is unchanged across a representative suite", () => {
    const brand = brandOf();
    const before = realStateFingerprint(brand);
    const host = createHostFixture("fingerprint");
    try {
      expect(realStateFingerprint(brand)).toBe(before);
    } finally {
      host.dispose();
    }
    expect(realStateFingerprint(brand)).toBe(before);
  });

  test("the host root and the home are distinct and neither is an ancestor", () => {
    const host = createHostFixture("distinctness");
    try {
      expect(host.home).not.toBe(host.hostRoot);
      expect(host.home.startsWith(`${host.hostRoot}/`)).toBe(false);
      expect(host.hostRoot.startsWith(`${host.home}/`)).toBe(false);
      expect(host.environment.HOME).toBe(host.home);
    } finally {
      host.dispose();
    }
  });

  test("every projects suite and fixture reaches the guard before opening a store", () => {
    const fixtures = readdirSync(join(ROOT, "tests", "fixtures", "projects"))
      .filter((name) => name.endsWith(".ts"))
      .filter((name) => name !== "state-scope.ts")
      .map((name) => join("tests", "fixtures", "projects", name));
    const suites = readdirSync(join(ROOT, "tests", "behaviour"))
      .filter((name) => name.startsWith("projects-") && name.endsWith(".test.ts"))
      .map((name) => join("tests", "behaviour", name));
    const offenders: string[] = [];
    for (const relative of [...fixtures, ...suites]) {
      const source = readFileSync(join(ROOT, relative), "utf8");
      const opensStore =
        source.includes("createStateStore(") || source.includes("createHostFixture(");
      const reachesGuard =
        source.includes("state-scope") || source.includes("guardStateFixtureRoot");
      if (opensStore && !reachesGuard) offenders.push(relative);
    }
    expect(offenders).toEqual([]);
  });

  test("the non-checkout helper proves its directory is outside every work tree", () => {
    const directory = nonCheckoutDirectory("probe");
    try {
      expect(findGitRoot(directory, nodeRepositoryIo())).toBeUndefined();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
    // The trap this guards against: a directory inside this repository's own
    // checkout resolves to this repository as its git root.
    const inside = join(APPROVED_BASE, "gh288-inside-probe");
    mkdirSync(inside, { recursive: true });
    try {
      expect(findGitRoot(inside, nodeRepositoryIo())).toBe(ROOT);
    } finally {
      rmSync(inside, { recursive: true, force: true });
    }
  });

  test("the approved base is the repository-local temp directory", () => {
    expect(resolve(APPROVED_BASE)).toBe(resolve(join(ROOT, "tmp", "tmpdir")));
    expect(resolve(APPROVED_BASE).startsWith(resolve(ROOT))).toBe(true);
  });
});
