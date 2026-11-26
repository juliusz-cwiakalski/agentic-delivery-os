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
import { classifyThrown } from "../../packages/cli/src/classify";
import { projectExitCode } from "../../packages/cli/src/projection";
import {
  ADAPTER_OPERATIONS,
  BOARD_COLLECTOR_ERROR_PREFIX,
  BOARD_COLLECTOR_ERROR_SUFFIX,
  BOARD_COLLECTOR_IDS,
  CLOSEOUT_STEP_IDS,
  DOMAIN_KINDS,
  ERROR_TABLE,
  type ErrorTableEntry,
  PM_NOTES_LINT_CODES,
} from "../../packages/core/src/contracts/index";
import {
  collectorIdOfFamilyCode,
  isDeclaredCollectorFamilyCode,
  RESERVED_TWO_SEGMENT_CODES,
  runSyncCheck,
  scanReferences,
} from "../../scripts/checks/error-table-sync";

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

/**
 * Replace the live DOMAIN_KINDS declaration regardless of formatter line
 * wrapping, so the declared-kind drift controls stay live as the array grows.
 */
const replaceDomainKinds =
  (kinds: readonly string[]): ((text: string) => string) =>
  (text) =>
    text.replace(
      /export const DOMAIN_KINDS = \[[\s\S]*?\] as const;/,
      `export const DOMAIN_KINDS = ${JSON.stringify(kinds)} as const;`,
    );

const gitStatus = (): string =>
  execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" });

const messages = (failures: readonly string[]): string => failures.join("\n");

afterEach(() => {
  for (const root of tempRoots) rmSync(root, { recursive: true, force: true });
  tempRoots.length = 0;
});

