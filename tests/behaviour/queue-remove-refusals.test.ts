/**
 * TC-QLC-002/003/004/011 (GH-292) — the removal refusal set is exact and every
 * refusal is inert: zero appends, zero replacements, zero fences for the
 * pre-fence identities, identical bytes, and no projected event.
 */
import { describe, expect, test } from "bun:test";
import { ledgerDigest, ledgerText, listStoreFiles } from "../fixtures/state/harness";
import {
  MALFORMED_REASONS,
  REMOVAL_REF,
  REMOVAL_REFUSAL_IDENTITIES,
  UNKNOWN_REF,
} from "../fixtures/queue/removal/cases";
import { createRemovalHarness } from "../fixtures/queue/removal/harness";

const json = (text: string): Record<string, unknown> => JSON.parse(text) as Record<string, unknown>;
const errorOf = (text: string): Record<string, unknown> =>
  json(text).error as Record<string, unknown>;

describe("TC-QLC-002 removal without a reason is refused", () => {
  test("queue.reason-missing at exit 1 with the table-derived error and zero appends", async () => {
    const harness = createRemovalHarness("remove-noreason");
    harness.seedEntry({ ref: REMOVAL_REF });
    const digestBefore = ledgerDigest(harness.composition.store.identity);

    const run = await harness.run(["queue", "remove", REMOVAL_REF, "--json"]);
    expect(run.exitCode).toBe(1);
    const error = errorOf(run.stdout);
    expect(error.code).toBe("queue.reason-missing");
    for (const field of ["category", "retryable", "consequence", "remediationHint", "summary"]) {
      expect(error[field]).toBeDefined();
    }
    expect(ledgerDigest(harness.composition.store.identity)).toBe(digestBefore);
    expect(harness.removalRecords()).toHaveLength(0);

    const list = await harness.run(["queue", "list", "--json"]);
    expect(list.stdout).toContain(REMOVAL_REF);
  });
});

describe("TC-QLC-003 the reason vocabulary is closed", () => {
  test("every malformed reason form is a grammar refusal naming the value", async () => {
    for (const malformed of MALFORMED_REASONS) {
      const harness = createRemovalHarness(`remove-bad-${malformed.label}`);
      harness.seedEntry({ ref: REMOVAL_REF });
      const digestBefore = ledgerDigest(harness.composition.store.identity);
      const argv =
        malformed.value === undefined
          ? ["queue", "remove", REMOVAL_REF, "--reason"]
          : ["queue", "remove", REMOVAL_REF, "--reason", malformed.value, "--json"];
      const run = await harness.run(argv);
      expect(run.exitCode, malformed.label).toBe(1);
      const error = errorOf(run.stdout);
      expect(error.code, malformed.label).toBe("input.value.rejected");
      expect(JSON.stringify(error.summary)).toContain(malformed.offending);
      expect(ledgerDigest(harness.composition.store.identity)).toBe(digestBefore);
      expect(harness.removalRecords()).toHaveLength(0);
    }
  });

  test("a missing flag value is the delivered parser refusal naming the flag", async () => {
    const harness = createRemovalHarness("remove-reason-novalue");
    harness.seedEntry({ ref: REMOVAL_REF });
    const run = await harness.run(["queue", "remove", REMOVAL_REF, "--reason", "--json"]);
    expect(run.exitCode).toBe(1);
    // The delivered parser identity for a required-value flag without a value.
    expect(errorOf(run.stdout).code).toBe("fallback.invocation");
    expect(run.stderr).toContain("--reason");
    expect(harness.removalRecords()).toHaveLength(0);
  });
});

