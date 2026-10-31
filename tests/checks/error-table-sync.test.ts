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
import { ERROR_TABLE, type ErrorTableEntry } from "../../packages/core/src/contracts/index";
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
        '["provider", "input", "config", "state", "lint", "verify"]',
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
        '["provider", "input", "config", "state", "lint", "verify"]',
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
    expect(messages(result.failures)).toContain(
      "source entry provider.chain.changed is undocumented",
    );
  });
});

const ROW_VERIFY =
  "| verify.ledger.incomplete | verify | user | false | not_landed | Complete the named required phases of the declared variant through the phase command, or correct the declaration, then re-run verify. | user-validation | The declared variant's required phases are not all completed. |";

/**
 * Frozen oracle of every row present before the verify addition (full column
 * set). The verify row is the only permitted addition; a changed existing row
 * fails naming it.
 */
const BASELINE_ROWS: ReadonlyArray<
  readonly [string, string, string, boolean, string, string, string, string]
> = [
  [
    "fallback.invocation",
    "fallback",
    "user",
    false,
    "unknown",
    "Check the command name and arguments, then retry the invocation.",
    "user-validation",
    "The invocation could not be understood.",
  ],
  [
    "fallback.internal",
    "fallback",
    "platform",
    false,
    "unknown",
    "Inspect the diagnostics stream and report the failure if it persists.",
    "platform-provider",
    "The failure could not be classified.",
  ],
  [
    "provider.quota.exceeded",
    "provider",
    "transient",
    true,
    "not_landed",
    "Wait for the quota window to reset, then retry the operation.",
    "platform-provider",
    "The provider quota was exceeded.",
  ],
  [
    "provider.outage",
    "provider",
    "transient",
    true,
    "not_landed",
    "Retry after the provider becomes reachable; consult the announcement and park for the resume time.",
    "platform-provider",
    "The provider is unreachable.",
  ],
  [
    "provider.auth.rejected",
    "provider",
    "user",
    false,
    "not_landed",
    "Correct or replace the declared credential and retry.",
    "user-validation",
    "The provider rejected the credential.",
  ],
  [
    "provider.chain.empty",
    "provider",
    "user",
    false,
    "not_landed",
    "Declare a non-empty provider chain (or select one) and retry.",
    "user-validation",
    "No provider chain is declared.",
  ],
  [
    "provider.chain.invalid",
    "provider",
    "user",
    false,
    "not_landed",
    "Correct the named chain entries, ordering, or references and retry.",
    "user-validation",
    "The provider chain is invalid.",
  ],
  [
    "input.value.rejected",
    "input",
    "user",
    false,
    "not_landed",
    "Correct the rejected value and retry the command.",
    "user-validation",
    "The supplied value was rejected.",
  ],
  [
    "config.file.malformed",
    "config",
    "user",
    false,
    "not_landed",
    "Correct the named configuration source and retry.",
    "user-validation",
    "A configuration source is malformed.",
  ],
  [
    "config.key.unknown",
    "config",
    "user",
    false,
    "not_landed",
    "Remove or correct the unknown configuration key and retry.",
    "user-validation",
    "A configuration key is unknown.",
  ],
  [
    "config.environment.unmapped",
    "config",
    "user",
    false,
    "not_landed",
    "Remove or map the environment name and retry.",
    "user-validation",
    "An environment configuration name is unmapped.",
  ],
  [
    "config.value.invalid",
    "config",
    "user",
    false,
    "not_landed",
    "Correct the value to match the configuration schema and retry.",
    "user-validation",
    "A configuration value is invalid.",
  ],
  [
    "config.interpolation.rejected",
    "config",
    "user",
    false,
    "not_landed",
    "Use a typed environment override instead and retry.",
    "user-validation",
    "In-file interpolation is not supported.",
  ],
  [
    "config.secret.forbidden",
    "config",
    "user",
    false,
    "not_landed",
    "Move the secret to a supported environment source and retry.",
    "user-validation",
    "A secret was supplied from a forbidden source.",
  ],
  [
    "config.path.forbidden",
    "config",
    "user",
    false,
    "not_landed",
    "Move the machine path to a system or user-global source and retry.",
    "user-validation",
    "A machine path was supplied from a forbidden source.",
  ],
  [
    "config.reset.invalid",
    "config",
    "user",
    false,
    "not_landed",
    "Correct the reset paths and retry.",
    "user-validation",
    "A configuration reset is invalid.",
  ],
  [
    "config.warning.strict",
    "config",
    "user",
    false,
    "not_landed",
    "Resolve the named warning and retry.",
    "user-validation",
    "Strict configuration validation rejected a warning.",
  ],
  [
    "config.credential.missing",
    "config",
    "user",
    false,
    "not_landed",
    "Supply the credential through its declared environment source and retry.",
    "user-validation",
    "A required credential was not resolvable from its source.",
  ],
  [
    "state.store.torn",
    "state",
    "platform",
    false,
    "not_landed",
    "Inspect or restore the named state store; never treat it as empty.",
    "platform-provider",
    "The state store is torn.",
  ],
  [
    "state.schema.mismatch",
    "state",
    "platform",
    false,
    "not_landed",
    "Use a compatible tool version or migrate the store explicitly, then retry.",
    "platform-provider",
    "The state store schema version is not supported.",
  ],
  [
    "state.keys.missing",
    "state",
    "platform",
    false,
    "not_landed",
    "Verify the writing operation completed and inspect the named store; never substitute defaults.",
    "platform-provider",
    "A state read key-set assertion failed.",
  ],
  [
    "state.lock.busy",
    "state",
    "transient",
    true,
    "not_landed",
    "Wait for the current writer to release the state fence, then acquire and retry.",
    "platform-provider",
    "The state store is locked by another writer.",
  ],
  [
    "state.permission.denied",
    "state",
    "user",
    false,
    "not_landed",
    "Correct operating-system permissions on the named state path and retry.",
    "user-validation",
    "A state path permission requirement was not met.",
  ],
  [
    "state.write.failed",
    "state",
    "transient",
    true,
    "not_landed",
    "Resolve the underlying storage error and retry; the failed write or rebuild did not land, the ledger remains durable truth, and the index stays disposable.",
    "platform-provider",
    "A state write or index rebuild did not land.",
  ],
  [
    "state.level.unsupported",
    "state",
    "user",
    false,
    "not_landed",
    "Use a state level with an implemented driver; shared levels arrive with later stories.",
    "user-validation",
    "The requested state level has no implementation.",
  ],
  [
    "lint.notes.malformed",
    "lint",
    "user",
    false,
    "not_landed",
    "Correct the document so it conforms to the pm-notes schema (syntax, structure, and value types) and retry.",
    "user-validation",
    "The pm-notes document is malformed.",
  ],
  [
    "lint.keys.missing",
    "lint",
    "user",
    false,
    "not_landed",
    "Add the named required key(s) with a conforming value and retry.",
    "user-validation",
    "A required pm-notes key is missing.",
  ],
  [
    "lint.variant.unknown",
    "lint",
    "user",
    false,
    "not_landed",
    "Set `variant` to `full` or `lite` and retry.",
    "user-validation",
    "The pm-notes variant is unknown.",
  ],
  [
    "lint.phases.incomplete",
    "lint",
    "user",
    false,
    "not_landed",
    "Add the named missing required phase(s) of the declared variant or correct the declared variant.",
    "user-validation",
    "A required phase of the declared variant is missing.",
  ],
  [
    "lint.target.missing",
    "lint",
    "user",
    false,
    "not_landed",
    "pm-notes target only: initialize pm-notes for the named change ref or correct the reference (an absent registry target is a verified-empty pass, C-3).",
    "user-validation",
    "The pm-notes target is missing.",
  ],
] as const;