describe("TC-SYNC-001 / TC-HOLDNEG-001 delivered state", () => {
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
  "| state.store.torn | state | platform | false | not_landed | Inspect the named state store and use the explicit salvage operation as a separate step to truncate a torn tail; never treat the store as empty. | platform-provider | The state store is torn. |";
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
    editFile(root, TABLE, replaceDomainKinds(["provider", "input", "config", "lint"]));
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

const ROW_STATE_WRITE_FAILED =
  "| state.write.failed | state | transient | true | not_landed | Resolve the underlying storage error other than exhaustion and retry; the failed write or rebuild did not land, the ledger remains durable truth, and the index stays disposable. | platform-provider | A state write or index rebuild did not land. |";
const ROW_STATE_EXHAUSTED =
  "| state.storage.exhausted | state | transient | true | not_landed | Free storage space on the named state path and retry; the write did not land and the ledger remains at its last valid frame. | platform-provider | The storage backing the state store is exhausted. |";
const ROW_STATE_UNKNOWN =
  "| state.store.unknown | state | platform | false | not_landed | Declare the record kind and payload schema at the validated boundary, or use a compatible tool version, then retry. | platform-provider | A record kind or payload schema is not declared at the validated boundary. |";

describe("TC-STATE-019 (GH-222) additive and refined state rows are non-vacuous", () => {
  test("both tables declare the two additive rows and the refined remediations", async () => {
    expect((await runSyncCheck({ root: ROOT })).failures).toEqual([]);
    const doc = readFile(ROOT, DOC);
    for (const row of [ROW_STATE_EXHAUSTED, ROW_STATE_UNKNOWN, ROW_STATE_WRITE_FAILED]) {
      expect(doc.split(row).length - 1, row).toBe(1);
    }
    expect(doc).toContain(ROW_STATE_TORN);

    const entries = ERROR_TABLE as readonly ErrorTableEntry[];
    expect(entries.filter((entry) => entry.domainKind === "state")).toHaveLength(9);
    const exhausted = entries.find((entry) => entry.code === "state.storage.exhausted");
    expect(exhausted).toMatchObject({
      domainKind: "state",
      category: "transient",
      retryable: true,
      consequence: "not_landed",
      projectionClass: "platform-provider",
    });
    expect(exhausted?.remediationHint).toContain("storage space");
    const unknown = entries.find((entry) => entry.code === "state.store.unknown");
    expect(unknown).toMatchObject({
      domainKind: "state",
      category: "platform",
      retryable: false,
      consequence: "not_landed",
      projectionClass: "platform-provider",
    });
    expect(unknown?.remediationHint).toContain("boundary");
  });

  test("dropping a new row from either side fails naming the drift direction", async () => {
    const documentedOnly = makeTempRoot();
    editFile(documentedOnly, DOC, removeDocRow(ROW_STATE_UNKNOWN));
    expect(messages((await runSyncCheck({ root: documentedOnly })).failures)).toContain(
      "source entry state.store.unknown is undocumented",
    );

    const machineOnly = makeTempRoot();
    editFile(machineOnly, TABLE, (text) =>
      text.replace(/\n? {2}\{\n {4}code: "state\.storage\.exhausted",[\s\S]*?\n {2}\},/, ""),
    );
    expect(messages((await runSyncCheck({ root: machineOnly })).failures)).toContain(
      "documented code state.storage.exhausted has no source entry",
    );
  });

  test("a one-sided remediation change on either refined row fails by field", async () => {
    const writeFailed = makeTempRoot();
    editFile(writeFailed, DOC, (text) =>
      text.replace(
        ROW_STATE_WRITE_FAILED,
        ROW_STATE_WRITE_FAILED.replace("other than exhaustion", "after exhaustion"),
      ),
    );
    expect(messages((await runSyncCheck({ root: writeFailed })).failures)).toContain(
      "state.write.failed hint mismatch",
    );

    const torn = makeTempRoot();
    editFile(torn, DOC, (text) =>
      text.replace(
        ROW_STATE_TORN,
        ROW_STATE_TORN.replace("explicit salvage operation", "explicit repair operation"),
      ),
    );
    expect(messages((await runSyncCheck({ root: torn })).failures)).toContain(
      "state.store.torn hint mismatch",
    );
  });

  test("a phantom state.store.unknown-schema row fails by name and the baseline stays green", async () => {
    const root = makeTempRoot();
    editFile(
      root,
      DOC,
      insertDocRow(
        "| state.store.unknown-schema | state | platform | false | not_landed | Retry. | platform-provider | Phantom. |",
      ),
    );
    expect(messages((await runSyncCheck({ root })).failures)).toContain(
      "documented code state.store.unknown-schema has no source entry",
    );
    expect((await runSyncCheck({ root: ROOT })).failures).toEqual([]);
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
    editFile(root, TABLE, replaceDomainKinds(["provider", "input", "config", "state"]));
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
 * Frozen oracle of every row except the rows added after the baseline was
 * frozen (full column set). GH-180 pinned the four db rows here when it added
 * them. The seventy-nine later rows are the eight GH-234 provider-profile and
 * env-record rows, the two GH-222 state rows (`state.storage.exhausted`,
 * `state.store.unknown`), the lint-document-unreadable row, the six verify
 * rows, the five closeout rows, the five GH-226 machine-readable delivery-plan
 * rows, the four GH-221/GH-235 watchdog lane-safety and stall rows, the five
 * GH-227 commit-primitive rows (GH-242 retired `commit.session.context-refused`),
 * the two GH-228/GH-229 status collector rows, the seven concrete merge rows,
 * the GH-224 doctor row, the thirteen harness-primitive rows, the four retro
 * evidence rows, the GH-236 spend read-side row, the two dispatch economics
 * rows, the five GH-237 queue rows, the four GH-230 blocker-channel rows, and
 * the eight GH-238 resident-daemon rows, GH-290's three events-surface rows, and
 * GH-292's two queue lifecycle rows (`queue.reason-missing`, `queue.single-flight`),
 * so the frozen baseline plus those later rows equals the live table; a changed
 * baseline row fails naming it.
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
    "Inspect the named state store and use the explicit salvage operation as a separate step to truncate a torn tail; never treat the store as empty.",
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
    "Resolve the underlying storage error other than exhaustion and retry; the failed write or rebuild did not land, the ledger remains durable truth, and the index stays disposable.",
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
  [
    "db.opencode.unavailable",
    "db",
    "platform",
    false,
    "not_landed",
    "Install or repair the opencode CLI so opencode db path resolves.",
    "platform-provider",
    "The opencode session database is unavailable.",
  ],
  [
    "db.query.failed",
    "db",
    "platform",
    true,
    "not_landed",
    "Retry the failed query and verify the session store is readable.",
    "platform-provider",
    "A session database query failed.",
  ],
  [
    "db.delete.failed",
    "db",
    "transient",
    true,
    "not_landed",
    "Retry the prune; failed rows remain and are selected again.",
    "platform-provider",
    "A session delete did not land.",
  ],
  [
    "db.reboot.live",
    "db",
    "transient",
    true,
    "not_landed",
    "Wait until the live window is empty or stop the opencode host, then retry.",
    "platform-provider",
    "A live session is using the database.",
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
  if (live.length !== BASELINE_ROWS.length + 139) {
    failures.push(`table length ${live.length} != baseline + 139 (${BASELINE_ROWS.length + 139})`);
  }
  return failures;
};

describe("TC-VERIFY-019 verify row syncs in both directions and leaves the baseline intact", () => {
  test("the live table is exactly the frozen baseline plus the one verify row", () => {
    expect(baselineViolations(ERROR_TABLE as readonly ErrorTableEntry[])).toEqual([]);
    const live = ERROR_TABLE as readonly ErrorTableEntry[];
    expect(live.filter((entry) => entry.domainKind === "verify")).toHaveLength(7);
    expect(
      live.filter((entry) => entry.code === "verify.ledger.incomplete")[0]?.projectionClass,
    ).toBe("user-validation");
    const kinds = new Map<string, number>();
    for (const entry of live) kinds.set(entry.domainKind, (kinds.get(entry.domainKind) ?? 0) + 1);
    expect(Object.fromEntries(kinds)).toMatchObject({
      provider: 16,
      input: 1,
      config: 10,
      state: 9,
      lint: 7,
      plan: 5,
      verify: 7,
      closeout: 5,
      watchdog: 4,
      commit: 5,
      status: 2,
      doctor: 1,
      merge: 12,
      harness: 13,
      spend: 1,
      queue: 7,
      dispatch: 5,
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
    editFile(root, TABLE, replaceDomainKinds(["provider", "input", "config", "state", "lint"]));
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
      BASELINE_ROWS.length + 139,
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

const ROW_DB_QUERY =
  "| db.query.failed | db | platform | true | not_landed | Retry the failed query and verify the session store is readable. | platform-provider | A session database query failed. |";

describe("TC-DB-004 db rows synchronize in both directions", () => {
  test("the delivered state is green with the four db rows and non-zero counts", async () => {
    const result = await runSyncCheck({ root: ROOT });
    expect(result.failures).toEqual([]);
    expect(result.counts.sourceEntries).toBe(BASELINE_ROWS.length + 139);
    expect(result.counts.documentedRows).toBe(result.counts.sourceEntries);
    expect(result.counts.recognizedS1).toBeGreaterThan(0);
    const doc = readFile(ROOT, DOC);
    for (const code of [
      "db.opencode.unavailable",
      "db.query.failed",
      "db.delete.failed",
      "db.reboot.live",
    ]) {
      expect(doc.split(`| ${code} |`).length - 1, code).toBe(1);
    }
  });

  test("removing a machine db row fails naming the documented code", async () => {
    const root = makeTempRoot();
    editFile(root, TABLE, (text) =>
      text.replace(/\n? {2}\{\n {4}code: "db\.query\.failed",[\s\S]*?\n {2}\},/, ""),
    );
    expect(messages((await runSyncCheck({ root })).failures)).toContain(
      "documented code db.query.failed has no source entry",
    );
  });

  test("removing db from DOMAIN_KINDS fails naming the undeclared namespace", async () => {
    const root = makeTempRoot();
    editFile(
      root,
      TABLE,
      replaceDomainKinds(["provider", "input", "config", "state", "lint", "verify"]),
    );
    expect(messages((await runSyncCheck({ root })).failures)).toContain("undeclared namespace db");
  });

  test("removing a documented db row fails naming the source entry", async () => {
    const root = makeTempRoot();
    editFile(root, DOC, removeDocRow(ROW_DB_QUERY));
    expect(messages((await runSyncCheck({ root })).failures)).toContain(
      "source entry db.query.failed is undocumented",
    );
  });

  test("a documentation-only or altered db row fails", async () => {
    const phantom = makeTempRoot();
    editFile(
      phantom,
      DOC,
      insertDocRow(
        "| db.phantom.row | db | platform | false | not_landed | Retry. | platform-provider | Phantom. |",
      ),
    );
    expect(messages((await runSyncCheck({ root: phantom })).failures)).toContain(
      "documented code db.phantom.row has no source entry",
    );

    const altered = makeTempRoot();
    editFile(altered, DOC, (text) =>
      text.replace(ROW_DB_QUERY, ROW_DB_QUERY.replace("| platform |", "| transient |")),
    );
    expect(messages((await runSyncCheck({ root: altered })).failures)).toContain(
      "db.query.failed category mismatch",
    );
  });

  test("the unchanged copy remains green (control)", async () => {
    const root = makeTempRoot();
    expect((await runSyncCheck({ root })).failures).toEqual([]);
  });
});

const ROW_WATCHDOG_DIRTY =
  "| watchdog.checkout-dirty | watchdog | user | false | not_landed | Commit or discard the named uncommitted changes, then re-run the lane preflight. | user-validation | The lane checkout is dirty. |";
const ROW_WATCHDOG_NON_BASE =
  "| watchdog.checkout-non-base | watchdog | user | false | not_landed | Check out the lane's declared base (or correct the declaration), then re-run the lane preflight. | user-validation | The lane checkout is not on its declared base. |";
const ROW_WATCHDOG_ABSENT =
  "| watchdog.signals-absent | watchdog | platform | true | not_landed | Restore the declared progress-signal sources, then retry; without them the answer is unknown. | platform-provider | No liveness signal sources are available; the answer is unknown. |";

describe("TC-WATCHDOG-004 documented rows and corpora stay in two-way sync", () => {
  test("the delivered state is green with the three watchdog rows documented once", async () => {
    const result = await runSyncCheck({ root: ROOT });
    expect(result.failures).toEqual([]);
    expect(result.counts.documentedRows).toBe(result.counts.sourceEntries);
    const doc = readFile(ROOT, DOC);
    for (const row of [ROW_WATCHDOG_DIRTY, ROW_WATCHDOG_NON_BASE, ROW_WATCHDOG_ABSENT]) {
      expect(doc.split(row).length - 1).toBe(1);
    }
  });

  test("the three watchdog codes are recognized in S1 and resolvable in the corpus", async () => {
    const result = await runSyncCheck({ root: ROOT });
    expect(result.counts.recognizedS1).toBeGreaterThan(0);
    expect(result.counts.corpusRows).toBeGreaterThan(0);
    const corpus = JSON.parse(readFile(ROOT, `${CORPUS}/true-positives.json`)) as {
      readonly rows: readonly { readonly text: string; readonly recognized: boolean }[];
    };
    for (const code of [
      "watchdog.checkout-dirty",
      "watchdog.checkout-non-base",
      "watchdog.signals-absent",
    ]) {
      expect(corpus.rows.some((row) => row.text === code && row.recognized)).toBe(true);
    }
  });

  test("removing a documented watchdog row fails naming the source entry", async () => {
    const root = makeTempRoot();
    editFile(root, DOC, removeDocRow(ROW_WATCHDOG_ABSENT));
    expect(messages((await runSyncCheck({ root })).failures)).toContain(
      "source entry watchdog.signals-absent is undocumented",
    );
  });

  test("a mismatched watchdog hint fails naming the field", async () => {
    const root = makeTempRoot();
    editFile(root, DOC, (text) =>
      text.replace(ROW_WATCHDOG_DIRTY, ROW_WATCHDOG_DIRTY.replace("Commit or discard", "Remove")),
    );
    expect(messages((await runSyncCheck({ root })).failures)).toContain(
      "watchdog.checkout-dirty hint mismatch",
    );
  });

  test("removing watchdog from DOMAIN_KINDS fails naming the undeclared namespace", async () => {
    const root = makeTempRoot();
    editFile(root, TABLE, replaceDomainKinds(["provider", "input", "config", "state", "lint"]));
    expect(messages((await runSyncCheck({ root })).failures)).toContain(
      "undeclared namespace watchdog",
    );
  });
});

const ROW_COLLECTOR_TRACKER =
  "| status.collector.tracker.unavailable | status | platform | false | not_landed | Restore access to the named collector source and re-run the board; the board withheld its gates rather than display a partial picture. | platform-provider | The named board collector is unavailable. |";

describe("TC-SLA-021 collector family is recognized narrowly and syncs both ways", () => {
  test("the shipped family row is documented exactly once and the delivered tree is green", async () => {
    const result = await runSyncCheck({ root: ROOT });
    expect(result.failures).toEqual([]);
    expect(result.counts.documentedRows).toBe(result.counts.sourceEntries);
    expect(readFile(ROOT, DOC).split(ROW_COLLECTOR_TRACKER).length - 1).toBe(1);
  });

  test("the family recognizer admits the declared id and rejects other shapes", () => {
    expect(collectorIdOfFamilyCode("status.collector.tracker.unavailable")).toBe("tracker");
    expect(isDeclaredCollectorFamilyCode("status.collector.tracker.unavailable")).toBe(true);
    expect(isDeclaredCollectorFamilyCode("status.collector.coordination.unavailable")).toBe(false);
    expect(collectorIdOfFamilyCode("status.other.tracker.unavailable")).toBeUndefined();
    expect(collectorIdOfFamilyCode("status.collector..unavailable")).toBeUndefined();
    expect(collectorIdOfFamilyCode("status.collector.Tracker.unavailable")).toBeUndefined();
  });

  test("a status.other.<id>.unavailable literal fails the sync check by name", async () => {
    const root = makeTempRoot();
    editFile(
      root,
      "packages/cli/src/index.ts",
      (text) => `${text}\nconst drift = "status.other.tracker.unavailable";\n`,
    );
    const failures = messages((await runSyncCheck({ root })).failures);
    expect(failures).toContain("status.other.tracker.unavailable");
    expect(failures).toContain("has no table entry");
  });

  test("a family code naming an undeclared collector id fails the sync check", async () => {
    const root = makeTempRoot();
    editFile(
      root,
      "packages/cli/src/index.ts",
      (text) => `${text}\nconst drift = "status.collector.coordination.unavailable";\n`,
    );
    const failures = messages((await runSyncCheck({ root })).failures);
    expect(failures).toContain("collector-family code status.collector.coordination.unavailable");
  });

  test("removing the documented family row fails naming the source entry", async () => {
    const root = makeTempRoot();
    editFile(root, DOC, removeDocRow(ROW_COLLECTOR_TRACKER));
    expect(messages((await runSyncCheck({ root })).failures)).toContain(
      "source entry status.collector.tracker.unavailable is undocumented",
    );
  });

  test("runtime classification resolves a family code for an injected collector id", () => {
    const entry = classifyThrown({
      kind: "status",
      code: "status.collector.coordination.unavailable",
      summary: "ignored",
    });
    expect(entry.code).toBe("status.collector.coordination.unavailable");
    expect(entry.projectionClass).toBe("platform-provider");
    expect(classifyThrown({ kind: "status", code: "status.other.tracker.unavailable" }).code).toBe(
      "fallback.internal",
    );
  });
});

describe("TC-BRIEF-013 brief rows stay absent and the sync check stays green", () => {
  test("the live tree is bidirectionally consistent and has no brief/status identity", async () => {
    const result = await runSyncCheck({ root: ROOT });
    expect(result.failures).toEqual([]);
    expect(result.counts.sourceEntries).toBeGreaterThan(0);
    expect(ERROR_TABLE.some((entry) => entry.code.startsWith("brief."))).toBe(false);
    expect(
      ERROR_TABLE.filter((entry) => entry.code.startsWith("status.")).map((entry) => entry.code),
    ).toEqual(
      BOARD_COLLECTOR_IDS.map(
        (id) => `${BOARD_COLLECTOR_ERROR_PREFIX}${id}${BOARD_COLLECTOR_ERROR_SUFFIX}`,
      ),
    );
  });

  test("a documented-only brief row fails naming the offender", async () => {
    const root = makeTempRoot();
    editFile(
      root,
      DOC,
      insertDocRow(
        "| brief.phantom.row | brief | platform | false | unknown | Retry. | platform-provider | Phantom. |",
      ),
    );
    const text = messages((await runSyncCheck({ root })).failures);
    expect(text).toContain("documented code brief.phantom.row has no source entry");
  });
});

const ROW_DOCTOR =
  "| doctor.check.failed | doctor | user | false | not_landed | Resolve each named failing check using its fix hint, then re-run doctor. | user-validation | One or more wiring checks failed. |";

describe("TC-DOCTOR-020 doctor row and corpora stay in two-way sync", () => {
  test("the delivered doctor row is documented once and both corpora directions pass", async () => {
    const result = await runSyncCheck({ root: ROOT });
    expect(result.failures).toEqual([]);
    expect(readFile(ROOT, DOC).split(ROW_DOCTOR).length - 1).toBe(1);
    const truePositives = JSON.parse(readFile(ROOT, `${CORPUS}/true-positives.json`)) as {
      readonly rows: readonly { readonly text: string; readonly recognized: boolean }[];
    };
    const falsePositives = JSON.parse(readFile(ROOT, `${CORPUS}/false-positives.json`)) as {
      readonly rows: readonly { readonly text: string; readonly recognized: boolean }[];
    };
    expect(
      truePositives.rows.some((row) => row.text === "doctor.check.failed" && row.recognized),
    ).toBe(true);
    expect(
      falsePositives.rows.some(
        (row) => row.text === "doctor.check.repo.unreachable" && !row.recognized,
      ),
    ).toBe(true);
  });

  test("removing the machine doctor row fails naming the documented code", async () => {
    const root = makeTempRoot();
    editFile(root, TABLE, (text) =>
      text.replace(/\n? {2}\{\n {4}code: "doctor\.check\.failed",[\s\S]*?\n {2}\},/, ""),
    );
    expect(messages((await runSyncCheck({ root })).failures)).toContain(
      "documented code doctor.check.failed has no source entry",
    );
  });

  test("changing a doctor field fails naming the field", async () => {
    const root = makeTempRoot();
    editFile(root, DOC, (text) =>
      text.replace(ROW_DOCTOR, ROW_DOCTOR.replace("| user | false |", "| platform | false |")),
    );
    expect(messages((await runSyncCheck({ root })).failures)).toContain(
      "doctor.check.failed category mismatch",
    );
  });

  test("removing the documented doctor row fails naming the source entry", async () => {
    const root = makeTempRoot();
    editFile(root, DOC, removeDocRow(ROW_DOCTOR));
    expect(messages((await runSyncCheck({ root })).failures)).toContain(
      "source entry doctor.check.failed is undocumented",
    );
  });

  test("adding an undocumented second doctor row fails naming the documented code", async () => {
    const root = makeTempRoot();
    editFile(
      root,
      DOC,
      insertDocRow(
        "| doctor.check.extra | doctor | user | false | not_landed | Retry. | user-validation | Phantom. |",
      ),
    );
    expect(messages((await runSyncCheck({ root })).failures)).toContain(
      "documented code doctor.check.extra has no source entry",
    );
  });

  test("the unchanged copy remains green (control)", async () => {
    const root = makeTempRoot();
    expect((await runSyncCheck({ root })).failures).toEqual([]);
  });

  test("a doctor check-level cause is never recognized as an identity", () => {
    const references = scanReferences("doctor.check.repo.unreachable", ["doctor"]);
    expect(references.length).toBeGreaterThan(0);
    expect(references.every((reference) => !reference.recognized)).toBe(true);
  });

  test("a check-level cause added as a table row fails by name", async () => {
    const root = makeTempRoot();
    editFile(root, TABLE, (text) =>
      text.replace(
        "] as const satisfies readonly ErrorTableEntry[];",
        `  {
    code: "doctor.check.repo.unreachable",
    domainKind: "doctor",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint: "x",
    projectionClass: "user-validation",
  },
] as const satisfies readonly ErrorTableEntry[];`,
      ),
    );
    expect(messages((await runSyncCheck({ root })).failures)).toContain(
      "doctor.check.repo.unreachable: a doctor check-level cause must not become an error-table identity",
    );
  });
});

const RETRO_ROWS = [
  "| retro.evidence.malformed-entry | retro | platform | false | not_landed | Inspect the named evidence position and repair or explicitly salvage the affected artifact, then re-run the retro command; valid entries were preserved. | user-validation | An evidence entry is malformed and was classified in band. |",
  "| retro.evidence.tamper-flagged | retro | platform | false | not_landed | Inspect the named domain and record positions; do not trust altered evidence. Restore the unaltered artifact or record an explicit salvage before re-running. | user-validation | A keyed evidence chain failed verification. |",
  "| retro.truth.vacuous-run | retro | user | false | not_landed | Verify the declared collector sources and their windows, then re-run retro collect; a collection that executes must produce collector records. | user-validation | A collection run executed and produced no collector records. |",
  "| retro.evidence.denied | retro | platform | false | not_landed | Write evidence only through the collector seam; the sidecar is collector-owned and the attempted write did not land. | platform-provider | A write outside the collector seam was refused. |",
  // GH-287: the three additive action-registry rows (DEC-5).
  "| retro.action-incomplete | retro | user | false | not_landed | Supply the named contract member — a named agent-role or human owner, a verb from add/remove/change/test/deploy, a measurable outcome, a real tracker entry, a due date, a verification artifact, an outcome-verifier window, and a rollback condition — within its declared bound, then re-file; nothing landed. | user-validation | An action filing is incomplete or violates its contract rule. |",
  "| retro.closure-incomplete | retro | user | false | not_landed | Supply the named missing closure member — an explicit decision plus an artifact (done), a reason (deprioritized), a successor (superseded), or in-window verifier evidence (outcome) — or target a plane that is still open; nothing landed. | user-validation | A closure decision is incomplete or targets an already-closed plane. |",
  "| retro.wip-limit-exceeded | retro | user | false | not_landed | Close an open action in the named window on the deprioritized or superseded route, or file into another window, then retry; the window refuses filing at its declared limit and nothing landed. | user-validation | An improvement window is at its declared WIP limit. |",
] as const;

describe("TC-RETRO-005 retro rows synchronize in both directions", () => {
  test("the seven rows round-trip exactly once and the unchanged control is green", async () => {
    const result = await runSyncCheck({ root: ROOT });
    expect(result.failures).toEqual([]);
    const doc = readFile(ROOT, DOC);
    for (const row of RETRO_ROWS) {
      expect(doc.split(row).length - 1, row).toBe(1);
    }
    expect(result.counts.documentedRows).toBe(result.counts.sourceEntries);
  });

  test("machine-only drift names the undocumented source entry", async () => {
    const root = makeTempRoot();
    editFile(root, TABLE, replaceTableCode("retro.evidence.denied", "retro.evidence.refused"));
    const failures = messages((await runSyncCheck({ root })).failures);
    expect(failures).toContain("documented code retro.evidence.denied has no source entry");
    expect(failures).toContain("source entry retro.evidence.refused is undocumented");
  });

  test("documentation-only drift and column drift fail by name", async () => {
    const missing = makeTempRoot();
    editFile(missing, DOC, removeDocRow(RETRO_ROWS[0]));
    expect(messages((await runSyncCheck({ root: missing })).failures)).toContain(
      "source entry retro.evidence.malformed-entry is undocumented",
    );

    const phantom = makeTempRoot();
    editFile(
      phantom,
      DOC,
      insertDocRow(
        "| retro.evidence.phantom | retro | platform | false | not_landed | Retry. | user-validation | Phantom. |",
      ),
    );
    expect(messages((await runSyncCheck({ root: phantom })).failures)).toContain(
      "documented code retro.evidence.phantom has no source entry",
    );

    const altered = makeTempRoot();
    editFile(altered, DOC, (text) =>
      text.replace(RETRO_ROWS[1], RETRO_ROWS[1].replace("| platform |", "| user |")),
    );
    expect(messages((await runSyncCheck({ root: altered })).failures)).toContain(
      "retro.evidence.tamper-flagged category mismatch",
    );
  });

  test("removing retro from DOMAIN_KINDS fails naming the undeclared namespace", async () => {
    const root = makeTempRoot();
    editFile(
      root,
      TABLE,
      replaceDomainKinds(["provider", "input", "config", "state", "lint", "verify", "db"]),
    );
    expect(messages((await runSyncCheck({ root })).failures)).toContain(
      "undeclared namespace retro",
    );
  });
});

const ROW_ECON_WATCHDOG_STALLED =
  "| watchdog.liveness-stalled | watchdog | user | false | not_landed | Inspect the corroborated stall evidence, then apply the budget-governed restart response for the lane. | user-validation | The lane is stalled and fully corroborated by the declared progress signals. |";
const ROW_ECON_BUDGET =
  "| dispatch.restart-budget-exceeded | dispatch | user | false | not_landed | Request a fresh restart budget through the coordinator or operator, then retry the resume. | user-validation | The delivery's restart budget is exhausted. |";
const ROW_ECON_UNECONOMICAL =
  "| dispatch.resume-uneconomical | dispatch | user | false | not_landed | Change the harness capability to attach-and-continue, or re-evaluate and accept the prefill re-pay cost, then retry the resume. | user-validation | The resume path would re-pay prefill and is uneconomical. |";

describe("TC-ECON-004 the four economics rows bind two-way to the table and corpora", () => {
  test("the delivered tree is green and all four codes are documented exactly once", async () => {
    const result = await runSyncCheck({ root: ROOT });
    expect(result.failures).toEqual([]);
    expect(result.counts.documentedRows).toBe(result.counts.sourceEntries);
    const doc = readFile(ROOT, DOC);
    for (const row of [ROW_ECON_WATCHDOG_STALLED, ROW_ECON_BUDGET, ROW_ECON_UNECONOMICAL]) {
      expect(doc.split(row).length - 1).toBe(1);
    }
  });

  test("one true-positive corpus row per new code resolves and no false-positive row masks one", () => {
    const corpus = JSON.parse(readFile(ROOT, `${CORPUS}/true-positives.json`)) as {
      readonly rows: readonly { readonly text: string; readonly recognized: boolean }[];
    };
    for (const code of [
      "watchdog.liveness-stalled",
      "dispatch.restart-budget-exceeded",
      "dispatch.resume-uneconomical",
    ]) {
      expect(corpus.rows.some((row) => row.text === code && row.recognized)).toBe(true);
    }
    const falsePositive = JSON.parse(readFile(ROOT, `${CORPUS}/false-positives.json`)) as {
      readonly rows: readonly { readonly text: string }[];
    };
    for (const code of [
      "watchdog.liveness-stalled",
      "dispatch.restart-budget-exceeded",
      "dispatch.resume-uneconomical",
    ]) {
      expect(falsePositive.rows.some((row) => row.text === code)).toBe(false);
    }
  });

  test("deleting a documented economics row fails naming the undocumented source entry", async () => {
    const root = makeTempRoot();
    editFile(root, DOC, removeDocRow(ROW_ECON_UNECONOMICAL));
    expect(messages((await runSyncCheck({ root })).failures)).toContain(
      "source entry dispatch.resume-uneconomical is undocumented",
    );
  });

  test("a mismatched hint or projection class fails naming the field", async () => {
    const hint = makeTempRoot();
    editFile(hint, DOC, (text) =>
      text.replace(ROW_ECON_BUDGET, ROW_ECON_BUDGET.replace("Request a fresh", "Request fresh")),
    );
    expect(messages((await runSyncCheck({ root: hint })).failures)).toContain(
      "dispatch.restart-budget-exceeded hint mismatch",
    );

    const projection = makeTempRoot();
    editFile(projection, DOC, (text) =>
      text.replace(
        ROW_ECON_WATCHDOG_STALLED,
        ROW_ECON_WATCHDOG_STALLED.replace("| user-validation |", "| platform-provider |"),
      ),
    );
    expect(messages((await runSyncCheck({ root: projection })).failures)).toContain(
      "watchdog.liveness-stalled projection class mismatch",
    );
  });

  test("an undocumented source row fails naming the code", async () => {
    const root = makeTempRoot();
    editFile(root, TABLE, (text) =>
      text.replace(
        "] as const satisfies readonly ErrorTableEntry[];",
        `  {\n    code: "dispatch.phantom.row",\n    domainKind: "dispatch",\n    category: "user",\n    retryable: false,\n    consequence: "not_landed",\n    remediationHint: "Phantom.",\n    projectionClass: "user-validation",\n  },\n] as const satisfies readonly ErrorTableEntry[];`,
      ),
    );
    expect(messages((await runSyncCheck({ root })).failures)).toContain(
      "source entry dispatch.phantom.row is undocumented",
    );
  });
});

describe("TC-CAP-053 closeout step family recognition", () => {
  test("only declared CLOSEOUT_STEP_IDS slots resolve", async () => {
    const { isDeclaredCloseoutStepFamilyCode, closeoutStepIdOfFamilyCode } = await import(
      "../../scripts/checks/error-table-sync"
    );
    expect(isDeclaredCloseoutStepFamilyCode("closeout.step.capsule.failed")).toBe(true);
    expect(isDeclaredCloseoutStepFamilyCode("closeout.step.unknown-step.failed")).toBe(false);
    expect(closeoutStepIdOfFamilyCode("closeout.step.capsule.failed")).toBe("capsule");
    expect(closeoutStepIdOfFamilyCode("merge.gate.unit.failed")).toBeUndefined();
  });
});

describe("TC-VOCAB-002/003 (GH-237) queue rows and lanes collector family", () => {
  test("the five queue rows resolve in the machine table and each is documented once", async () => {
    const result = await runSyncCheck({ root: ROOT });
    expect(result.failures).toEqual([]);
    const doc = readFile(ROOT, DOC);
    for (const code of [
      "queue.dependency-cycle",
      "queue.lease-conflict",
      "queue.park-condition-stuck",
      "queue.entry.unobserved",
      "queue.precondition.unmet",
    ]) {
      expect(
        (ERROR_TABLE as readonly ErrorTableEntry[]).some((entry) => entry.code === code),
        code,
      ).toBe(true);
      expect(doc.split(`| ${code} |`).length - 1, code).toBe(1);
    }
  });

  test("the collector family recognizes the extended set and rejects an undeclared id", () => {
    expect([...BOARD_COLLECTOR_IDS]).toEqual(["tracker", "lanes"]);
    expect(
      isDeclaredCollectorFamilyCode(
        `${BOARD_COLLECTOR_ERROR_PREFIX}lanes${BOARD_COLLECTOR_ERROR_SUFFIX}`,
      ),
    ).toBe(true);
    expect(
      isDeclaredCollectorFamilyCode(
        `${BOARD_COLLECTOR_ERROR_PREFIX}queue${BOARD_COLLECTOR_ERROR_SUFFIX}`,
      ),
    ).toBe(false);
    expect(collectorIdOfFamilyCode(`${BOARD_COLLECTOR_ERROR_PREFIX}lanes.unavailable`)).toBe(
      "lanes",
    );
  });
});

const ROW_BLOCKERS_EXTRA =
  "| blockers.extra-code | blockers | user | false | not_landed | Extra row. | user-validation | An extra blocker row. |";

describe("TC-BLK-007 blockers family mutations fail by name", () => {
  test("an undocumented documented blockers row fails", async () => {
    const root = makeTempRoot();
    editFile(root, DOC, insertDocRow(ROW_BLOCKERS_EXTRA));
    expect(messages((await runSyncCheck({ root })).failures)).toContain("blockers.extra-code");
  });

  test("a fifth machine blockers row fails by its code", async () => {
    const root = makeTempRoot();
    editFile(root, TABLE, (text) =>
      text.replace(
        /(\n\s*\{\n\s*code: "blockers\.audience-mismatch",[\s\S]*?\n\s*\},)/,
        `$1\n  {
    code: "blockers.extra-code.row",
    domainKind: "blockers",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint: "Extra.",
    projectionClass: "user-validation",
    summary: "Extra.",
  },`,
      ),
    );
    expect(messages((await runSyncCheck({ root })).failures)).toContain(
      "source entry blockers.extra-code.row is undocumented",
    );
  });

  test("changing a blockers row's category fails naming the code", async () => {
    const root = makeTempRoot();
    editFile(root, TABLE, (text) =>
      text.replace(
        /code: "blockers\.audience-mismatch",\n(\s*)domainKind: "blockers",\n(\s*)category: "user"/,
        'code: "blockers.audience-mismatch",\n$1domainKind: "blockers",\n$2category: "platform"',
      ),
    );
    expect(messages((await runSyncCheck({ root })).failures)).toContain(
      "blockers.audience-mismatch",
    );
  });

  test("removing the documented audience-mismatch row fails naming the source entry", async () => {
    const root = makeTempRoot();
    editFile(root, DOC, (text) => text.replace(/^\| blockers\.audience-mismatch \|.*\n/m, ""));
    expect(messages((await runSyncCheck({ root })).failures)).toContain(
      "source entry blockers.audience-mismatch is undocumented",
    );
  });

  test("the unchanged copy remains green (control)", async () => {
    const root = makeTempRoot();
    expect((await runSyncCheck({ root })).failures).toEqual([]);
  });
});

/**
 * TC-COORD-082 (GH-241): the six coordinator rows bind two-way against the
 * documented table, the total is 173 (GH-292 added the two queue lifecycle
 * identities, GH-309 the three group-surface identities, GH-309 the moved
 * three repos flat identities, GH-287 the three action-registry identities,
 * GH-298 the three steer identities, GH-299 the one metrics identity,
 * GH-295 the two supervise identities, GH-335 the four harness refusal
 * identities, GH-346 the install identities (GH-365 retired one), and GH-349 the two merge
 * and one lint identities), and the corpora are non-vacuous.
 */
describe("TC-COORD-082 the six coordinator rows bind two-way", () => {
  const COORDINATOR_CODES = [
    "coordinator.already-running",
    "coordinator.restart-budget-exhausted",
    "coordinator.process.capability-gap",
    "coordinator.session.kill-failed",
    "coordinator.escalation.publish-failed",
    "coordinator.wake.delivery-failed",
  ] as const;

  test("the live tree is green at 173 entries and 173 documented rows", async () => {
    const result = await runSyncCheck({ root: ROOT });
    expect(result.failures).toEqual([]);
    expect(result.counts.sourceEntries).toBe(173);
    expect(result.counts.documentedRows).toBe(173);
    expect(result.counts.recognizedS1).toBeGreaterThan(0);
    expect(result.counts.recognizedS3).toBeGreaterThan(0);
    expect(result.counts.corpusRows).toBeGreaterThan(0);
  });

  test("each coordinator row is documented exactly once", () => {
    const doc = readFile(ROOT, DOC);
    for (const code of COORDINATOR_CODES) {
      expect(doc.split(`| ${code} |`).length - 1, code).toBe(1);
    }
    expect(doc).toContain("173 identities");
  });

  test("removing a documented coordinator row fails naming the code", async () => {
    const root = makeTempRoot();
    const row = COORDINATOR_CODES[0];
    editFile(root, DOC, (text) =>
      text
        .split("\n")
        .filter((line) => !line.startsWith(`| ${row} |`))
        .join("\n"),
    );
    expect(messages((await runSyncCheck({ root })).failures)).toContain(
      `doc/spec/features/feature-result-contract.md: source entry ${row} is undocumented`,
    );
  });

  test("a coordinator near-miss two-segment shape stays unrecognized", () => {
    // A two-segment shape that is not on the exact allowlist produces no
    // reference at all, so it can never resolve to a table row.
    expect(scanReferences("coordinator.alreadyrunning", [...DOMAIN_KINDS])).toEqual([]);
    const declared = scanReferences("coordinator.already-running", [...DOMAIN_KINDS]);
    expect(declared.map((reference) => reference.code)).toEqual(["coordinator.already-running"]);
    expect(declared.every((reference) => reference.recognized)).toBe(true);
  });
});

/**
 * GH-350 — the provider register moves as one edit-set: three declared rows,
 * both table counts and the delivered-rows metric move with it (the totals the
 * GH-366 comment block below restates), the sync-suite arithmetic rotates, the
 * allowlist gains the GH-349 reserved codes, and the corpus stays at
 * 83 (58 / 25).
 */
describe("GH-350 the provider register moves as one edit-set", () => {
  const NEW_CODES = [
    "provider.peak.zone-unknown",
    "provider.budget.exceeded",
    "provider.migrate.refused",
  ] as const;

  test("the provider kind holds sixteen rows including the three declared policy identities", () => {
    const providerRows = (ERROR_TABLE as readonly ErrorTableEntry[]).filter(
      (entry) => entry.domainKind === "provider",
    );
    expect(providerRows).toHaveLength(16);
    for (const code of NEW_CODES) {
      const row = providerRows.find((entry) => entry.code === code);
      expect(row, code).toBeDefined();
      expect(row).toMatchObject({
        category: "user",
        retryable: false,
        consequence: "not_landed",
        projectionClass: "user-validation",
      });
      expect((row?.remediationHint ?? "").length, code).toBeGreaterThan(0);
    }
  });

  test("both counts hold 173, the delivered-rows metric 172, the arithmetic +139 and the allowlist 72", async () => {
    const result = await runSyncCheck({ root: ROOT });
    expect(result.failures).toEqual([]);
    expect(result.counts.sourceEntries).toBe(173);
    expect(result.counts.documentedRows).toBe(173);
    expect(result.counts.documentedRows).toBe(result.counts.sourceEntries);
    const entries = ERROR_TABLE as readonly ErrorTableEntry[];
    expect(entries.filter((entry) => entry.domainKind !== "spend")).toHaveLength(172);
    expect([...RESERVED_TWO_SEGMENT_CODES]).toHaveLength(72);
    const doc = readFile(ROOT, DOC);
    expect(doc).toContain("173 machine identities");
    expect(doc).toContain("the same 173 identities");
    expect(doc).toContain("delivered-rows metric");
    expect(doc).toContain("172");
    expect(doc).toContain("BASELINE_ROWS.length + 139");
    expect(doc).toContain("exact two-segment allowlist of 72 declared identities");
  });

  test("the corpus holds 83 rows: 58 true-positive and 25 false-positive, one resolving row per new code", () => {
    const truePositives = JSON.parse(
      readFileSync(join(ROOT, CORPUS, "true-positives.json"), "utf8"),
    ) as { rows: { text: string; recognized: boolean; resolves: boolean }[] };
    const falsePositives = JSON.parse(
      readFileSync(join(ROOT, CORPUS, "false-positives.json"), "utf8"),
    ) as { rows: { text: string; recognized: boolean; resolves: boolean }[] };
    expect(truePositives.rows).toHaveLength(58);
    expect(falsePositives.rows).toHaveLength(25);
    expect(truePositives.rows.length + falsePositives.rows.length).toBe(83);
    for (const code of NEW_CODES) {
      const rows = truePositives.rows.filter((row) => row.text === code);
      expect(rows, code).toHaveLength(1);
      expect(rows[0]).toMatchObject({ recognized: true, resolves: true });
      expect(
        falsePositives.rows.filter((row) => row.text === code),
        code,
      ).toHaveLength(0);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* TC-SYNC-001 — the row-reachability half and the residual pin floor          */
/* -------------------------------------------------------------------------- */

/**
 * The row-REACHABILITY half of TC-SYNC-001 (authored in the final delivery
 * phase, the first phase in which all three additive rows have an emitting
 * branch) plus the residual pin floor re-asserted as a whole.
 *
 * Reachability is a property of the production sources, not of the table: a
 * declared row is reachable when a named refusal branch emits its exact code.
 * The retained reserved row is the discriminator — it is declared, carried by
 * the declaration, and emitted by no branch, so a scan that reported every
 * declared row as reachable could not pass this block.
 */
const REACHABILITY_BRANCHES = [
  {
    code: "merge.sync-required",
    source: "packages/core/src/domain/merge-transaction.ts",
    branch: "the `conflicting` arm and the `behind-unconfirmed` classification",
  },
  {
    code: "merge.mergeability-unknown",
    source: "packages/core/src/domain/merge-transaction.ts",
    branch: "the `unknown`-after-one-re-read arm",
  },
  {
    code: "lint.phases.divergent",
    source: "packages/cli/src/commands/lint.ts",
    branch: "the both-target divergence comparison",
  },
] as const;

const RESERVED_UNREACHABLE = "merge.rebase-conflict";

const sourceOf = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

/** The exact `code:` emission sites a source carries for one code. */
const emissionCount = (relative: string, code: string): number =>
  sourceOf(relative).split(`code: "${code}"`).length - 1;

describe("TC-SYNC-001 every additive row is emitted by a named branch", () => {
  test("the two merge rows and the lint row each have an emitting branch", () => {
    for (const entry of REACHABILITY_BRANCHES) {
      expect(
        emissionCount(entry.source, entry.code),
        `${entry.code} (${entry.branch})`,
      ).toBeGreaterThan(0);
      const rows = ERROR_TABLE.filter((row) => row.code === entry.code);
      expect(rows, entry.code).toHaveLength(1);
      const row = rows[0] as ErrorTableEntry;
      expect(row.domainKind).toBe(entry.code.startsWith("lint.") ? "lint" : "merge");
      expect([0, 1, 2]).toContain(projectExitCode(row.projectionClass));
    }
  });

  test("the retained reserved row is declared and emitted by no branch", () => {
    // The discriminator: reserved is not unreachable-by-accident. It keeps its
    // row, its projection and its remediation, and no delivered path emits it.
    const rows = ERROR_TABLE.filter((row) => row.code === RESERVED_UNREACHABLE);
    expect(rows).toHaveLength(1);
    for (const source of [
      "packages/core/src/domain/merge-transaction.ts",
      "packages/cli/src/production.ts",
    ]) {
      expect(emissionCount(source, RESERVED_UNREACHABLE), source).toBe(0);
    }
  });

  test("the reachability scan is non-vacuous: an undeclared code has no branch", () => {
    expect(
      emissionCount("packages/core/src/domain/merge-transaction.ts", "merge.declared-nowhere"),
    ).toBe(0);
    // The scan reads real sources, so a wrongly-named branch fails here.
    expect(emissionCount("packages/cli/src/commands/lint.ts", "lint.phases.divergent")).toBe(1);
  });
});

/**
 * The residual floor: the identity total on all seven pin sites and both pages,
 * the two-segment allowlist, the delivered-row count, the lint-row
 * decomposition, the legacy-token scan's planted controls, and the two closeout
 * goldens at thirteen step lines. Each value is asserted exactly in every place
 * it exists; none is loosened to a range.
 *
 * The operation set's eighteen enforcing pins, the ten moved sets and the merge
 * golden split are owned by `TC-SYNC-009`, `TC-SYNC-002`, `TC-SYNC-003` and
 * `TC-FLOOR-001..005`; this block re-asserts the identity-and-count floor those
 * cases share, not their oracles.
 */
const FLOOR_IDENTITY_TOTAL = 173;
const FLOOR_DELIVERED_TOTAL = 172;
const FLOOR_ALLOWLIST_TOTAL = 72;

const FLOOR_IDENTITY_SITES = [
  "tests/checks/error-table-sync.test.ts",
  "tests/checks/supervision-error-socialization.test.ts",
  "tests/structure/error-table.test.ts",
  "tests/structure/dispatch-attempts-taxonomy.test.ts",
  "tests/structure/verify-gates-suite-map-contract.test.ts",
  "tests/structure/ceremony-contract.test.ts",
  "tests/behaviour/ceremony-nonregression.test.ts",
] as const;

describe("TC-SYNC-001 the residual pin floor is exact and non-vacuous", () => {
  test("all seven identity sites carry the live total and the delivered-row pin", () => {
    for (const site of FLOOR_IDENTITY_SITES) {
      const text = sourceOf(site);
      expect(text, site).toContain(String(FLOOR_IDENTITY_TOTAL));
    }
    expect(sourceOf("tests/structure/error-table.test.ts")).toContain(
      String(FLOOR_DELIVERED_TOTAL),
    );
    expect(
      (ERROR_TABLE as readonly ErrorTableEntry[]).filter((row) => row.domainKind !== "spend"),
    ).toHaveLength(FLOOR_DELIVERED_TOTAL);
  });

  test("the two identity pages carry the live numbers, not a superseded one", () => {
    const metrics = sourceOf("doc/spec/features/feature-metrics.md");
    expect(metrics).toContain(
      `${FLOOR_IDENTITY_TOTAL} entries, ${FLOOR_DELIVERED_TOTAL} delivered rows, and ${FLOOR_ALLOWLIST_TOTAL} allowlisted two-segment codes`,
    );
    const ceremony = sourceOf("doc/spec/features/feature-ceremony-runner.md");
    expect(ceremony.split(`${FLOOR_IDENTITY_TOTAL} identities`).length - 1).toBe(3);
  });

  test("the lint decomposition stays five / six / seven", () => {
    // The pm-notes-only constant declares what that invocation can emit; the
    // documented pm-notes set and the machine lint rows are different counts.
    expect([...PM_NOTES_LINT_CODES]).toHaveLength(5);
    expect([...PM_NOTES_LINT_CODES]).not.toContain("lint.phases.divergent");
    expect(
      (ERROR_TABLE as readonly ErrorTableEntry[]).filter((row) => row.domainKind === "lint"),
    ).toHaveLength(7);
    const documented = sourceOf("doc/spec/features/feature-result-contract.md");
    expect(documented).toContain("carries the six pm-notes lint identities");
  });

  test("the legacy-token scan keeps its planted stale controls", () => {
    const scan = sourceOf("tests/structure/error-table.test.ts");
    // The scan exists, the two planted-stale controls exist, and the live
    // total is not a legacy token.
    expect(scan).toContain("leftoverPins(");
    expect(scan).toContain("STALE_TOTAL");
    expect(scan).toContain("STALE_DELIVERED");
    expect(scan).toContain("LEGACY_ARITHMETIC_DELIVERED");
    // The live total is asserted above at every site; a stale token anywhere in
    // the scanned set fails that suite, which is why this block does not repeat
    // the legacy literals.
  });

  test("the two closeout goldens carry thirteen step lines in the declared order", () => {
    const human = sourceOf("tests/fixtures/closeout/golden/human.txt");
    const numbered = human.split("\n").filter((line) => /^\d+\. /u.test(line));
    expect(numbered).toHaveLength(CLOSEOUT_STEP_IDS.length);
    expect(CLOSEOUT_STEP_IDS).toHaveLength(13);
    const envelope = JSON.parse(sourceOf("tests/fixtures/closeout/golden/envelope-data.json")) as {
      readonly steps: readonly { readonly stepId: string }[];
    };
    expect(envelope.steps.map((step) => step.stepId)).toEqual([...CLOSEOUT_STEP_IDS]);
    expect(human).toContain("12. milestone-sync:");
    expect(human).toContain("13. capsule:");
  });

  test("the closed operation set is ten and the reference behavior page names all ten", () => {
    expect(ADAPTER_OPERATIONS).toHaveLength(10);
    expect(ADAPTER_OPERATIONS.at(-1)).toBe("close-milestone");
    const reference = sourceOf("doc/spec/features/feature-adapter-reference-behavior.md");
    for (const operation of ADAPTER_OPERATIONS) {
      expect(reference, operation).toContain(`| \`${operation}\` |`);
    }
  });
});

describe("GH-394 the credential projection stays off the row", () => {
  test("the failure variant's three fields are never columns on the bound row", () => {
    // The row object for the delivered code carries exactly its documented
    // keys; the projection fields ride the failure variant, not the table.
    const row = (ERROR_TABLE as readonly Record<string, unknown>[]).find(
      (entry) => entry.code === "config.credential.missing",
    );
    expect(row).toBeDefined();
    if (row === undefined) return;
    for (const projectionField of ["source", "reason", "remedy"]) {
      expect(Object.keys(row)).not.toContain(projectionField);
    }
    // The delivered six row-bound fields stay byte-identical on the variant:
    // the type-level snapshot is pinned by the vocabulary-invariants suite;
    // this arm pins the table side of the same invariant.
    expect(Object.keys(row)).toEqual(
      [
        "code",
        "domainKind",
        "category",
        "retryable",
        "consequence",
        "remediationHint",
        "projectionClass",
        "summary",
        "exit",
      ].filter((key) => key in row),
    );
  });
});
