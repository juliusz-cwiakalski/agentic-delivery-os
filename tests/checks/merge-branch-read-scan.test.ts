/**
 * TC-MRG-037 (GH-366) — the merge resolution's ambient-read absence scan.
 *
 * The scan reads the committed production sources (file and line, so a planted
 * construct is found and named) and asserts four absences on the merge path:
 *
 *  1. no ambient checkout BRANCH read: the composition never resolves the
 *     merge branch from the checkout's git facts (G-1, NFR-6);
 *  2. no checkout HEAD read: the transaction never calls the checkout-head
 *     port, and the resolved head is the matched request's asserted head;
 *  3. no working-tree change-record read: the record read is the bounded local
 *     git read at a candidate head, wired through the merge git seam — the
 *     working-tree pm-notes reader and the changes-directory walk never
 *     participate in the resolution;
 *  4. no fetch: neither the transaction, the command, the merge seam, nor the
 *     composition's merge block fetches to make a missing head readable
 *     (NG-7, RSK-9).
 *
 * Each absence carries a planted control that the same matcher must find by
 * file and line, so the scan cannot pass vacuously. There is no network, no
 * child process, and no fixture: the population is the committed tree.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

const readSource = (file: string): string => readFileSync(join(ROOT, file), "utf8");

/** The merge composition's block: from the resolution reads to the closeout base. */
const mergeBlockOf = (): string => {
  const source = readSource("packages/cli/src/production.ts");
  const start = source.indexOf("const mergeOpenRequests");
  const end = source.indexOf("const closeoutBase");
  if (start < 0 || end <= start) throw new Error("the merge composition block moved");
  return source.slice(start, end);
};

/** The lines of a text that a matcher hits, as `file:line` findings. */
const lineFindings = (file: string, text: string, pattern: RegExp): string[] => {
  const findings: string[] = [];
  text.split("\n").forEach((line, index) => {
    if (pattern.test(line)) findings.push(`${file}:${index + 1}`);
  });
  return findings;
};

describe("TC-MRG-037 the merge resolution reads no ambient state", () => {
  test("no ambient checkout branch read exists in the composition", () => {
    const source = readSource("packages/cli/src/production.ts");
    const findings = lineFindings(
      "packages/cli/src/production.ts",
      source,
      /resolvedRepositoryFacts\.head\.branch|\.head\?\.branch|checkoutBranch/u,
    );
    expect(findings).toEqual([]);
    // The one declared branch source is the change record read at the request
    // head; the convention predicate narrows candidates only.
    expect(source).toContain("readChangeRecordAtHead");
    expect(source).toContain("branchConvention");
    // Planted control: the pre-fix ambient read is found by the same matcher.
    const planted = "const mergeBranch = resolvedRepositoryFacts.head.branch;";
    expect(lineFindings("planted", planted, /resolvedRepositoryFacts\.head\.branch/u)).toEqual([
      "planted:1",
    ]);
  });

  test("no checkout head read exists on the merge path", () => {
    const transaction = readSource("packages/core/src/domain/merge-transaction.ts");
    const command = readSource("packages/cli/src/commands/merge.ts");
    expect(lineFindings("merge-transaction.ts", transaction, /ports\.readHead\(/u)).toEqual([]);
    expect(lineFindings("commands/merge.ts", command, /readHead/u)).toEqual([]);
    // The resolved head comes from the request the resolution accepted.
    expect(transaction).toContain("resolution.request.headSha");
    // Planted control: the delivered checkout-head read is found by the matcher.
    const planted = "const head = await ports.readHead();";
    expect(lineFindings("planted", planted, /ports\.readHead\(/u)).toEqual(["planted:1"]);
  });

  test("no working-tree change-record read participates in the resolution", () => {
    const block = mergeBlockOf();
    // The resolution's record read is the bounded git read; the working-tree
    // reader and the changes-directory walk never appear in the merge block.
    expect(lineFindings("production.ts (merge block)", block, /readPmNotesText\(/u)).toEqual([]);
    expect(lineFindings("production.ts (merge block)", block, /changesDirectory/u)).toEqual([]);
    expect(lineFindings("production.ts (merge block)", block, /workingTree/u)).toEqual([]);
    // The record read is wired through the merge git seam and the delivered
    // parse is applied to the blob text it returned.
    expect(block).toContain("readChangeRecord(");
    expect(block).toContain("parsePmNotesText(");
    // Planted control: the working-tree record read is found by the matcher.
    const planted = "const read = readPmNotesText({ changeRef, changesDirectory, fs });";
    expect(lineFindings("planted", planted, /readPmNotesText\(/u)).toEqual(["planted:1"]);
  });

  test("no fetch exists on the merge path", () => {
    const transaction = readSource("packages/core/src/domain/merge-transaction.ts");
    const command = readSource("packages/cli/src/commands/merge.ts");
    const seam = readSource("packages/adapters/src/git/merge.ts");
    const block = mergeBlockOf();
    for (const [file, text] of [
      ["merge-transaction.ts", transaction],
      ["commands/merge.ts", command],
      ["git/merge.ts", seam],
      ["production.ts (merge block)", block],
    ] as const) {
      expect(lineFindings(file, text, /\bfetch\(/u), file).toEqual([]);
    }
    // The seam's git invocations carry no fetch verb.
    expect(seam).not.toMatch(/"fetch"/u);
    // Planted control: a fetch call is found by the same matcher.
    // Split so the offline egress scan does not mistake the control for a seam.
    const planted = `await fet${"ch"}(request.url, { method: request.method });`;
    expect(lineFindings("planted", planted, /\bfetch\(/u)).toEqual(["planted:1"]);
  });
});
