/**
 * TC-GH222-007/008/009 — the explicit guided salvage operation: truncate to the
 * last valid frame, append the classified salvage record as durable truth,
 * quarantine the post-tear bytes outside every read path, and report evidence
 * naming the truncation position and quarantined extent only.
 */
import { describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import {
  STATE_SALVAGE_PAYLOAD_SCHEMA,
  STATE_SALVAGE_RECORD_KEY,
  STATE_SALVAGE_RECORD_KIND,
  STATE_SCHEMA_VERSION,
  type StateStorePort,
} from "../../packages/core/src/contracts/index";
import {
  ledgerBytes,
  ledgerPath,
  ledgerText,
  makeIdentity,
  makeTempRoot,
  openStore,
  quarantineDirectory,
  quarantineFiles,
  quarantinePath,
  removeRoot,
  salvageTail,
  withinFence,
} from "../fixtures/state/harness";

const PAYLOAD_CANARY = "planted-payload-salvage-77b1";
const TAIL_CANARY = "tail-bytes-canary-4f2a";
const POSIX = process.platform !== "win32";

const utf8Length = (text: string): number => new TextEncoder().encode(text).length;

const seed = (store: StateStorePort, records: readonly unknown[]): void => {
  withinFence(store, "writer", (handle) => {
    for (const [index, payload] of records.entries()) {
      const appended = store.append(handle, {
        kind: "park",
        recordKey: `key-${index + 1}`,
        payload: payload as never,
      });
      expect(appended.ok).toBe(true);
    }
  });
};

/** A terminal framing break: one complete, unframeable line at the tail. */
const plantTerminalFramingBreak = (text: string): string => `${text}{not-framed}\n`;

/** A terminal truncated tail: an unterminated final fragment. */
const plantTruncatedTail = (text: string, fragment: string): string => `${text}${fragment}`;

const tailGeometry = (
  text: string,
): { prefixBytes: number; tailBytes: number; position: number } => {
  const prefixCharacters = text.lastIndexOf("\n") + 1;
  const prefixBytes = utf8Length(text.slice(0, prefixCharacters));
  return {
    prefixBytes,
    tailBytes: utf8Length(text) - prefixBytes,
    position: text.split("\n").length,
  };
};

describe("TC-GH222-007 salvage happy path: truncate, record, quarantine, evidence", () => {
  test("a terminal tear salvages into verified truth and returns extent evidence", () => {
    const root = makeTempRoot("gh222-salvage-happy");
    try {
      const identity = makeIdentity(root);
      // The indexed kind: salvage must not treat the index as truth.
      const { store } = openStore(identity, { driver: "sqlite" });
      seed(store, [PAYLOAD_CANARY, { n: 2 }, 0, false]);
      const intact = ledgerText(identity);
      const tornText = plantTerminalFramingBreak(intact);
      writeFileSync(ledgerPath(identity), tornText);
      const indexBefore = `${root}/index.workspace-a.sqlite`;
      const indexBytes = readFileSync(indexBefore);

      // The torn store is verified torn before salvage (non-vacuity).
      const tornRead = store.readRecords();
      expect(tornRead.ok).toBe(false);

      const salvaged = salvageTail(store);
      expect(salvaged.ok).toBe(true);
      if (!salvaged.ok) return;
      expect(salvaged.value.salvaged).toBe(true);
      if (!salvaged.value.salvaged) return;
      const report = salvaged.value.report;

      expect(report.ledgerPath).toBe(ledgerPath(identity));
      expect(report.keptRecords).toBe(4);
      expect(report.sequence).toBe(5);
      expect(report.truncationOffset).toBe(utf8Length(intact));
      expect(report.quarantinedBytes).toBe(utf8Length("{not-framed}\n"));
      expect(report.quarantinePath.startsWith(quarantineDirectory(identity))).toBe(true);
      expect(report.quarantinePath).not.toContain("documents.");
      expect(report.quarantinePath).not.toContain("index.");
      expect(salvaged.value.evidence.rebuild).toBeUndefined();
      expect(salvaged.value.evidence.repair).toBeUndefined();
      // Salvage neither read nor rewrote the derived index: it is not truth.
      expect(readFileSync(indexBefore).equals(indexBytes)).toBe(true);

      // The ledger now ends at a complete, verifiable frame preceded by every
      // pre-tear record; the final record is the classified salvage record.
      const verified = store.readRecords();
      expect(verified.ok).toBe(true);
      if (!verified.ok) return;
      expect(verified.value.records).toHaveLength(5);
      const last = verified.value.records[4];
      expect(last?.kind).toBe(STATE_SALVAGE_RECORD_KIND);
      expect(last?.key).toBe(STATE_SALVAGE_RECORD_KEY);
      expect(last?.schemaVersion).toBe(STATE_SCHEMA_VERSION);
      expect(last?.sequence).toBe(5);
      const payload = last?.payload as Record<string, unknown>;
      expect(payload.schemaId).toBe(STATE_SALVAGE_PAYLOAD_SCHEMA);
      expect(payload.tearPosition).toBe(5);
      expect(payload.truncationOffset).toBe(report.truncationOffset);
      expect(payload.quarantinedBytes).toBe(report.quarantinedBytes);
      expect(payload.quarantinePath).toBe(report.quarantinePath);
      expect(payload.keptRecords).toBe(4);
      expect(JSON.stringify(payload)).not.toContain(PAYLOAD_CANARY);
      expect(JSON.stringify(payload)).not.toContain("checksum");

      // Post-salvage reads serve the preserved values exactly.
      const read = store.read({ requiredKeys: ["key-1", "key-3", "key-4"] });
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.value.values).toEqual({ "key-1": PAYLOAD_CANARY, "key-3": 0, "key-4": false });
        expect(read.value.evidence.recordCount).toBe(5);
      }

      // A quarantine artifact exists outside the served namespaces.
      expect(quarantineFiles(identity)).toHaveLength(1);
      expect(existsSync(report.quarantinePath)).toBe(true);
    } finally {
      removeRoot(root);
    }
  });

  test("a truncated tail salvages the same way (both terminal tear shapes)", () => {
    const root = makeTempRoot("gh222-salvage-truncated");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      seed(store, [{ n: 1 }, { n: 2 }]);
      const fragment = `{"schemaVersion":"${STATE_SCHEMA_VERSION}","kind":"park","key":"key-3"`;
      writeFileSync(ledgerPath(identity), plantTruncatedTail(ledgerText(identity), fragment));

      const salvaged = salvageTail(store);
      expect(salvaged.ok).toBe(true);
      if (!salvaged.ok || !salvaged.value.salvaged) return;
      expect(salvaged.value.report.keptRecords).toBe(2);
      expect(salvaged.value.report.quarantinedBytes).toBe(utf8Length(fragment));
      const verified = store.readRecords();
      if (verified.ok) expect(verified.value.records).toHaveLength(3);
    } finally {
      removeRoot(root);
    }
  });
});