describe("TC-QLC-004 unknown and already-removed refs are unobserved refusals", () => {
  test("an absent ref and a re-removal both refuse with queue.entry.unobserved", async () => {
    const harness = createRemovalHarness("remove-unobserved");
    const first = await harness.run(["queue", "remove", UNKNOWN_REF, "--reason", "landed", "--json"]);
    expect(first.exitCode).toBe(1);
    expect(errorOf(first.stdout).code).toBe("queue.entry.unobserved");
    expect(harness.removalRecords()).toHaveLength(0);

    harness.seedEntry({ ref: REMOVAL_REF });
    const applied = await harness.run([
      "queue",
      "remove",
      REMOVAL_REF,
      "--reason",
      "landed",
      "--json",
    ]);
    expect(applied.exitCode).toBe(0);
    const keysAfter = harness.composition.store
      .readRecords()
      .ok === true
      ? harness.composition.store.readRecords().value?.records.length
      : undefined;
    const second = await harness.run([
      "queue",
      "remove",
      REMOVAL_REF,
      "--reason",
      "landed",
      "--json",
    ]);
    expect(second.exitCode).toBe(1);
    expect(errorOf(second.stdout).code).toBe("queue.entry.unobserved");
    // No second removal record: the refusal appended nothing.
    const records = harness.composition.store.readRecords();
    if (!records.ok) throw new Error("record read failed");
    expect(records.value.records.length).toBe(keysAfter);
    const list = await harness.run(["queue", "list", "--json"]);
    expect(list.stdout).not.toContain(REMOVAL_REF);
  });
});

describe("TC-QLC-011 every removal refusal is append-free and byte-identical", () => {
  test("a handler-grammar refusal acquires zero fences and appends zero records", async () => {
    const harness = createRemovalHarness("remove-purity-grammar");
    harness.seedEntry({ ref: REMOVAL_REF });
    const log = harness.writeLog;
    if (log === undefined) throw new Error("write log missing");
    const baseline = { appends: log.appends, replaces: log.replaces, fences: log.fences };
    const digest = ledgerDigest(harness.composition.store.identity);
    const run = await harness.run([
      "queue",
      "remove",
      REMOVAL_REF,
      "GH-999",
      "--reason",
      "landed",
      "--json",
    ]);
    expect(run.exitCode).toBe(1);
    expect(errorOf(run.stdout).code).toBe("input.value.rejected");
    expect(log.appends).toBe(baseline.appends);
    expect(log.replaces).toBe(baseline.replaces);
    expect(log.fences).toBe(baseline.fences);
    expect(ledgerDigest(harness.composition.store.identity)).toBe(digest);
    expect(harness.removalRecords()).toHaveLength(0);
  });

  test("each seam refusal appends nothing and changes no byte; the only fence movement is the delivered recovery pass", async () => {
    for (const refusal of REMOVAL_REFUSAL_IDENTITIES) {
      const harness = createRemovalHarness(`remove-purity-${refusal.label}`);
      harness.seedEntry({ ref: REMOVAL_REF });
      if (refusal.label === "live-lease") harness.seedLease({ ref: REMOVAL_REF, holder: "lane-1" });
      if (refusal.label === "already-removed") {
        const applied = await harness.run([
          "queue",
          "remove",
          REMOVAL_REF,
          "--reason",
          "abandoned",
          "--json",
        ]);
        expect(applied.exitCode).toBe(0);
      }
      const log = harness.writeLog;
      if (log === undefined) throw new Error("write log missing");
      const baseline = {
        appends: log.appends,
        replaces: log.replaces,
        digest: ledgerDigest(harness.composition.store.identity),
        bytes: ledgerText(harness.composition.store.identity),
        files: listStoreFiles(harness.composition.store.identity.stateDirectory),
      };

      const argv =
        refusal.label === "missing-reason"
          ? ["queue", "remove", REMOVAL_REF, "--json"]
          : refusal.label === "bad-reason"
            ? ["queue", "remove", REMOVAL_REF, "--reason", "done", "--json"]
            : refusal.label === "unknown-ref"
              ? ["queue", "remove", UNKNOWN_REF, "--reason", "landed", "--json"]
              : ["queue", "remove", REMOVAL_REF, "--reason", "landed", "--json"];
      const run = await harness.run(argv);
      expect(run.exitCode, refusal.label).toBe(1);
      expect(errorOf(run.stdout).code, refusal.label).toBe(refusal.identity);

      // Zero appends and zero replaces by two observations: the write log and
      // the byte-identical ledger.
      expect(log.appends, refusal.label).toBe(baseline.appends);
      expect(log.replaces, refusal.label).toBe(baseline.replaces);
      expect(ledgerDigest(harness.composition.store.identity), refusal.label).toBe(baseline.digest);
      expect(ledgerText(harness.composition.store.identity), refusal.label).toBe(baseline.bytes);
      expect(listStoreFiles(harness.composition.store.identity.stateDirectory)).toEqual(
        baseline.files,
      );
      expect(harness.removalRecords().length, refusal.label).toBe(
        refusal.label === "already-removed" ? 1 : 0,
      );
    }
  });
});
