/**
 * TC-GH222-010/011 — the no-automatic-repair invariants around salvage: reads on
 * a torn store are byte-side-effect-free (no salvage, no repair, no index), and
 * salvage on a mid-record break refuses with zero byte mutation.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ERROR_TABLE, type ErrorTableEntry } from "../../packages/core/src/contracts/index";
import {
  digestPaths,
  ledgerBytes,
  ledgerDigest,
  ledgerPath,
  ledgerText,
  makeIdentity,
  makeTempRoot,
  openStore,
  quarantineDirectory,
  removeRoot,
  salvageTail,
  withinFence,
} from "../fixtures/state/harness";

const PAYLOAD_CANARY = "planted-payload-invariant-11aa";

const guidanceFor = (code: string): string =>
  (ERROR_TABLE as readonly ErrorTableEntry[]).find((entry) => entry.code === code)
    ?.remediationHint ?? "";

const seedRecords = (store: ReturnType<typeof openStore>["store"], count = 5): void => {
  withinFence(store, "writer", (handle) => {
    for (let index = 1; index <= count; index += 1) {
      const appended = store.append(handle, {
        kind: "park",
        recordKey: `key-${index}`,
        payload: index === 1 ? PAYLOAD_CANARY : { index },
      });
      expect(appended.ok).toBe(true);
    }
  });
};

const directoryDigest = (root: string): string => {
  const paths: string[] = [];
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(root, relative), { withFileTypes: true })) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else paths.push(join(root, next));
    }
  };
  if (existsSync(root)) walk("");
  return digestPaths(paths.sort());
};

const plantTruncatedTail = (text: string): string =>
  `${text}{"schemaVersion":"delivery.state.v1","kind":"park"`;

const plantFramingBreak = (text: string): string => `${text}{not-framed\n`;

/** Corrupt record 3's payload checksum while records 4 and 5 stay parseable. */
const plantMidRecordBreak = (text: string): string => {
  const lines = text.split("\n");
  const record = JSON.parse(lines[2] as string) as Record<string, unknown>;
  lines[2] = JSON.stringify({ ...record, payload: "planted-payload-corrupt" });
  return lines.join("\n");
};

describe("TC-GH222-010 reads never repair: torn reads are byte-side-effect-free", () => {
  const tears: Array<[string, (text: string) => string]> = [
    ["truncated-tail", plantTruncatedTail],
    ["framing", plantFramingBreak],
  ];

  for (const [variant, plant] of tears) {
    test(`${variant}: every read classifies torn and changes no ledger or directory bytes`, () => {
      const root = makeTempRoot("gh222-invariant");
      try {
        const identity = makeIdentity(root);
        const { store } = openStore(identity, { driver: "sqlite" });
        seedRecords(store, 3);
        writeFileSync(ledgerPath(identity), plant(ledgerText(identity)));
        const ledgerBefore = ledgerBytes(identity);
        const digestBefore = ledgerDigest(identity);
        const directoryBefore = directoryDigest(root);

        for (const read of [
          () => store.readRecords(),
          () => store.read({ requiredKeys: ["key-1"] }),
          () => store.checkIntegrity(),
          () => store.read({ requiredKeys: [] }),
        ]) {
          // Twice each: a read-triggered repair would show on the second call.
          for (let attempt = 0; attempt < 2; attempt += 1) {
            const outcome = read();
            expect(outcome.ok).toBe(false);
            if (outcome.ok) continue;
            expect(outcome.error.code).toBe("state.store.torn");
            expect(guidanceFor(outcome.error.code)).toContain("salvage");
            expect(guidanceFor(outcome.error.code)).toContain("explicit");
            expect(JSON.stringify(outcome)).not.toContain(PAYLOAD_CANARY);
            expect(JSON.stringify(outcome)).not.toContain("repaired");
          }
        }

        expect(ledgerDigest(identity)).toBe(digestBefore);
        expect(ledgerBytes(identity).equals(ledgerBefore)).toBe(true);
        expect(directoryDigest(root)).toBe(directoryBefore);
        expect(existsSync(quarantineDirectory(identity))).toBe(false);
        const kinds = ledgerText(identity).includes("state.salvage");
        expect(kinds).toBe(false);
      } finally {
        removeRoot(root);
      }
    });
  }

  test("the scan kind creates no index on a torn read", () => {
    const root = makeTempRoot("gh222-invariant-no-index");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity, { driver: "jsonl" });
      seedRecords(store, 2);
      const indexPath = `${root}/index.workspace-a.sqlite`;
      expect(existsSync(indexPath)).toBe(false);
      writeFileSync(ledgerPath(identity), plantTruncatedTail(ledgerText(identity)));
      for (let attempt = 0; attempt < 2; attempt += 1) {
        expect(store.read({ requiredKeys: [] }).ok).toBe(false);
      }
      expect(existsSync(indexPath)).toBe(false);
    } finally {
      removeRoot(root);
    }
  });
});