const tupleOf = (
  entry: ErrorTableEntry,
): readonly [string, string, string, boolean, string, string, string, string] => [
  entry.code,
  entry.domainKind,
  entry.category,
  entry.retryable,
  entry.consequence,
  entry.remediationHint,
  entry.projectionClass,
  entry.summary ?? "",
];

const baselineViolations = (live: readonly ErrorTableEntry[]): string[] => {
  const failures: string[] = [];
  const liveByCode = new Map(live.map((entry) => [entry.code, entry]));
  for (const expected of BASELINE_ROWS) {
    const actual = liveByCode.get(expected[0]);
    if (actual === undefined) {
      failures.push(`${expected[0]}: pre-existing row was removed`);
      continue;
    }
    const actualTuple = tupleOf(actual);
    if (JSON.stringify(actualTuple) !== JSON.stringify(expected)) {
      failures.push(`${expected[0]}: pre-existing row changed`);
    }
  }
  if (live.length !== BASELINE_ROWS.length + 1) {
    failures.push(`table length ${live.length} != baseline + 1 (${BASELINE_ROWS.length + 1})`);
  }
  return failures;
};

describe("TC-VERIFY-019 verify row syncs in both directions and leaves the baseline intact", () => {
  test("the live table is exactly the frozen baseline plus the one verify row", () => {
    expect(baselineViolations(ERROR_TABLE as readonly ErrorTableEntry[])).toEqual([]);
    const live = ERROR_TABLE as readonly ErrorTableEntry[];
    expect(live.filter((entry) => entry.domainKind === "verify")).toHaveLength(1);
    expect(
      live.filter((entry) => entry.code === "verify.ledger.incomplete")[0]?.projectionClass,
    ).toBe("user-validation");
    const kinds = new Map<string, number>();
    for (const entry of live) kinds.set(entry.domainKind, (kinds.get(entry.domainKind) ?? 0) + 1);
    expect(Object.fromEntries(kinds)).toMatchObject({
      provider: 5,
      input: 1,
      config: 10,
      state: 7,
      lint: 5,
      verify: 1,
    });
  });

  test("removing the machine verify row fails naming the documented code", async () => {
    const root = makeTempRoot();
    editFile(root, TABLE, (text) =>
      text.replace(/\n? {2}\{\n {4}code: "verify\.ledger\.incomplete",[\s\S]*?\n {2}\},/, ""),
    );
    expect(messages((await runSyncCheck({ root })).failures)).toContain(
      "documented code verify.ledger.incomplete has no source entry",
    );
  });

  test("removing verify from DOMAIN_KINDS fails naming the undeclared namespace", async () => {
    const root = makeTempRoot();
    editFile(root, TABLE, (text) =>
      text.replace(
        '["provider", "input", "config", "state", "lint", "verify"]',
        '["provider", "input", "config", "state", "lint"]',
      ),
    );
    expect(messages((await runSyncCheck({ root })).failures)).toContain(
      "undeclared namespace verify",
    );
  });

  test("removing the documented verify row fails naming the source entry", async () => {
    const root = makeTempRoot();
    editFile(root, DOC, removeDocRow(ROW_VERIFY));
    expect(messages((await runSyncCheck({ root })).failures)).toContain(
      "source entry verify.ledger.incomplete is undocumented",
    );
  });

  test("a malformed or duplicated verify row fails", async () => {
    const malformed = makeTempRoot();
    editFile(malformed, DOC, (text) =>
      text.replace(ROW_VERIFY, ROW_VERIFY.replace("| verify |", "| verify | extra |")),
    );
    expect(messages((await runSyncCheck({ root: malformed })).failures)).toContain("columns");

    const duplicated = makeTempRoot();
    editFile(duplicated, DOC, (text) => text.replace(ROW_VERIFY, `${ROW_VERIFY}\n${ROW_VERIFY}`));
    expect(messages((await runSyncCheck({ root: duplicated })).failures)).toContain(
      "duplicate documented row for verify.ledger.incomplete",
    );
  });

  test("the unchanged copy remains green (control)", async () => {
    const root = makeTempRoot();
    expect((await runSyncCheck({ root })).failures).toEqual([]);
    expect((await runSyncCheck({ root: ROOT })).counts.sourceEntries).toBe(
      BASELINE_ROWS.length + 1,
    );
  });

  test("mutating an existing row fails the baseline oracle naming the row", () => {
    const mutated = (ERROR_TABLE as readonly ErrorTableEntry[]).map((entry) =>
      entry.code === "state.store.torn"
        ? { ...entry, projectionClass: "user-validation" as const }
        : entry,
    );
    expect(baselineViolations(mutated).join("\n")).toContain("state.store.torn");
    const live = ERROR_TABLE as readonly ErrorTableEntry[];
    expect(baselineViolations(live)).toEqual([]);
  });
});
