/**
 * TC-WATCHDOG-005 and TC-WATCHDOG-054 — the Appendix B verdict/exit matrix is
 * total over reachable outcomes, the declared `stalled`/`progressing` rows stay
 * unreachable contract data, and no invocation ever exits outside `{0,1,2}`.
 */
import { describe, expect, test } from "bun:test";
import { DECLARED_ONLY_OUTCOMES, EXIT_MATRIX } from "../fixtures/watchdog/cases";
import { dataOf, errorOf, parseEnvelope } from "../fixtures/watchdog/harness";
import { disposeMatrix, runReachableMatrix } from "../fixtures/watchdog/matrix";

type Row = Awaited<ReturnType<typeof runReachableMatrix>>[number];

const byId = (rows: readonly Row[], id: string): Row => {
  const row = rows.find((entry) => entry.id === id);
  if (row === undefined) throw new Error(`matrix row ${id} is missing`);
  return row;
};

describe("TC-WATCHDOG-005 exit mapping is total over the verdict/exit matrix", () => {
  test("every reachable outcome maps to exactly one verdict or identity and one exit", async () => {
    const rows = await runReachableMatrix();
    try {
      const clean = parseEnvelope(byId(rows, "admission-clean").run);
      expect(byId(rows, "admission-clean").run.exitCode).toBe(0);
      expect(dataOf(clean).verdict).toBe("ok");

      const restored = parseEnvelope(byId(rows, "teardown-success").run);
      expect(byId(rows, "teardown-success").run.exitCode).toBe(0);
      expect(dataOf(restored).verdict).toBe("ok");

      const dirty = byId(rows, "refusal-dirty");
      expect(dirty.run.exitCode).toBe(1);
      expect(errorOf(parseEnvelope(dirty.run)).code).toBe("watchdog.checkout-dirty");

      const nonBase = byId(rows, "refusal-non-base");
      expect(nonBase.run.exitCode).toBe(1);
      expect(errorOf(parseEnvelope(nonBase.run)).code).toBe("watchdog.checkout-non-base");

      const absent = byId(rows, "signals-absent");
      expect(absent.run.exitCode).toBe(2);
      expect(errorOf(parseEnvelope(absent.run)).code).toBe("watchdog.signals-absent");

      const teardownFailure = byId(rows, "teardown-failure");
      expect([1, 2]).toContain(teardownFailure.run.exitCode);
      expect(errorOf(parseEnvelope(teardownFailure.run)).code).toBe("input.value.rejected");

      const grammar = byId(rows, "grammar-failure");
      expect(grammar.run.exitCode).toBe(1);

      const unknown = byId(rows, "unknown-lane");
      expect(unknown.run.exitCode).toBe(1);

      for (const row of rows) {
        const envelope = parseEnvelope(row.run);
        const hasData = Object.hasOwn(envelope, "data");
        const hasError = Object.hasOwn(envelope, "error");
        expect(hasData, row.id).not.toBe(hasError);
      }
    } finally {
      disposeMatrix(rows);
    }
  }, 30_000);

  test("the declared verdict/exit mapping is exact and the unreachable rows are marked", () => {
    const byOutcome = new Map(EXIT_MATRIX.map((row) => [row.outcome, row]));
    expect(byOutcome.get("admission")?.exit).toBe(0);
    expect(byOutcome.get("restoration")?.exit).toBe(0);
    expect(byOutcome.get("dirty")?.exit).toBe(1);
    expect(byOutcome.get("non-base")?.exit).toBe(1);
    expect(byOutcome.get("signals-absent")?.exit).toBe(2);
    expect(byOutcome.get("stalled")?.exit).toBe(1);
    expect(byOutcome.get("progressing")?.exit).toBe(0);
    expect(byOutcome.get("stalled")?.reachable).toBe(false);
    expect(byOutcome.get("progressing")?.reachable).toBe(false);
    expect(DECLARED_ONLY_OUTCOMES.map((row) => row.outcome).sort()).toEqual([
      "progressing",
      "stalled",
    ]);
    const stallNote = String(byOutcome.get("stalled")?.note);
    expect(stallNote).toContain("M1-S15");
    expect(stallNote).toContain("GAP-T2");
  });

  test("no reachable fixture yields stalled or progressing", async () => {
    const rows = await runReachableMatrix();
    try {
      for (const row of rows) {
        const envelope = parseEnvelope(row.run);
        const payload = JSON.stringify(envelope);
        expect(payload, row.id).not.toContain('"verdict":"stalled"');
        expect(payload, row.id).not.toContain('"verdict":"progressing"');
        if (Object.hasOwn(envelope, "data")) {
          expect(["ok", "refused", "stalled", "progressing"]).toContain(
            String(dataOf(envelope).verdict),
          );
          expect(["stalled", "progressing"]).not.toContain(String(dataOf(envelope).verdict));
        }
      }
    } finally {
      disposeMatrix(rows);
    }
  }, 30_000);
});

describe("TC-WATCHDOG-054 exits stay within {0,1,2} and exit 2 is reserved", () => {
  test("every collected exit is in the taxonomy and the envelope agrees with the return", async () => {
    const rows = await runReachableMatrix();
    try {
      const exits = new Set<number>();
      for (const row of rows) {
        const envelope = parseEnvelope(row.run);
        exits.add(row.run.exitCode);
        expect([0, 1, 2], row.id).toContain(row.run.exitCode);
        expect(envelope.exitCode, row.id).toBe(row.run.exitCode);
        if (row.run.exitCode === 0) {
          expect(Object.hasOwn(envelope, "data"), row.id).toBe(true);
          expect(dataOf(envelope).verdict, row.id).toBe("ok");
        }
        if (row.run.exitCode === 2) {
          expect(errorOf(envelope).code, row.id).toBe("watchdog.signals-absent");
        }
      }
      expect([...exits].every((code) => code >= 0 && code <= 2)).toBe(true);
    } finally {
      disposeMatrix(rows);
    }
  }, 30_000);
});
