/**
 * TC-IDENT-002 — the linked-only enumeration guard (GH-404 F-10, NFR-8,
 * AC-F10-1, DEC-5): the settled position-independent form. A porcelain block
 * is the main checkout exactly when its git directory is the repository's
 * common directory; the positional first-block pin is NOT implemented (it
 * remains only a documented fallback). The guard asserts the common-dir rule
 * directly and proves order-insensitivity by shuffling the fixture block
 * order across permutations.
 */
import { describe, expect, test } from "bun:test";
import { parseWorktreeListing } from "@delivery-os/adapters/git";

const MAIN = "/repos/checkout";
const LINKED_A = "/repos/checkout-wt-a";
const LINKED_B = "/repos/checkout-wt-b";
const COMMON_DIR = `${MAIN}/.git`;

const block = (path: string, branch: string, head: string): string =>
  `worktree ${path}\nHEAD ${head}\nbranch refs/heads/${branch}`;

const mainBlock = block(MAIN, "main-tools", "a".repeat(40));
const linkedABlock = block(LINKED_A, "lane/GH-1", "b".repeat(40));
const linkedBBlock = `worktree ${LINKED_B}\nHEAD ${"c".repeat(40)}\ndetached`;

const shuffle = <T>(items: readonly [T, T, T, ...T[]]): readonly T[] => {
  // Deterministic rotation: a non-identity permutation proves the reading is
  // order-independent (the main block is not first).
  const [first, second, third, ...rest] = items;
  return [second, third, first, ...rest];
};

describe("TC-IDENT-002 the linked-only enumeration is position-independent", () => {
  test("a block is the main checkout exactly when its git dir is the common dir", () => {
    const listing = parseWorktreeListing([mainBlock, linkedABlock].join("\n\n"), COMMON_DIR);
    expect(listing.mainCheckoutPath).toBe(MAIN);
    expect(listing.linked).toEqual([
      { path: LINKED_A, branch: "lane/GH-1", head: "b".repeat(40), locked: false },
    ]);
  });

  test("the linked-only reading is identical under shuffled block order", () => {
    const forward = parseWorktreeListing(
      [mainBlock, linkedABlock, linkedBBlock].join("\n\n"),
      COMMON_DIR,
    );
    const shuffled = parseWorktreeListing(
      shuffle([mainBlock, linkedABlock, linkedBBlock]).join("\n\n"),
      COMMON_DIR,
    );
    const reversed = parseWorktreeListing(
      [linkedBBlock, linkedABlock, mainBlock].join("\n\n"),
      COMMON_DIR,
    );
    expect(shuffled.mainCheckoutPath).toBe(MAIN);
    expect(reversed.mainCheckoutPath).toBe(MAIN);
    expect(shuffled.linked.map((fact) => fact.path).sort()).toEqual(
      forward.linked.map((fact) => fact.path).sort(),
    );
    expect(reversed.linked.map((fact) => fact.path).sort()).toEqual(
      forward.linked.map((fact) => fact.path).sort(),
    );
    // The detached linked worktree carries no branch; the main checkout's
    // branch never leaks into the linked inventory.
    expect(forward.linked.some((fact) => fact.branch === "main-tools")).toBe(false);
    expect(forward.linked.find((fact) => fact.path === LINKED_B)?.branch).toBeUndefined();
  });

  test("locked and bare attributes parse identically regardless of position", () => {
    const lockedBlock = `${block(LINKED_A, "lane/GH-1", "b".repeat(40))}\nlocked`;
    const bareBlock = `worktree /repos/bare\nbare\nHEAD ${"d".repeat(40)}`;
    const forward = parseWorktreeListing([mainBlock, lockedBlock].join("\n\n"), COMMON_DIR);
    const reordered = parseWorktreeListing([lockedBlock, mainBlock].join("\n\n"), COMMON_DIR);
    expect(forward.linked[0]?.locked).toBe(true);
    expect(reordered.linked[0]?.locked).toBe(true);
    // A bare repository row is never the main checkout and never a linked row.
    const withBare = parseWorktreeListing(
      [bareBlock, mainBlock, linkedABlock].join("\n\n"),
      COMMON_DIR,
    );
    expect(withBare.linked.some((fact) => fact.path === "/repos/bare")).toBe(false);
    expect(withBare.mainCheckoutPath).toBe(MAIN);
  });

  test("the branch-checked-out-elsewhere reading is linked-only under shuffling", () => {
    // The delivered seam reads the parsed listing: a branch checked out in
    // the MAIN checkout is not "elsewhere"; in a linked worktree it is.
    const mainOnly = parseWorktreeListing([mainBlock].join("\n\n"), COMMON_DIR);
    expect(mainOnly.linked.some((fact) => fact.branch === "main-tools")).toBe(false);
    const shuffledWithLinked = parseWorktreeListing(
      shuffle([mainBlock, linkedABlock, linkedBBlock]).join("\n\n"),
      COMMON_DIR,
    );
    expect(shuffledWithLinked.linked.some((fact) => fact.branch === "lane/GH-1")).toBe(true);
  });
});

/**
 * F-12 (review remediation) — the resolver-based git-dir equality: a main
 * checkout whose git directory is NOT `<path>/.git` (separate-git-dir,
 * submodule) classifies as the MAIN checkout when its resolved git dir equals
 * the common directory — the seam passes one bounded
 * `rev-parse --absolute-git-dir` resolution per block.
 */
describe("F-12 the resolved git-dir equality classifies non-standard layouts", () => {
  test("a separate-git-dir main checkout is the main checkout under the resolver", () => {
    const separateGitDirMain = "/repos/checkout";
    const realGitDir = "/elsewhere/checkout-git";
    const listing = parseWorktreeListing(
      [block(separateGitDirMain, "main-tools", "a".repeat(40)), linkedABlock].join("\n\n"),
      realGitDir,
      (checkoutPath) => (checkoutPath === separateGitDirMain ? realGitDir : `${checkoutPath}/.git`),
    );
    expect(listing.mainCheckoutPath).toBe(separateGitDirMain);
    expect(listing.linked).toEqual([
      { path: LINKED_A, branch: "lane/GH-1", head: "b".repeat(40), locked: false },
    ]);
  });
});