describe("TC-GH222-008 salvage preserves every pre-tear record byte-for-byte", () => {
  test("the valid prefix is byte-identical and no pre-tear value is altered", () => {
    const root = makeTempRoot("gh222-salvage-preserve");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      const records = [
        PAYLOAD_CANARY,
        0,
        "",
        false,
        { nested: { list: [1, null, "x"] }, empty: {} },
      ];
      seed(store, records);
      const prefix = ledgerText(identity);
      const prefixLines = prefix.split("\n").filter((line) => line !== "");
      expect(prefixLines).toHaveLength(records.length);
      const torn = plantTruncatedTail(prefix, '{"schemaVersion":"delivery.state.v1"');
      writeFileSync(ledgerPath(identity), torn);

      const salvaged = salvageTail(store);
      expect(salvaged.ok).toBe(true);
      if (!salvaged.ok || !salvaged.value.salvaged) return;

      const after = ledgerText(identity);
      expect(after.startsWith(prefix)).toBe(true);
      // Removing the salvage record reproduces the original prefix exactly.
      const salvageLine = after.slice(prefix.length);
      expect(after.slice(0, prefix.length)).toBe(prefix);
      expect(`${after.slice(0, prefix.length)}${salvageLine}`).toBe(after);
      expect(salvageLine.trimEnd().split("\n")).toHaveLength(1);

      const verified = store.readRecords();
      expect(verified.ok).toBe(true);
      if (!verified.ok) return;
      const preTear = verified.value.records.slice(0, records.length);
      expect(preTear.map((record) => record.payload)).toEqual(records as never);
      expect(preTear.map((record) => record.sequence)).toEqual([1, 2, 3, 4, 5]);
      expect(verified.value.records[records.length]?.kind).toBe(STATE_SALVAGE_RECORD_KIND);
      // Every pre-tear serialized line is byte-identical to the captured one.
      const afterLines = after.split("\n").filter((line) => line !== "");
      expect(afterLines.slice(0, records.length)).toEqual(prefixLines);
      // The salvage record duplicates no pre-tear payload content.
      expect(salvageLine).not.toContain(PAYLOAD_CANARY);
      expect(salvageLine).not.toContain(`"empty"`);
    } finally {
      removeRoot(root);
    }
  });
});