describe("TC-GH222-011 salvage on a mid-record tear refuses with zero byte mutation", () => {
  test("a non-terminal break fails state.store.torn and changes nothing", () => {
    const root = makeTempRoot("gh222-invariant-midrecord");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      seedRecords(store, 5);
      writeFileSync(ledgerPath(identity), plantMidRecordBreak(ledgerText(identity)));
      const before = ledgerBytes(identity);
      const digestBefore = ledgerDigest(identity);

      // The tear is at record 3 and records 4 and 5 remain frames after it.
      const tornRead = store.readRecords();
      expect(tornRead.ok).toBe(false);
      if (!tornRead.ok) {
        expect(tornRead.error.code).toBe("state.store.torn");
        expect(tornRead.error.location.record).toBe(3);
      }

      const salvaged = salvageTail(store);
      expect(salvaged.ok).toBe(false);
      if (!salvaged.ok) {
        expect(salvaged.error.code).toBe("state.store.torn");
        expect(salvaged.error.location.record).toBe(3);
        // The refusal reports no truncation position or additional record.
        expect(JSON.stringify(salvaged.error)).not.toContain("truncation");
        expect(JSON.stringify(salvaged.error)).not.toContain("quarantine");
      }
      expect(ledgerBytes(identity).equals(before)).toBe(true);
      expect(ledgerDigest(identity)).toBe(digestBefore);
      expect(existsSync(quarantineDirectory(identity))).toBe(false);
      expect(ledgerText(identity)).not.toContain("state.salvage");

      // A subsequent verified read reports the same tear (no residue).
      const again = store.readRecords();
      expect(again.ok).toBe(false);
      if (!again.ok) expect(again.error.location.record).toBe(3);
    } finally {
      removeRoot(root);
    }
  });

  test("salvage requires an acquired fence handle of the same store", () => {
    const root = makeTempRoot("gh222-invariant-fence");
    try {
      const identity = makeIdentity(root);
      const first = openStore(identity).store;
      const second = openStore(identity).store;
      seedRecords(first, 1);
      writeFileSync(ledgerPath(identity), plantTruncatedTail(ledgerText(identity)));
      const acquired = first.acquireFence("salvage-owner");
      expect(acquired.ok).toBe(true);
      if (!acquired.ok) return;
      const foreign = second.salvage(acquired.value.handle);
      expect(foreign.ok).toBe(false);
      if (!foreign.ok) expect(foreign.error.code).toBe("state.lock.busy");
      // The owning store's fenced salvage still works.
      const owned = first.salvage(acquired.value.handle);
      expect(owned.ok).toBe(true);
      first.releaseFence(acquired.value.handle);
    } finally {
      removeRoot(root);
    }
  });

  test("OQ-T3 delivery note: salvage on a clean ledger is a reported no-op", () => {
    // Outside the nine ACs; a future test-plan revision may add a dedicated
    // TC-GH222-024 for this behaviour rather than extending TC-GH222-007.
    const root = makeTempRoot("gh222-invariant-noop");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      seedRecords(store, 2);
      const before = readFileSync(ledgerPath(identity));
      const salvaged = salvageTail(store);
      expect(salvaged.ok).toBe(true);
      if (salvaged.ok) expect(salvaged.value.salvaged).toBe(false);
      expect(readFileSync(ledgerPath(identity)).equals(before)).toBe(true);
      expect(existsSync(quarantineDirectory(identity))).toBe(false);
    } finally {
      removeRoot(root);
    }
  });
});
