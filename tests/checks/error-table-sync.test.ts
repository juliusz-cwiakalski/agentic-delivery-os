/**
 * TC-SYNC-001..005 — the binding docs/code sync check is bidirectional,
 * non-vacuous, fail-closed, and level-scoped. Every mutation runs in a temp copy;
 * the live tree is never written.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
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
  const root = mkdtempSync(join(tmpdir(), "sync-check-"));
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

const writeFile = (root: string, relative: string, content: string): void => {
  const path = join(root, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
};

const readFile = (root: string, relative: string): string =>
  readFileSync(join(root, relative), "utf8");

const editFile = (root: string, relative: string, edit: (text: string) => string): void => {
  writeFile(root, relative, edit(readFile(root, relative)));
};

const ROW_INPUT =
  "| input.value.rejected | input | user | false | not_landed | Correct the rejected value and retry the command. | user-validation | The supplied value was rejected. |";
const ROW_INVOCATION =
  "| fallback.invocation | fallback | user | false | unknown | Check the command name and arguments, then retry the invocation. | user-validation | The invocation could not be understood. |";
const ROW_INTERNAL =
  "| fallback.internal | fallback | platform | false | unknown | Inspect the diagnostics stream and report the failure if it persists. | platform-provider | The failure could not be classified. |";
const ROW_CONFIG =
  "| config.value.invalid | config | user | false | not_landed | Correct the value to match the configuration schema and retry. | user-validation | A configuration value is invalid. |";

const insertDocRow =
  (row: string): ((text: string) => string) =>
  (text) =>
    text.replace(ROW_INVOCATION, `${row}\n${ROW_INVOCATION}`);

const removeDocRow =
  (row: string): ((text: string) => string) =>
  (text) =>
    text.replace(`${row}\n`, "");

const replaceTableCode =
  (from: string, to: string): ((text: string) => string) =>
  (text) =>
    text.replace(`code: "${from}"`, `code: "${to}"`);

const gitStatus = (): string =>
  execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" });

const messages = (failures: readonly string[]): string => failures.join("\n");

afterEach(() => {
  for (const root of tempRoots) rmSync(root, { recursive: true, force: true });
  tempRoots.length = 0;
});

describe("TC-SYNC-001 delivered state", () => {
  test("is bidirectionally consistent, non-vacuous, and read-only", async () => {
    const before = gitStatus();
    const result = await runSyncCheck({ root: ROOT });
    expect(result.failures).toEqual([]);
    expect(result.counts.sourceEntries).toBeGreaterThan(0);
    expect(result.counts.documentedRows).toBe(result.counts.sourceEntries);
    expect(result.counts.recognizedS1).toBeGreaterThan(0);
    expect(result.counts.recognizedS3).toBeGreaterThan(0);
    expect(result.counts.corpusRows).toBeGreaterThan(0);
    expect(result.counts.ignoredLiterals).toBeGreaterThan(0);
    expect(gitStatus()).toBe(before);
  });

  test("the two fallback codes appear exactly once on each side", async () => {
    const result = await runSyncCheck({ root: ROOT });
    const doc = readFile(ROOT, DOC);
    for (const code of ["fallback.invocation", "fallback.internal"]) {
      expect(doc.split(`| ${code} |`).length - 1).toBe(1);
    }
    expect(result.failures).toEqual([]);
  });
});

describe("TC-SYNC-002 drift A: unrecognized code references", () => {
  test("an undeclared code in a CLI module fails naming code, surface, and line", async () => {
    const root = makeTempRoot();
    editFile(
      root,
      "packages/cli/src/index.ts",
      (text) => `${text}\nconst drift = "input.legacy.marker";\n`,
    );
    const result = await runSyncCheck({ root });
    const text = messages(result.failures);
    expect(text).toContain("input.legacy.marker");
    expect(text).toContain("packages/cli/src/index.ts:");
    expect(text).toContain("S1");
  });

  test("an undeclared code in a fixture fails naming the fixture", async () => {
    const root = makeTempRoot();
    writeFile(
      root,
      "tests/fixtures/result/programs/drift.json",
      '{"note":"input.legacy.marker"}\n',
    );
    const result = await runSyncCheck({ root });
    const text = messages(result.failures);
    expect(text).toContain("input.legacy.marker");
    expect(text).toContain("tests/fixtures/result/programs/drift.json");
    expect(text).toContain("S3");
  });

  test("unresolvable codes never silently fall back to containment", async () => {
    const root = makeTempRoot();
    editFile(
      root,
      "packages/cli/src/index.ts",
      (text) => `${text}\nconst drift = "provider.legacy.marker";\n`,
    );
    const result = await runSyncCheck({ root });
    expect(messages(result.failures)).toContain("provider.legacy.marker");
  });
});

describe("TC-SYNC-003 drift B: documented rows without source entries", () => {
  test("a well-formed documented row for an absent code fails", async () => {
    const root = makeTempRoot();
    editFile(
      root,
      DOC,
      insertDocRow(
        "| input.phantom.entry | input | user | false | not_landed | Fix the value. | user-validation | Phantom. |",
      ),
    );
    const result = await runSyncCheck({ root });
    expect(messages(result.failures)).toContain(
      "documented code input.phantom.entry has no source entry",
    );
  });

  test("a row with a removed column fails on parse strictness", async () => {
    const root = makeTempRoot();
    editFile(root, DOC, (text) =>
      text.replace(ROW_INPUT, "| input.value.rejected | input | user | false |"),
    );
    const result = await runSyncCheck({ root });
    expect(messages(result.failures)).toContain("columns");
  });

  test("a missing documented table fails closed", async () => {
    const root = makeTempRoot();
    rmSync(join(root, DOC));
    const result = await runSyncCheck({ root });
    expect(messages(result.failures)).toContain("documented table file is missing");
  });

  test("a missing documented section fails closed", async () => {
    const root = makeTempRoot();
    writeFile(root, DOC, "# Result contract\n\nNo table here.\n");
    const result = await runSyncCheck({ root });
    expect(messages(result.failures)).toContain("missing ## Documented error table");
  });

  test("a phantom fallback row fails by name", async () => {
    const root = makeTempRoot();
    editFile(
      root,
      DOC,
      insertDocRow(
        "| fallback.legacy | fallback | user | false | unknown | Retry. | user-validation | Legacy. |",
      ),
    );
    const result = await runSyncCheck({ root });
    expect(messages(result.failures)).toContain("fallback.legacy");
  });
});

describe("TC-SYNC-004 drift C: source entries without documented rows", () => {
  test("config row drift fails from either side", async () => {
    const docMissing = makeTempRoot();
    editFile(docMissing, DOC, removeDocRow(ROW_CONFIG));
    expect(messages((await runSyncCheck({ root: docMissing })).failures)).toContain(
      "source entry config.value.invalid is undocumented",
    );
    const machineMissing = makeTempRoot();
    editFile(
      machineMissing,
      TABLE,
      replaceTableCode("config.value.invalid", "config.value.changed"),
    );
    const failures = messages((await runSyncCheck({ root: machineMissing })).failures);
    expect(failures).toContain("documented code config.value.invalid has no source entry");
    expect(failures).toContain("source entry config.value.changed is undocumented");
  });
  test("deleting a documented row reports the source entry as undocumented", async () => {
    const root = makeTempRoot();
    editFile(root, DOC, removeDocRow(ROW_INPUT));
    const result = await runSyncCheck({ root });
    expect(messages(result.failures)).toContain(
      "source entry input.value.rejected is undocumented",
    );
  });

  test("a new source entry without a documented row fails", async () => {
    const root = makeTempRoot();
    editFile(root, TABLE, replaceTableCode("input.value.rejected", "input.new.entry"));
    const result = await runSyncCheck({ root });
    expect(messages(result.failures)).toContain("input.new.entry is undocumented");
  });

  test("a duplicated documented row fails exactly-once", async () => {
    const root = makeTempRoot();
    editFile(root, DOC, (text) => text.replace(ROW_INPUT, `${ROW_INPUT}\n${ROW_INPUT}`));
    const result = await runSyncCheck({ root });
    expect(messages(result.failures)).toContain(
      "duplicate documented row for input.value.rejected",
    );
  });

  test("both fallback rows are reported when deleted (no exemption)", async () => {
    for (const [row, code] of [
      [ROW_INVOCATION, "fallback.invocation"],
      [ROW_INTERNAL, "fallback.internal"],
    ] as const) {
      const root = makeTempRoot();
      editFile(root, DOC, removeDocRow(row));
      const result = await runSyncCheck({ root });
      expect(messages(result.failures)).toContain(`source entry ${code} is undocumented`);
    }
  });
});

describe("TC-SYNC-005 identity hygiene and level separation", () => {
  test("duplicate source codes fail naming the duplicate", async () => {
    const root = makeTempRoot();
    editFile(root, TABLE, replaceTableCode("input.value.rejected", "provider.quota.exceeded"));
    const result = await runSyncCheck({ root });
    expect(messages(result.failures)).toContain("duplicate code");
  });

  test("invalid source entries fail", async () => {
    const cases: Array<[string, string]> = [
      ["provider.quota", "invalid code format"],
      ["Provider.Quota.Rejected", "invalid code format"],
      ["1input.value.rejected", "invalid code format"],
      ["https://example.invalid/error", "invalid code format"],
      ["HTTP_404", "invalid code format"],
      ["com.example.entry", "undeclared namespace com"],
    ];
    for (const [code, expected] of cases) {
      const root = makeTempRoot();
      editFile(root, TABLE, replaceTableCode("input.value.rejected", code));
      const result = await runSyncCheck({ root });
      expect(messages(result.failures), code).toContain(expected);
    }
  });

  test("false-positive corpus rows stay clean and un-counted", async () => {
    const root = makeTempRoot();
    editFile(root, `${CORPUS}/false-positives.json`, (text) => {
      const parsed = JSON.parse(text) as { rows: unknown[] };
      parsed.rows.push({
        id: "extra-foreign",
        text: "org.example.other.thing",
        recognized: false,
        resolves: false,
      });
      return `${JSON.stringify(parsed, null, 2)}\n`;
    });
    const result = await runSyncCheck({ root });
    expect(result.failures).toEqual([]);
  });

  test("true-positive corpus rows resolve", async () => {
    const root = makeTempRoot();
    editFile(root, `${CORPUS}/true-positives.json`, (text) => {
      const parsed = JSON.parse(text) as { rows: unknown[] };
      parsed.rows.push({
        id: "extra-declared",
        text: "provider.quota.exceeded",
        recognized: true,
        resolves: true,
      });
      return `${JSON.stringify(parsed, null, 2)}\n`;
    });
    const result = await runSyncCheck({ root });
    expect(result.failures).toEqual([]);
  });

  test("a foreign-namespace literal in S1/S3 is ignored and uncounted", async () => {
    const baselineRoot = makeTempRoot();
    const baseline = await runSyncCheck({ root: baselineRoot });
    const root = makeTempRoot();
    editFile(
      root,
      "packages/cli/src/index.ts",
      (text) => `${text}\nconst foreign = "com.example.telemetry.sink";\n`,
    );
    writeFile(
      root,
      "tests/fixtures/result/programs/foreign.json",
      '{"note":"com.example.telemetry.sink"}\n',
    );
    const result = await runSyncCheck({ root });
    expect(result.failures).toEqual([]);
    expect(result.counts.recognizedS1).toBe(baseline.counts.recognizedS1);
    expect(result.counts.recognizedS3).toBe(baseline.counts.recognizedS3);
    expect(result.counts.ignoredLiterals).toBeGreaterThan(baseline.counts.ignoredLiterals);
  });

  test("a declared-namespace undeclared literal fails naming code and surface", async () => {
    const root = makeTempRoot();
    editFile(
      root,
      "packages/cli/src/index.ts",
      (text) => `${text}\nconst drift = "input.legacy.marker";\n`,
    );
    writeFile(
      root,
      "tests/fixtures/result/programs/drift.json",
      '{"note":"input.legacy.marker"}\n',
    );
    const result = await runSyncCheck({ root });
    const text = messages(result.failures);
    expect(text).toContain("input.legacy.marker");
    expect(text).toContain("S1");
    expect(text).toContain("S3");
  });

  test("corpora are outside the tree walk and only fail at Level C", async () => {
    const root = makeTempRoot();
    editFile(root, `${CORPUS}/true-positives.json`, (text) => {
      const parsed = JSON.parse(text) as { rows: unknown[] };
      parsed.rows.push({
        id: "undeclared-corpus-only",
        text: "input.corpus.unmapped",
        recognized: true,
        resolves: false,
      });
      return `${JSON.stringify(parsed, null, 2)}\n`;
    });
    const withoutCorpus = await runSyncCheck({ root, includeCorpus: false });
    expect(withoutCorpus.failures).toEqual([]);
    const withCorpus = await runSyncCheck({ root });
    const text = messages(withCorpus.failures);
    expect(text).toContain("input.corpus.unmapped");
    expect(text).toContain("true-positives.json");
  });
});

const ROW_STATE_TORN =
  "| state.store.torn | state | platform | false | not_landed | Inspect or restore the named state store; never treat it as empty. | platform-provider | The state store is torn. |";
const ROW_STATE_LOCK =
  "| state.lock.busy | state | transient | true | not_landed | Wait for the current writer to release the state fence, then acquire and retry. | platform-provider | The state store is locked by another writer. |";

describe("TC-STATE-019 state rows synchronize in both directions", () => {
  test("the delivered state is green with non-zero counts for the state rows", async () => {
    const result = await runSyncCheck({ root: ROOT });
    expect(result.failures).toEqual([]);
    expect(result.counts.sourceEntries).toBeGreaterThanOrEqual(20);
    expect(result.counts.documentedRows).toBe(result.counts.sourceEntries);
    expect(result.counts.recognizedS1).toBeGreaterThan(0);
  });

  test("removing a machine state row fails naming the documented code", async () => {
    const root = makeTempRoot();
    editFile(root, TABLE, (text) =>
      text.replace(/\n? {2}\{\n {4}code: "state\.store\.torn",[\s\S]*?\n {2}\},/, ""),
    );
    const failures = messages((await runSyncCheck({ root })).failures);
    expect(failures).toContain("documented code state.store.torn has no source entry");
  });

  test("removing state from DOMAIN_KINDS fails naming the undeclared namespace", async () => {
    const root = makeTempRoot();
    editFile(root, TABLE, (text) =>
      text.replace(
        '["provider", "input", "config", "state", "lint"]',
        '["provider", "input", "config", "lint"]',
      ),
    );
    const failures = messages((await runSyncCheck({ root })).failures);
    expect(failures).toContain("undeclared namespace state");
  });

  test("removing a documented state row fails naming the source entry", async () => {
    const root = makeTempRoot();
    editFile(root, DOC, removeDocRow(ROW_STATE_LOCK));
    expect(messages((await runSyncCheck({ root })).failures)).toContain(
      "source entry state.lock.busy is undocumented",
    );
  });

  test("a documentation-only, malformed, or duplicated state row fails", async () => {
    const phantom = makeTempRoot();
    editFile(
      phantom,
      DOC,
      insertDocRow(
        "| state.phantom.row | state | platform | false | not_landed | Retry. | platform-provider | Phantom. |",
      ),
    );
    expect(messages((await runSyncCheck({ root: phantom })).failures)).toContain(
      "documented code state.phantom.row has no source entry",
    );

    const malformed = makeTempRoot();
    editFile(malformed, DOC, (text) =>
      text.replace(ROW_STATE_TORN, ROW_STATE_TORN.replace("| platform |", "| platform | extra |")),
    );
    expect(messages((await runSyncCheck({ root: malformed })).failures)).toContain("columns");

    const duplicated = makeTempRoot();
    editFile(duplicated, DOC, (text) =>
      text.replace(ROW_STATE_TORN, `${ROW_STATE_TORN}\n${ROW_STATE_TORN}`),
    );
    expect(messages((await runSyncCheck({ root: duplicated })).failures)).toContain(
      "duplicate documented row for state.store.torn",
    );
  });

  test("the unchanged copy remains green (control)", async () => {
    const root = makeTempRoot();
    expect((await runSyncCheck({ root })).failures).toEqual([]);
  });
});

const ROW_LINT_MALFORMED =
  "| lint.notes.malformed | lint | user | false | not_landed | Correct the document so it conforms to the pm-notes schema (syntax, structure, and value types) and retry. | user-validation | The pm-notes document is malformed. |";

describe("TC-SYNC-008 lint rows synchronize in both directions", () => {
  test("the delivered state is green with the five lint rows and non-zero counts", async () => {
    const result = await runSyncCheck({ root: ROOT });
    expect(result.failures).toEqual([]);
    expect(result.counts.sourceEntries).toBeGreaterThanOrEqual(26);
    expect(result.counts.documentedRows).toBe(result.counts.sourceEntries);
    const doc = readFile(ROOT, DOC);
    for (const code of [
      "lint.notes.malformed",
      "lint.keys.missing",
      "lint.variant.unknown",
      "lint.phases.incomplete",
      "lint.target.missing",
    ]) {
      expect(doc.split(`| ${code} |`).length - 1, code).toBe(1);
    }
  });

  test("removing a machine lint row fails naming the documented code", async () => {
    const root = makeTempRoot();
    editFile(root, TABLE, (text) =>
      text.replace(/\n? {2}\{\n {4}code: "lint\.notes\.malformed",[\s\S]*?\n {2}\},/, ""),
    );
    expect(messages((await runSyncCheck({ root })).failures)).toContain(
      "documented code lint.notes.malformed has no source entry",
    );
  });

  test("removing lint from DOMAIN_KINDS fails naming the undeclared namespace", async () => {
    const root = makeTempRoot();
    editFile(root, TABLE, (text) =>
      text.replace(
        '["provider", "input", "config", "state", "lint"]',
        '["provider", "input", "config", "state"]',
      ),
    );
    expect(messages((await runSyncCheck({ root })).failures)).toContain(
      "undeclared namespace lint",
    );
  });

  test("removing a documented lint row fails naming the source entry", async () => {
    const root = makeTempRoot();
    editFile(root, DOC, removeDocRow(ROW_LINT_MALFORMED));
    expect(messages((await runSyncCheck({ root })).failures)).toContain(
      "source entry lint.notes.malformed is undocumented",
    );
  });

  test("a documentation-only, malformed, or duplicated lint row fails", async () => {
    const phantom = makeTempRoot();
    editFile(
      phantom,
      DOC,
      insertDocRow(
        "| lint.phantom.row | lint | user | false | not_landed | Retry. | user-validation | Phantom. |",
      ),
    );
    expect(messages((await runSyncCheck({ root: phantom })).failures)).toContain(
      "documented code lint.phantom.row has no source entry",
    );

    const malformed = makeTempRoot();
    editFile(malformed, DOC, (text) =>
      text.replace(ROW_LINT_MALFORMED, ROW_LINT_MALFORMED.replace("| lint |", "| lint | extra |")),
    );
    expect(messages((await runSyncCheck({ root: malformed })).failures)).toContain("columns");

    const duplicated = makeTempRoot();
    editFile(duplicated, DOC, (text) =>
      text.replace(ROW_LINT_MALFORMED, `${ROW_LINT_MALFORMED}\n${ROW_LINT_MALFORMED}`),
    );
    expect(messages((await runSyncCheck({ root: duplicated })).failures)).toContain(
      "duplicate documented row for lint.notes.malformed",
    );
  });

  test("the unchanged copy remains green (control)", async () => {
    const root = makeTempRoot();
    expect((await runSyncCheck({ root })).failures).toEqual([]);
  });
});

describe("TC-PROV-045 provider rows synchronize in both directions", () => {
  const PROVIDER_CODES = [
    "provider.quota.exceeded",
    "provider.outage",
    "provider.auth.rejected",
    "provider.chain.empty",
    "provider.chain.invalid",
  ] as const;

  test("every provider code is present exactly once on each side", async () => {
    const result = await runSyncCheck({ root: ROOT });
    expect(result.failures).toEqual([]);
    const doc = readFile(ROOT, DOC);
    for (const code of PROVIDER_CODES) {
      expect(doc.split(`| ${code} |`).length - 1, code).toBe(1);
    }
  });

  test("a provider doc-only row fails by name", async () => {
    const root = makeTempRoot();
    editFile(
      root,
      DOC,
      insertDocRow(
        "| provider.phantom.entry | provider | user | false | not_landed | Fix the value. | user-validation | Phantom. |",
      ),
    );
    const result = await runSyncCheck({ root });
    expect(messages(result.failures)).toContain(
      "documented code provider.phantom.entry has no source entry",
    );
  });

  test("a provider machine-only row fails by name", async () => {
    const root = makeTempRoot();
    editFile(root, TABLE, replaceTableCode("provider.chain.invalid", "provider.chain.changed"));
    const result = await runSyncCheck({ root });
    expect(messages(result.failures)).toContain("source entry provider.chain.changed is undocumented");
  });
});