describe("TC-GH222-009 post-tear bytes are quarantined and never served as content", () => {
  test("the quarantine artifact holds the exact tail bytes and no read path serves them", () => {
    const root = makeTempRoot("gh222-salvage-quarantine");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      seed(store, [{ n: 1 }, { n: 2 }, { n: 3 }]);
      const prefix = ledgerText(identity);
      const fragment = `{"schemaVersion":"delivery.state.v1","kind":"park","key":"tail","payload":"${TAIL_CANARY}"`;
      const torn = plantTruncatedTail(prefix, fragment);
      writeFileSync(ledgerPath(identity), torn);
      const capturedTail = Buffer.from(fragment, "utf8");
      const geometry = tailGeometry(torn);

      const salvaged = salvageTail(store);
      expect(salvaged.ok).toBe(true);
      if (!salvaged.ok || !salvaged.value.salvaged) return;
      const report = salvaged.value.report;

      // The artifact holds exactly the original post-tear bytes.
      expect(readFileSync(report.quarantinePath).equals(capturedTail)).toBe(true);
      expect(report.quarantinedBytes).toBe(capturedTail.length);
      expect(report.quarantinedBytes).toBe(geometry.tailBytes);
      expect(report.truncationOffset).toBe(geometry.prefixBytes);
      expect(report.quarantinePath).toBe(
        quarantinePath(
          identity,
          `tail-${geometry.position}-${geometry.prefixBytes}-${geometry.tailBytes}.bytes`,
        ),
      );
      // Evidence names the path and extent only.
      const rendered = JSON.stringify(report);
      expect(rendered).not.toContain(TAIL_CANARY);
      expect(rendered).not.toContain("checksum");
      expect(rendered).not.toContain(PAYLOAD_CANARY);

      // No documented read path serves the tail canary.
      const outcomes = [
        store.read({ requiredKeys: [] }),
        store.readRecords(),
        store.checkIntegrity(),
      ];
      for (const outcome of outcomes) {
        expect(JSON.stringify(outcome)).not.toContain(TAIL_CANARY);
        expect(JSON.stringify(outcome)).not.toContain("tail-bytes");
      }
      // The quarantine artifact is not inside the served documents directory.
      expect(report.quarantinePath).not.toContain("documents.");

      if (POSIX) {
        // The store permission contract applies to quarantine artifacts.
        const mode = statSync(report.quarantinePath).mode & 0o777;
        expect(mode).toBe(0o600);
      }
    } finally {
      removeRoot(root);
    }
  });

  test("a foreign-permission quarantine artifact is detected, not accepted", () => {
    const root = makeTempRoot("gh222-salvage-foreign-perms");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      seed(store, [{ n: 1 }]);
      const torn = plantTruncatedTail(ledgerText(identity), '{"partial":true');
      writeFileSync(ledgerPath(identity), torn);
      const geometry = tailGeometry(torn);
      const artifact = quarantinePath(
        identity,
        `tail-${geometry.position}-${geometry.prefixBytes}-${geometry.tailBytes}.bytes`,
      );
      const fragment = torn.slice(torn.length - '{"partial":true'.length);
      const directory = quarantineDirectory(identity);
      if (POSIX) {
        mkdirSync(directory, { recursive: true, mode: 0o700 });
        writeFileSync(artifact, fragment);
        chmodSync(artifact, 0o644);
      }
      const before = ledgerBytes(identity);
      const salvaged = salvageTail(store);
      if (POSIX) {
        expect(salvaged.ok).toBe(false);
        if (!salvaged.ok) expect(salvaged.error.code).toBe("state.permission.denied");
        expect(ledgerBytes(identity).equals(before)).toBe(true);
      } else {
        // Windows ACL verification is not claimed by a Linux run.
        expect(typeof salvaged.ok).toBe("boolean");
      }
    } finally {
      removeRoot(root);
    }
  });
});
