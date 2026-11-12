/**
 * GH-289 TC-ATTEMPT-018, 020, 021, 027 — the resolve result extension, replay
 * idempotency, the note contract, and the one deterministic human line.
 *
 * The resolve reports the divergence's own repository and the shared block; a
 * blank note appends nothing; an over-long note is clamped before the record is
 * built; and a replay is an idempotent noop with unchanged counts.
 */
import { describe, expect, test } from "bun:test";
import {
  appendDispatchDivergence,
  readDispatchDivergences,
} from "../../packages/core/src/app/dispatch-ledger";
import type { DispatchResolveData } from "../../packages/core/src/contracts/index";
import {
  longNote,
  openDivergences,
  resolvedDivergences,
} from "../fixtures/dispatch/attempt-records";
import { createAttemptsHarness } from "../fixtures/dispatch/attempts-harness";
import { makeDivergence, REPOSITORY } from "../fixtures/dispatch/ledger";

const resolveOf = (value: unknown): DispatchResolveData => value as DispatchResolveData;

const seed = (
  harness: ReturnType<typeof createAttemptsHarness>,
  records: ReturnType<typeof makeDivergence>[],
) => {
  for (const record of records) {
    const appended = appendDispatchDivergence(harness.store, "seed-fence", record);
    if (!appended.ok) throw new Error(`divergence seeding failed: ${appended.code}`);
  }
};

describe("TC-ATTEMPT-018 resolve extension", () => {
  test("adds the unconditional mode, the subject repository and the shared block", async () => {
    const harness = createAttemptsHarness({ label: "resolve-extension", records: [] });
    try {
      seed(harness, [...openDivergences(1), ...resolvedDivergences(2)]);
      const before = await harness.invoke([
        "dispatch",
        "dual-run",
        "summary",
        "--repo",
        REPOSITORY,
        "--json",
      ]);
      const beforeData = before.data as { readonly divergences: { readonly unresolved: number } };

      const result = await harness.invoke([
        "dispatch",
        "dual-run",
        "resolve",
        "DIV-OPEN-001",
        "--note",
        "tracker was stale",
        "--json",
      ]);
      expect(result.exit).toBe(0);
      const data = resolveOf(result.data);
      expect(data.mode).toBe("local-evidence");
      expect(data.repository).toBe(REPOSITORY);
      expect(data.resolved).toBe(true);
      expect(data.state).toBe("resolved");
      expect(Object.keys(data).slice(0, 5)).toEqual([
        "divergenceId",
        "state",
        "resolved",
        "note",
        "principal",
      ]);
      expect(Object.keys(data.divergences)).toEqual([
        "reported",
        "resolved",
        "unresolved",
        "unresolvedIds",
        "idsTruncated",
      ]);
      expect(data.divergences.unresolved).toBe(beforeData.divergences.unresolved - 1);
      expect(data.divergences.unresolvedIds).not.toContain("DIV-OPEN-001");
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-ATTEMPT-020 replay is an idempotent noop", () => {
  test("a second identical resolve appends nothing and keeps the counts", async () => {
    const harness = createAttemptsHarness({ label: "resolve-replay", records: [] });
    try {
      seed(harness, [makeDivergence({ divergenceId: "DIV-7" })]);
      const first = await harness.invoke([
        "dispatch",
        "dual-run",
        "resolve",
        "DIV-7",
        "--note",
        "local evidence only",
        "--json",
      ]);
      expect(first.exit).toBe(0);
      const openRecordBefore = readDispatchDivergences(harness.store);
      expect(openRecordBefore.ok).toBe(true);
      if (!openRecordBefore.ok) return;
      const original = JSON.stringify(openRecordBefore.records[0]);

      const second = await harness.invoke([
        "dispatch",
        "dual-run",
        "resolve",
        "DIV-7",
        "--note",
        "local evidence only",
        "--json",
      ]);
      expect(second.exit).toBe(0);
      const replay = resolveOf(second.data);
      expect(replay.resolved).toBe(false);
      expect(replay.state).toBe("resolved");
      expect(replay.note).toBe("local evidence only");
      expect(replay.principal).toBeDefined();
      expect(replay.divergences).toEqual(resolveOf(first.data).divergences);

      const all = readDispatchDivergences(harness.store);
      expect(all.ok).toBe(true);
      if (!all.ok) return;
      expect(all.records).toHaveLength(2);
      expect(JSON.stringify(all.records[0])).toBe(original);
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-ATTEMPT-021 the note contract", () => {
  for (const note of ["", "   "]) {
    test(`a note of "${note}" is refused with nothing appended`, async () => {
      const harness = createAttemptsHarness({ label: "resolve-blank", records: [] });
      try {
        seed(harness, [makeDivergence({ divergenceId: "DIV-9" })]);
        const appendsBefore = harness.counters.append;
        const before = readDispatchDivergences(harness.store);
        const result = await harness.invoke([
          "dispatch",
          "dual-run",
          "resolve",
          "DIV-9",
          "--note",
          note,
          "--json",
        ]);
        expect(result.exit).toBe(1);
        expect(result.error?.code).toBe("input.value.rejected");
        expect(harness.counters.append).toBe(appendsBefore);
        const after = readDispatchDivergences(harness.store);
        expect(after.ok && before.ok ? after.records.length : -1).toBe(
          before.ok ? before.records.length : -2,
        );
      } finally {
        harness.dispose();
      }
    });
  }

  test("a 400-character note is clamped to 240 and reported as stored", async () => {
    const harness = createAttemptsHarness({ label: "resolve-long", records: [] });
    try {
      seed(harness, [makeDivergence({ divergenceId: "DIV-10" })]);
      const note = longNote(400);
      const result = await harness.invoke([
        "dispatch",
        "dual-run",
        "resolve",
        "DIV-10",
        "--note",
        note,
        "--json",
      ]);
      expect(result.exit).toBe(0);
      const data = resolveOf(result.data);
      expect(data.note).toHaveLength(240);
      const stored = readDispatchDivergences(harness.store);
      expect(stored.ok).toBe(true);
      if (!stored.ok) return;
      const resolvedRecord = stored.records.find((record) => record.state === "resolved");
      expect(resolvedRecord?.note).toHaveLength(240);
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-ATTEMPT-027 one deterministic resolve line", () => {
  test("the human line is the declared form, including on replay", async () => {
    const harness = createAttemptsHarness({ label: "resolve-line", records: [] });
    try {
      seed(harness, [makeDivergence({ divergenceId: "DIV-11" })]);
      const first = await harness.invoke([
        "dispatch",
        "dual-run",
        "resolve",
        "DIV-11",
        "--note",
        "reason",
      ]);
      expect(first.exit).toBe(0);
      expect(first.stdout).toBe(
        `divergence=DIV-11; state=resolved; appended=true; unresolved=0; mode=local-evidence; repository=${REPOSITORY}\n`,
      );
      const replay = await harness.invoke([
        "dispatch",
        "dual-run",
        "resolve",
        "DIV-11",
        "--note",
        "reason",
      ]);
      expect(replay.stdout).toBe(
        `divergence=DIV-11; state=resolved; appended=false; unresolved=0; mode=local-evidence; repository=${REPOSITORY}\n`,
      );
    } finally {
      harness.dispose();
    }
  });
});
