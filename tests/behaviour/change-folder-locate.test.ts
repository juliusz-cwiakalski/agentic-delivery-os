/**
 * F-4 (supports TC-CAP-001 and TC-STAGE-001/005) — the plan, pm-notes, and
 * commit-staging view over the month-scan convention. Direct behavioural
 * coverage for `locateChangeFolder` and `relativeChangeFolder` over an
 * in-memory read-only filesystem: month scan ascending, exact `--<ref>--`
 * token match, repo-relative prefix strip, and the out-of-root return that lets
 * staging classify a folder as a stray.
 */
import { describe, expect, test } from "bun:test";
import {
  type ChangeFolderFileSystem,
  locateChangeFolder,
  relativeChangeFolder,
} from "../../packages/adapters/src/file/change-folder";

const CHANGES = "/repo/doc/changes";
const REF = "GH-242";

const memoryFs = (
  tree: Readonly<Record<string, readonly string[]>>,
  calls: string[] = [],
): ChangeFolderFileSystem => ({
  exists: (path) => {
    calls.push(`exists:${path}`);
    return Object.hasOwn(tree, path);
  },
  listDirectory: (path) => {
    calls.push(`list:${path}`);
    const entries = tree[path];
    if (entries === undefined) throw new Error(`ENOENT: ${path}`);
    return entries;
  },
});

const locate = (
  tree: Readonly<Record<string, readonly string[]>>,
  changeRef = REF,
): string | undefined =>
  locateChangeFolder({ changeRef, changesDirectory: CHANGES, fs: memoryFs(tree) });

describe("locateChangeFolder month scan", () => {
  test("scans YYYY-MM directories ascending and ignores non-month entries", () => {
    const tree = {
      [CHANGES]: ["2026-11", "archive", "2026-02", "2026-01"],
      [`${CHANGES}/2026-11`]: ["2026-11-07--GH-242--later"],
      [`${CHANGES}/2026-02`]: ["2026-02-03--GH-242--earlier"],
      [`${CHANGES}/2026-01`]: ["2026-01-09--GH-999--other"],
    };
    expect(locate(tree)).toBe(`${CHANGES}/2026-02/2026-02-03--GH-242--earlier`);
  });

  test("scans folder names ascending inside a month and takes the first match", () => {
    const tree = {
      [CHANGES]: ["2026-11"],
      [`${CHANGES}/2026-11`]: [
        "2026-11-07--GH-242--second",
        "2026-11-01--GH-242--first",
        "2026-11-03--GH-999--other",
      ],
    };
    expect(locate(tree)).toBe(`${CHANGES}/2026-11/2026-11-01--GH-242--first`);
  });

  test("matches only the exact --<ref>-- token", () => {
    const tree = {
      [CHANGES]: ["2026-11"],
      [`${CHANGES}/2026-11`]: [
        "2026-11-01--GH-2420--prefix-superset",
        "2026-11-02--GH-241--other-ref",
        "2026-11-03-GH-242-no-token",
        "2026-11-04--GH-242--match",
        "2026-11-05--GH-242--suffix",
      ],
    };
    expect(locate(tree)).toBe(`${CHANGES}/2026-11/2026-11-04--GH-242--match`);
  });

  test("an absent directory, a non-month match, or an invalid ref returns undefined", () => {
    expect(locate({})).toBeUndefined();
    expect(
      locate({
        [CHANGES]: ["2026-11"],
        [`${CHANGES}/2026-11`]: ["2026-11-04--GH-999--other"],
      }),
    ).toBeUndefined();
    expect(
      locateChangeFolder({
        changeRef: "gh-242",
        changesDirectory: CHANGES,
        fs: memoryFs({ [CHANGES]: ["2026-11"] }),
      }),
    ).toBeUndefined();
  });

  test("resolution reads only and never mutates the tree", () => {
    const tree: Record<string, readonly string[]> = {
      [CHANGES]: ["2026-11"],
      [`${CHANGES}/2026-11`]: ["2026-11-04--GH-242--match"],
    };
    const before = JSON.stringify(tree);
    const calls: string[] = [];
    expect(
      locateChangeFolder({ changeRef: REF, changesDirectory: CHANGES, fs: memoryFs(tree, calls) }),
    ).toBe(`${CHANGES}/2026-11/2026-11-04--GH-242--match`);
    expect(JSON.stringify(tree)).toBe(before);
    expect(calls).toEqual([`exists:${CHANGES}`, `list:${CHANGES}`, `list:${CHANGES}/2026-11`]);
  });
});

describe("relativeChangeFolder repo-relative prefix", () => {
  const tree = {
    [CHANGES]: ["2026-11"],
    [`${CHANGES}/2026-11`]: ["2026-11-04--GH-242--match"],
  };

  test("strips the repository root prefix", () => {
    expect(
      relativeChangeFolder({
        changeRef: REF,
        changesDirectory: CHANGES,
        repoRoot: "/repo",
        fs: memoryFs(tree),
      }),
    ).toBe("doc/changes/2026-11/2026-11-04--GH-242--match");
  });

  test("trims trailing separators from the repository root", () => {
    expect(
      relativeChangeFolder({
        changeRef: REF,
        changesDirectory: CHANGES,
        repoRoot: "/repo/",
        fs: memoryFs(tree),
      }),
    ).toBe("doc/changes/2026-11/2026-11-04--GH-242--match");
  });

  test("returns a folder outside the repository root unchanged", () => {
    expect(
      relativeChangeFolder({
        changeRef: REF,
        changesDirectory: CHANGES,
        repoRoot: "/other-repo",
        fs: memoryFs(tree),
      }),
    ).toBe(`${CHANGES}/2026-11/2026-11-04--GH-242--match`);
  });

  test("an unresolvable ref stays undefined", () => {
    expect(
      relativeChangeFolder({
        changeRef: "GH-999",
        changesDirectory: CHANGES,
        repoRoot: "/repo",
        fs: memoryFs(tree),
      }),
    ).toBeUndefined();
  });
});
