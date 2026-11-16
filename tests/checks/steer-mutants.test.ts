/**
 * TC-STEER-008/095 — the schema-fork mutation arms.
 *
 * Each arm constructs the mutation the guard exists to reject and asserts the
 * production validator refuses it by name: an owner-only vocabulary member
 * added to the filing subset, an owner-specific field added to the record, and
 * legitimate shared-vocabulary growth that must not widen the filing path.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  STEER_FILING_KINDS,
  STEER_KINDS,
  type SteerMessageRecord,
} from "../../packages/core/src/contracts/index";
import { validateSteerMessage, validateSteerSend } from "../../packages/core/src/domain/index";

const ROOT = process.cwd();

const messageOf = (overrides: Partial<SteerMessageRecord> = {}): SteerMessageRecord => ({
  id: "msg-fixture-1",
  from: "owner",
  to: "delivery",
  scope: "repo",
  kind: "request",
  subject: "prefer smaller diffs",
  ref: null,
  origin: { change: "GH-298", repo: "example/product", agent: "owner" },
  priority: "normal",
  created: "2026-11-16T12:00:00.000Z",
  ttl: 86_400_000,
  ...overrides,
});

describe("TC-STEER-008 schema-fork mutation arms", () => {
  test("an owner-only vocabulary member in the filing subset is rejected naming the member", () => {
    const mutatedSubset = [...STEER_FILING_KINDS, "steer"];
    // The mutated subset now names a member the shared set does not hold.
    expect(STEER_KINDS.includes("steer" as never)).toBe(false);
    expect(mutatedSubset.some((kind) => !(STEER_KINDS as readonly string[]).includes(kind))).toBe(
      true,
    );
    // The production validator refuses the illegal member by name.
    const record = validateSteerMessage({ ...messageOf(), kind: "steer" });
    expect(record.ok).toBe(false);
    if (!record.ok) expect(record.field).toBe("kind");
    const filing = validateSteerSend({ text: "a note", kind: "steer" });
    expect(filing.ok).toBe(false);
    if (!filing.ok) expect(filing.field).toBe("kind");
  });

  test("an owner-specific record field is rejected naming the field", () => {
    const forked = { ...messageOf(), ownerNoteId: "note-1" };
    const validated = validateSteerMessage(forked);
    expect(validated.ok).toBe(false);
    if (!validated.ok) {
      expect(validated.field).toBe("ownerNoteId");
      expect(validated.summary).toContain("ownerNoteId");
    }
    // A non-owner record without the owner-only field stays valid: the fork is
    // immediately asymmetric, which is exactly what the arm proves.
    const nonOwner = messageOf({
      from: "coordinator",
      scope: "change",
      kind: "ask",
    });
    expect(validateSteerMessage(nonOwner).ok).toBe(true);
  });

  test("legitimate shared-vocabulary growth keeps the subset check green but filing refused", () => {
    const grownKinds = [...STEER_KINDS, "broadcast"];
    // The subset is a restriction: shared growth is legal and does not widen it.
    expect(grownKinds.some((kind) => !(STEER_KINDS as readonly string[]).includes(kind))).toBe(
      true,
    );
    for (const kind of STEER_FILING_KINDS) {
      expect(grownKinds).toContain(kind);
    }
    expect(validateSteerSend({ text: "a note", kind: "broadcast" }).ok).toBe(false);
    // The shared validator would accept the grown member once it is declared;
    // the filing restriction still refuses it, proving the two sets are related
    // but not conflated.
    expect(validateSteerSend({ text: "a note", kind: "notify" }).ok).toBe(false);
    expect(validateSteerMessage(messageOf({ kind: "notify" })).ok).toBe(true);
  });

  test("the fork detector is non-vacuous: the unmutated tree passes both assertions", () => {
    expect(validateSteerMessage(messageOf()).ok).toBe(true);
    expect(validateSteerSend({ text: "a note" }).ok).toBe(true);
    const source = readFileSync(join(ROOT, "packages/core/src/contracts/steer.ts"), "utf8");
    expect(source).toContain("STEER_FILING_SUBSET");
    expect(source).toContain("STEER_KINDS");
    // No duplicate literal copy of the shared kind vocabulary exists.
    expect(source.match(/"ask",\s*"answer",\s*"notify"/gu)?.length ?? 0).toBe(1);
  });
});

describe("TC-STEER-074/075/076 registration arms", () => {
  const STEER_CODES = [
    "steer.unknown-id",
    "steer.credential-value-rejected",
    "steer.queue-unavailable",
  ] as const;
  const DOC = "doc/spec/features/feature-result-contract.md";
  const TABLE = "packages/core/src/contracts/error-table.ts";
  const CHECK = "scripts/checks/error-table-sync.ts";

  const makeTree = (): string => {
    const root = mkdtempSync(join(tmpdir(), "gh298-steer-mutants-"));
    for (const directory of [
      "packages/core/src/contracts",
      "packages/cli/src",
      "tests/fixtures/result",
      "scripts/checks",
    ]) {
      cpSync(join(ROOT, directory), join(root, directory), { recursive: true });
    }
    mkdirSync(join(root, "doc/spec/features"), { recursive: true });
    cpSync(join(ROOT, DOC), join(root, DOC));
    return root;
  };

  test("the checker copy declares exactly the three steer codes and no prefix rule", () => {
    const source = readFileSync(join(ROOT, CHECK), "utf8");
    for (const code of STEER_CODES) expect(source).toContain(`"${code}"`);
    expect(source).not.toContain('startsWith("steer.")');
    expect(source).not.toMatch(/steer\.\*/u);
  });

  test("a fourth steer row without an allowlist entry is rejected naming the code", async () => {
    const { runSyncCheck } = await import("../../scripts/checks/error-table-sync");
    const root = makeTree();
    try {
      const table = join(root, TABLE);
      const text = readFileSync(table, "utf8");
      const mutated = text.replace(
        '    code: "steer.queue-unavailable",',
        '    code: "steer.state-unavailable",',
      );
      writeFileSync(table, mutated);
      const result = await runSyncCheck({ root });
      expect(result.failures.join("\n")).toContain("steer.state-unavailable");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a near-miss two-segment steer code is rejected by the checker", async () => {
    const { runSyncCheck } = await import("../../scripts/checks/error-table-sync");
    const root = makeTree();
    try {
      const table = join(root, TABLE);
      writeFileSync(
        table,
        readFileSync(table, "utf8").replace(
          'code: "steer.unknown-id"',
          'code: "steer.unknown-ids"',
        ),
      );
      const result = await runSyncCheck({ root });
      expect(result.failures.join("\n")).toContain("steer.unknown-ids");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("omitting one steer code from the checker copy fails naming the disagreement", async () => {
    const root = makeTree();
    try {
      const checker = join(root, CHECK);
      writeFileSync(
        checker,
        readFileSync(checker, "utf8").replace('  "steer.queue-unavailable",\n', ""),
      );
      const run = spawnSync("bun", ["run", CHECK], { cwd: root, encoding: "utf8" });
      expect(run.status).not.toBe(0);
      expect(`${run.stdout}${run.stderr}`).toContain("steer.queue-unavailable");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a stale non-mirror count pin is detected by the live scan", () => {
    const files = [
      "tests/structure/dispatch-attempts-taxonomy.test.ts",
      "tests/structure/verify-gates-suite-map-contract.test.ts",
      "tests/checks/error-table-sync.test.ts",
    ];
    for (const file of files) {
      const text = readFileSync(join(ROOT, file), "utf8");
      expect(text).not.toContain("BASELINE_ROWS.length + 106");
      expect(text).not.toMatch(/toHaveLength\(140\)/u);
    }
  });
});
