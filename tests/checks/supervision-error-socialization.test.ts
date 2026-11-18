/**
 * TC-SUP-071 — machine rows, documented rows, and the corpus bind in both
 * directions for the two supervise identities (GH-295 F-8, AC-F8-1, RSK-6).
 *
 * Every mutation runs in a temporary copy; the live tree is never written.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { runSyncCheck } from "../../scripts/checks/error-table-sync";

const ROOT = process.cwd();
const DOC = "doc/spec/features/feature-result-contract.md";
const TABLE = "packages/core/src/contracts/error-table.ts";
const CORPUS = "tests/fixtures/result/code-corpora";
const tempRoots: string[] = [];

const makeTempRoot = (): string => {
  const root = mkdtempSync(join(tmpdir(), "gh295-sync-"));
  tempRoots.push(root);
  cpSync(join(ROOT, "packages/core/src/contracts"), join(root, "packages/core/src/contracts"), {
    recursive: true,
  });
  cpSync(join(ROOT, "packages/cli/src"), join(root, "packages/cli/src"), { recursive: true });
  cpSync(join(ROOT, "tests/fixtures/result"), join(root, "tests/fixtures/result"), {
    recursive: true,
  });
  mkdirSync(join(root, "doc/spec/features"), { recursive: true });
  cpSync(join(ROOT, DOC), join(root, DOC));
  return root;
};

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root !== undefined) rmSync(root, { recursive: true, force: true });
  }
});

const readFile = (root: string, relative: string): string =>
  readFileSync(join(root, relative), "utf8");

const editFile = (root: string, relative: string, edit: (text: string) => string): void => {
  const path = join(root, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, edit(readFile(root, relative)));
};

const messages = (failures: readonly string[]): string =>
  failures.map((failure) => failure.replace(/^[^:]+: /u, "")).join("\n");

const ROW_DUPLICATE =
  "| supervise.duplicate-supervision | supervise | user | true | not_landed | Wait for the named supervision authority to stop acting on the object, then rerun supervise; the refused action never lands. | user-validation | Another supervision authority is actively acting on the targeted object. |";

describe("TC-SUP-071 the live tree binds the two supervise rows", () => {
  test("the sync check is green and reports the moved counts", async () => {
    const result = await runSyncCheck({ root: ROOT });
    expect(result.failures).toEqual([]);
    expect(result.counts.sourceEntries).toBe(160);
    expect(result.counts.documentedRows).toBe(160);
    expect(result.counts.corpusRows).toBe(81);
  });
});

describe("TC-SUP-071 both directions fail with the offending row named", () => {
  test("dropping a documented supervise row fails documented-to-machine", async () => {
    const root = makeTempRoot();
    editFile(root, DOC, (text) => text.replace(`${ROW_DUPLICATE}\n`, ""));
    const result = await runSyncCheck({ root });
    expect(result.failures.join("\n")).toContain(
      "source entry supervise.duplicate-supervision is undocumented",
    );
  });

  test("adding an undocumented machine row fails machine-to-documented", async () => {
    const root = makeTempRoot();
    editFile(root, TABLE, (text) =>
      text.replace(
        /\] as const satisfies readonly ErrorTableEntry\[\];/u,
        `  {\n    code: "supervise.undocumented.row",\n    domainKind: "supervise",\n    category: "user",\n    retryable: false,\n    consequence: "not_landed",\n    remediationHint: "Remove the stray row.",\n    projectionClass: "user-validation",\n    summary: "An undocumented supervise row.",\n  },\n] as const satisfies readonly ErrorTableEntry[];`,
      ),
    );
    const result = await runSyncCheck({ root });
    expect(messages(result.failures)).toContain(
      "source entry supervise.undocumented.row is undocumented",
    );
  });

  test("a corpus row whose expectation drifts fails the corpus direction naming it", async () => {
    const root = makeTempRoot();
    editFile(root, `${CORPUS}/true-positives.json`, (text) => {
      const parsed = JSON.parse(text) as { rows: { id: string; resolves: boolean }[] };
      parsed.rows = parsed.rows.map((row) =>
        row.id === "supervise-evidence-absent" ? { ...row, resolves: false } : row,
      );
      return JSON.stringify(parsed, null, 2);
    });
    const result = await runSyncCheck({ root });
    expect(result.failures.join("\n")).toContain("supervise-evidence-absent");
    expect(messages(result.failures)).toContain("resolves expected false, got true");
  });

  test("the corpus carries a true positive for each new identity and a lookalike", () => {
    const positives = JSON.parse(readFile(ROOT, `${CORPUS}/true-positives.json`)) as {
      rows: { text: string; resolves: boolean }[];
    };
    const negatives = JSON.parse(readFile(ROOT, `${CORPUS}/false-positives.json`)) as {
      rows: { text: string; recognized: boolean }[];
    };
    for (const code of ["supervise.duplicate-supervision", "supervise.evidence-absent"]) {
      const row = positives.rows.find((candidate) => candidate.text === code);
      expect(row?.resolves, code).toBe(true);
    }
    const lookalike = negatives.rows.find((candidate) => candidate.text === "supervise.duplicate");
    expect(lookalike?.recognized).toBe(false);
  });

  test("a foreign-namespace literal is ignored and counted, not flagged", async () => {
    const root = makeTempRoot();
    editFile(root, DOC, (text) =>
      text.replace(
        "### Documented error table",
        "### Documented error table\n\nA foreign literal `example.namespace.ignored` is not an identity.",
      ),
    );
    const result = await runSyncCheck({ root });
    expect(result.failures).toEqual([]);
  });

  test("the check fails closed on an unparseable documented table", async () => {
    const root = makeTempRoot();
    editFile(root, DOC, () => "# no table here\n");
    const result = await runSyncCheck({ root });
    expect(result.failures.length).toBeGreaterThan(0);
  });
});
