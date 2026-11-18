/**
 * TC-QLC-009 (GH-292) — removal is a pure suffix append: a refusal changes no
 * byte, an accepted removal appends only the ledger and replaces the derived
 * document once, and a repeat dependency add on a declared edge churns nothing.
 */
import { describe, expect, test } from "bun:test";
import { ledgerDigest, ledgerText, listStoreFiles } from "../fixtures/state/harness";
import { REMOVAL_REF } from "../fixtures/queue/removal/cases";
import { createRemovalHarness } from "../fixtures/queue/removal/harness";

describe("TC-QLC-009 removal is append-only and the document moves only on truth change", () => {
  test("a refused removal changes no file byte and an accepted one is a pure suffix append", async () => {
    const harness = createRemovalHarness("remove-append-only");
    harness.seedEntry({ ref: REMOVAL_REF, priority: 1 });
    harness.seedEntry({ ref: "GH-242", priority: 2 });
    harness.seedPark({ ref: "GH-242" });
    harness.seedEdge({ ref: "GH-242", onRef: REMOVAL_REF });
    const store = harness.composition.store;
    const digestBefore = ledgerDigest(store.identity);
    const bytesBefore = ledgerText(store.identity);
    const filesBefore = listStoreFiles(store.identity.stateDirectory);
    const documentBefore = harness.graphDocument();

    // 1. A refused removal (missing reason) changes nothing.
    const refused = await harness.run(["queue", "remove", REMOVAL_REF, "--json"]);
    expect(refused.exitCode).toBe(1);
    expect(ledgerDigest(store.identity)).toBe(digestBefore);
    expect(ledgerText(store.identity)).toBe(bytesBefore);
    expect(harness.graphDocument()).toBe(documentBefore);
    expect(listStoreFiles(store.identity.stateDirectory)).toEqual(filesBefore);

    // 2. An accepted removal: the ledger grows as a pure suffix append.
    const applied = await harness.run([
      "queue",
      "remove",
      REMOVAL_REF,
      "--reason",
      "abandoned",
      "--json",
    ]);
    expect(applied.exitCode).toBe(0);
    const bytesAfter = ledgerText(store.identity);
    const linesBefore = bytesBefore.split("\n");
    const linesAfter = bytesAfter.split("\n");
    // Drop the trailing empty segment so the prefix comparison is meaningful.
    if (linesBefore.at(-1) === "") linesBefore.pop();
    if (linesAfter.at(-1) === "") linesAfter.pop();
    expect(linesAfter.length).toBeGreaterThan(linesBefore.length);
    for (let index = 0; index < linesBefore.length; index += 1) {
      expect(linesAfter[index]).toBe(linesBefore[index]);
    }
    // 3. The derived document changed and its ENTRIES omit the removed ref;
    // a surviving declared edge may still name it (removal does not cascade).
    const documentAfter = harness.graphDocument();
    expect(documentAfter).toBeDefined();
    expect(documentAfter).not.toBe(documentBefore);
    const parsedAfter = JSON.parse(documentAfter ?? "{}") as {
      entries: readonly { ref: string }[];
    };
    expect(parsedAfter.entries.some((entry) => entry.ref === REMOVAL_REF)).toBe(false);
    // No temporary, quarantine, or rewrite artifact appeared.
    expect(listStoreFiles(store.identity.stateDirectory)).toEqual(filesBefore);

    // 4. A repeat dependency add on an already-declared edge churns no document.
    const documentStable = harness.graphDocument();
    const repeat = await harness.run(["queue", "dep", "GH-242", REMOVAL_REF, "--json"]);
    expect(repeat.exitCode).toBe(0);
    // The folded dependency set did not change, so the document is unchanged.
    expect(harness.graphDocument()).toBe(documentStable);
  });

  test("no quarantine or rewrite artifact appears after an accepted removal", async () => {
    const harness = createRemovalHarness("remove-no-artifacts");
    harness.seedEntry({ ref: REMOVAL_REF });
    const filesBefore = listStoreFiles(harness.composition.store.identity.stateDirectory);
    const run = await harness.run([
      "queue",
      "remove",
      REMOVAL_REF,
      "--reason",
      "abandoned",
      "--json",
    ]);
    expect(run.exitCode).toBe(0);
    const filesAfter = listStoreFiles(harness.composition.store.identity.stateDirectory);
    expect(filesAfter).toEqual(filesBefore);
  });
});
