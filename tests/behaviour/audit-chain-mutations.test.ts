/**
 * TC-GH223-025 — the declarative mutation matrix across both audit kinds: every
 * alteration is detected, and the clean control proves the matrix is not vacuous.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  AUDIT_INVOCATION_RECORD_KIND,
  AUDIT_RESERVATION_RECORD_KIND,
} from "../../packages/core/src/contracts/index";
import { verifyAuditChain } from "../../packages/core/src/state/index";
import {
  type AuditStoreFixture,
  ledgerPath,
  ledgerText,
  makeAuditStore,
  mutateAuditRecord,
  removeRoot,
  seedAuditPairs,
} from "../fixtures/state/harness";

type MutationCase = {
  readonly id: string;
  readonly kind: string;
  readonly expected: "chain-break" | "torn" | "verified";
};

const matrix = JSON.parse(
  readFileSync(join(process.cwd(), "tests/fixtures/audit/mutations.json"), "utf8"),
) as { cases: MutationCase[] };

type LedgerRecord = {
  kind: string;
  sequence: number;
  checksum: string;
  payload: Record<string, unknown>;
};

const linesOf = (fixture: AuditStoreFixture): string[] =>
  ledgerText(fixture.identity)
    .split("\n")
    .filter((line) => line !== "");

const writeLines = (fixture: AuditStoreFixture, lines: readonly string[]): void => {
  writeFileSync(ledgerPath(fixture.identity), `${lines.join("\n")}\n`);
};

const recordIndex = (lines: readonly string[], kind: string, auditSeq: number): number =>
  lines.findIndex((line) => {
    const record = JSON.parse(line) as LedgerRecord;
    return record.kind === kind && record.payload.auditSeq === auditSeq;
  });

const corruptChecksum = (fixture: AuditStoreFixture, kind: string, auditSeq: number): void => {
  const lines = linesOf(fixture);
  const index = recordIndex(lines, kind, auditSeq);
  const record = JSON.parse(lines[index] as string) as LedgerRecord;
  record.checksum = "0".repeat(16);
  lines[index] = JSON.stringify(record);
  writeLines(fixture, lines);
};

const deleteRecord = (fixture: AuditStoreFixture, kind: string, auditSeq: number): void => {
  const lines = linesOf(fixture);
  const index = recordIndex(lines, kind, auditSeq);
  lines.splice(index, 1);
  writeLines(fixture, lines);
};

const reorderRecord = (fixture: AuditStoreFixture, kind: string, auditSeq: number): void => {
  const lines = linesOf(fixture);
  const index = recordIndex(lines, kind, auditSeq);
  const [moved] = lines.splice(index, 1);
  if (moved === undefined) throw new Error("record not found");
  lines.splice(Math.max(0, index - 2), 0, moved);
  writeLines(fixture, lines);
};

const applyMutation = (fixture: AuditStoreFixture, id: string): void => {
  switch (id) {
    case "reservation-payload-edit":
      mutateAuditRecord(
        fixture.identity,
        { kind: AUDIT_RESERVATION_RECORD_KIND, auditSeq: 2 },
        (payload) => {
          payload.runId = "run-tampered";
        },
      );
      return;
    case "invocation-payload-edit":
      mutateAuditRecord(
        fixture.identity,
        { kind: AUDIT_INVOCATION_RECORD_KIND, auditSeq: 2 },
        (payload) => {
          payload.command = "tampered-command";
        },
      );
      return;
    case "reservation-chain-edit":
      mutateAuditRecord(
        fixture.identity,
        { kind: AUDIT_RESERVATION_RECORD_KIND, auditSeq: 2 },
        (payload) => {
          payload.chainValue = "0".repeat(32);
        },
      );
      return;
    case "invocation-chain-edit":
      mutateAuditRecord(
        fixture.identity,
        { kind: AUDIT_INVOCATION_RECORD_KIND, auditSeq: 2 },
        (payload) => {
          payload.chainValue = "0".repeat(32);
        },
      );
      return;
    case "reservation-ordinal-mismatch":
      mutateAuditRecord(
        fixture.identity,
        { kind: AUDIT_RESERVATION_RECORD_KIND, auditSeq: 2 },
        (payload) => {
          payload.auditSeq = 9;
        },
      );
      return;
    case "invocation-ordinal-mismatch":
      mutateAuditRecord(
        fixture.identity,
        { kind: AUDIT_INVOCATION_RECORD_KIND, auditSeq: 2 },
        (payload) => {
          payload.auditSeq = 9;
        },
      );
      return;
    case "reservation-checksum-corrupt":
      corruptChecksum(fixture, AUDIT_RESERVATION_RECORD_KIND, 2);
      return;
    case "invocation-checksum-corrupt":
      corruptChecksum(fixture, AUDIT_INVOCATION_RECORD_KIND, 2);
      return;
    case "reservation-delete":
      deleteRecord(fixture, AUDIT_RESERVATION_RECORD_KIND, 2);
      return;
    case "invocation-delete":
      deleteRecord(fixture, AUDIT_INVOCATION_RECORD_KIND, 2);
      return;
    case "reservation-reorder":
      reorderRecord(fixture, AUDIT_RESERVATION_RECORD_KIND, 3);
      return;
    case "clean-control":
      return;
    default:
      throw new Error(`unknown mutation ${id}`);
  }
};

const classify = (fixture: AuditStoreFixture): MutationCase["expected"] | "other" => {
  const verdict = verifyAuditChain(fixture.store);
  if (!verdict.ok) {
    return verdict.error.code === "state.store.torn" ? "torn" : "other";
  }
  return verdict.value.verified ? "verified" : "chain-break";
};

describe("TC-GH223-025 mutation matrix", () => {
  for (const mutation of matrix.cases) {
    test(`${mutation.id} is detected as ${mutation.expected}`, () => {
      const fixture = makeAuditStore(`mutation-${mutation.id}`);
      try {
        seedAuditPairs(fixture.store, 5);
        expect(classify(fixture)).toBe("verified");
        applyMutation(fixture, mutation.id);
        expect(classify(fixture)).toBe(mutation.expected);
      } finally {
        removeRoot(fixture.root);
      }
    });
  }

  test("the matrix covers both audit kinds and all detection classes", () => {
    const kinds = new Set(matrix.cases.map((entry) => entry.kind));
    expect(kinds.has(AUDIT_RESERVATION_RECORD_KIND)).toBe(true);
    expect(kinds.has(AUDIT_INVOCATION_RECORD_KIND)).toBe(true);
    const expected = new Set(matrix.cases.map((entry) => entry.expected));
    expect(expected.has("chain-break")).toBe(true);
    expect(expected.has("torn")).toBe(true);
    expect(expected.has("verified")).toBe(true);
  });
});
