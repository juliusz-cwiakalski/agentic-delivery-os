/**
 * TC-GH222-014 — a post-salvage ledger rebuilds the disposable index from the
 * log alone: a stale, deleted, or corrupt index converges with the verified
 * `jsonl` scan, the salvage record is verified ledger truth, none of the
 * quarantined bytes appear in the index, and no read reports torn.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { STATE_SALVAGE_RECORD_KEY } from "../../packages/core/src/contracts/index";
import {
  ledgerPath,
  ledgerText,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
  salvageTail,
  withinFence,
} from "../fixtures/state/harness";

const TAIL_CANARY = "quarantined-tail-canary-99fa";

describe("TC-GH222-014 post-salvage ledger rebuilds the index from the log alone", () => {
  test("stale, deleted, and corrupt indexes converge with the verified scan", () => {
    const root = makeTempRoot("gh222-index-post-salvage");
    try {
      const identity = makeIdentity(root);
      const indexPath = `${root}/index.workspace-a.sqlite`;
      const { store } = openStore(identity, { driver: "sqlite" });
      withinFence(store, "writer", (handle) => {
        for (const [index, payload] of [
          [{ n: 1 }, { n: 2 }, { n: 3 }][0],
          { n: 2 },
          { n: 3 },
        ].entries()) {
          const appended = store.append(handle, {
            kind: "park",
            recordKey: `key-${index + 1}`,
            payload: payload as never,
          });
          expect(appended.ok).toBe(true);
        }
      });
      const preTear = ledgerText(identity);
      writeFileSync(
        ledgerPath(identity),
        `${preTear}{"schemaVersion":"delivery.state.v1","payload":"${TAIL_CANARY}"`,
      );

      const salvaged = salvageTail(store);
      expect(salvaged.ok).toBe(true);
      if (!salvaged.ok || !salvaged.value.salvaged) return;
      const quarantinePath = salvaged.value.report.quarantinePath;

      // The oracle is the verified ledger scan of the same salvaged bytes.
      const oracle = openStore(identity, { driver: "jsonl" }).store.readRecords();
      expect(oracle.ok).toBe(true);
      if (!oracle.ok) return;
      expect(oracle.value.records).toHaveLength(4);
      expect(oracle.value.records[3]?.key).toBe(STATE_SALVAGE_RECORD_KEY);
      const oracleValues = Object.fromEntries(
        oracle.value.records.map((record) => [record.key, record.payload]),
      );

      const expectConverged = (reason: "missing" | "corrupt" | "divergent"): void => {
        const read = store.read({
          requiredKeys: ["key-1", "key-2", "key-3", STATE_SALVAGE_RECORD_KEY],
        });
        expect(read.ok, reason).toBe(true);
        if (!read.ok) return;
        expect(read.value.evidence.recordCount, reason).toBe(4);
        expect(read.value.evidence.rebuild?.reason, reason).toBe(reason);
        expect(read.value.values["key-1"], reason).toEqual({ n: 1 });
        expect(Object.keys(read.value.values).sort(), reason).toEqual(
          oracle.value.records.map((record) => record.key).sort(),
        );
        // The quarantine contributes no rows and never becomes truth.
        expect(Object.keys(read.value.values), reason).not.toContain(quarantinePath);
        expect(JSON.stringify(read.value), reason).not.toContain(TAIL_CANARY);
      };

      // 1. The pre-salvage index is stale (it lacks the salvage record).
      expectConverged("divergent");
      // 2. A deleted index rebuilds from the log alone.
      rmSync(indexPath, { force: true });
      expectConverged("missing");
      // 3. A corrupt index rebuilds from the log alone.
      writeFileSync(indexPath, "not-a-database");
      expectConverged("corrupt");
      // 4. Deleting it again reproduces the same result (disposable).
      rmSync(indexPath, { force: true });
      expectConverged("missing");

      // Every read of the salvaged store verifies; none reports torn.
      const verified = store.readRecords();
      expect(verified.ok).toBe(true);
      if (verified.ok) {
        expect(verified.value.evidence.recordCount).toBe(4);
        expect(verified.value.records.map((record) => record.payload)).toEqual(
          oracle.value.records.map((record) => record.payload),
        );
        expect(JSON.stringify(verified.value)).not.toContain(TAIL_CANARY);
      }
      // The quarantine artifact is still preserved outside the read path.
      expect(readFileSync(quarantinePath, "utf8")).toBe(
        `{"schemaVersion":"delivery.state.v1","payload":"${TAIL_CANARY}"`,
      );
      expect(oracleValues[STATE_SALVAGE_RECORD_KEY]).toBeDefined();
    } finally {
      removeRoot(root);
    }
  });
});
