/**
 * TC-GH222-015/016 — storage exhaustion is fail-closed at every write boundary:
 * the append and the derived-document replace fail `state.storage.exhausted`
 * with `not_landed`, leave the ledger at its last valid frame (and the document
 * at its previous version), and land exactly once after the fault is disarmed.
 * Exhaustion is injected only at the ASM-3 pre-commit points.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import type { StateFenceHandle, StateStorePort } from "../../packages/core/src/contracts/index";
import { ERROR_TABLE, type ErrorTableEntry } from "../../packages/core/src/contracts/index";
import type { StateEdgeFaultPoint } from "../../packages/core/src/state/index";
import {
  createTestEdge,
  ledgerBytes,
  ledgerPath,
  ledgerText,
  makeIdentity,
  makeTempRoot,
  openStore,
  quarantineFiles,
  removeRoot,
  salvageTail,
  type TestEdge,
} from "../fixtures/state/harness";

const DOCUMENT = "snapshot";

const documentPath = (root: string, workspace = "workspace-a"): string =>
  `${root}/documents.${encodeURIComponent(workspace)}/${DOCUMENT}`;

const guidanceFor = (code: string): string =>
  (ERROR_TABLE as readonly ErrorTableEntry[]).find((entry) => entry.code === code)
    ?.remediationHint ?? "";

const expectExhausted = (failure: {
  code: string;
  consequence: string;
  rendered: string;
}): void => {
  expect(failure.code).toBe("state.storage.exhausted");
  expect(failure.code).not.toBe("state.write.failed");
  expect(failure.consequence).toBe("not_landed");
  expect(guidanceFor(failure.code)).toContain("storage");
  expect(guidanceFor(failure.code)).toContain("last valid frame");
  expect(failure.rendered).not.toContain("checksum");
  expect(failure.rendered).not.toContain("planted-payload-");
};

const observeExhaustion = (
  result: { ok: boolean; error?: unknown },
  point: StateEdgeFaultPoint,
  edge: TestEdge,
): { code: string; consequence: string; rendered: string } => {
  expect(edge.raised).toContain(point);
  expect(result.ok).toBe(false);
  if (result.ok || result.error === undefined) throw new Error("expected a classified failure");
  const error = result.error as { code: string; consequence: string };
  return {
    code: error.code,
    consequence: error.consequence,
    rendered: JSON.stringify(error),
  };
};

const seedRecords = (store: StateStorePort, count = 3): void => {
  const acquired = store.acquireFence("seed-writer");
  if (!acquired.ok) throw new Error(acquired.error.code);
  try {
    for (let index = 1; index <= count; index += 1) {
      const appended = store.append(acquired.value.handle, {
        kind: "park",
        recordKey: `k${index}`,
        payload: { index },
      });
      expect(appended.ok).toBe(true);
    }
  } finally {
    store.releaseFence(acquired.value.handle);
  }
};

const seedPreviousDocument = (store: StateStorePort): void => {
  const acquired = store.acquireFence("document-writer");
  if (!acquired.ok) throw new Error(acquired.error.code);
  try {
    const replaced = store.replaceDocument(acquired.value.handle, {
      name: DOCUMENT,
      content: { version: "previous" },
    });
    expect(replaced.ok).toBe(true);
  } finally {
    store.releaseFence(acquired.value.handle);
  }
};

describe("TC-GH222-015 append under injected exhaustion is fail-closed", () => {
  test("append-before-flush exhaustion leaves the ledger byte-identical and retries cleanly", () => {
    const root = makeTempRoot("gh222-exhausted-append");
    try {
      const identity = makeIdentity(root);
      const edge = createTestEdge();
      const { store } = openStore(identity, { edge });
      seedRecords(store, 3);
      const before = readFileSync(ledgerPath(identity));
      const verifiedBefore = store.readRecords();
      expect(verifiedBefore.ok).toBe(true);

      const acquired = store.acquireFence("exhausted-writer");
      if (!acquired.ok) throw new Error(acquired.error.code);
      const handle: StateFenceHandle = acquired.value.handle;
      edge.armExhaustion(["append-before-flush"]);
      const attempted = store.append(handle, {
        kind: "park",
        recordKey: "k4",
        payload: "planted-payload-exhausted",
      });
      const failure = observeExhaustion(attempted, "append-before-flush", edge);
      expectExhausted(failure);

      // No partial frame: the whole ledger is byte-identical and still verifies.
      expect(readFileSync(ledgerPath(identity)).equals(before)).toBe(true);
      const verifiedAfter = store.readRecords();
      expect(verifiedAfter.ok).toBe(true);
      if (verifiedAfter.ok) {
        expect(verifiedAfter.value.records).toHaveLength(3);
        expect(verifiedAfter.value.records[2]?.sequence).toBe(3);
      }

      edge.disarm();
      const retried = store.append(handle, {
        kind: "park",
        recordKey: "k4",
        payload: "planted-payload-exhausted",
      });
      expect(retried.ok).toBe(true);
      if (retried.ok) expect(retried.value.sequence).toBe(4);
      const landed = store.readRecords();
      if (landed.ok) expect(landed.value.records).toHaveLength(4);
      store.releaseFence(handle);
    } finally {
      removeRoot(root);
    }
  });
});

describe("TC-GH222-016 derived-document replace under exhaustion keeps the previous version", () => {
  const preCommitPoints: StateEdgeFaultPoint[] = [
    "replace-before-temp",
    "replace-after-temp-write",
    "replace-rename",
  ];

  for (const point of preCommitPoints) {
    test(`${point}: the target stays at the previous version and the retry lands atomically`, () => {
      const root = makeTempRoot("gh222-exhausted-replace");
      try {
        const identity = makeIdentity(root);
        const seeded = openStore(identity).store;
        seedPreviousDocument(seeded);
        const previous = readFileSync(documentPath(root), "utf8");

        const edge = createTestEdge();
        const { store } = openStore(identity, { edge });
        const acquired = store.acquireFence("replace-writer");
        if (!acquired.ok) throw new Error(acquired.error.code);
        const handle = acquired.value.handle;

        edge.armExhaustion([point]);
        const attempted = store.replaceDocument(handle, {
          name: DOCUMENT,
          content: { version: "new" },
        });
        const failure = observeExhaustion(attempted, point, edge);
        expectExhausted(failure);

        // The observable target is exactly the previous version, never partial.
        expect(readFileSync(documentPath(root), "utf8")).toBe(previous);
        expect(JSON.parse(readFileSync(documentPath(root), "utf8"))).toEqual({
          version: "previous",
        });
        // Any temporary is excluded from served documents, and no served
        // document is a truncated fragment.
        const documentsDirectory = `${root}/documents.workspace-a`;
        for (const name of readdirSync(documentsDirectory).filter(
          (entry) => !entry.endsWith(".tmp"),
        )) {
          const content = readFileSync(`${documentsDirectory}/${name}`, "utf8");
          expect(() => JSON.parse(content)).not.toThrow();
          expect(content.trim()).toBe(JSON.stringify({ version: "previous" }));
        }
        // A reopen cleans an injected temporary and never serves it as content.
        const reopened = openStore(identity).store.read({ requiredKeys: [] });
        expect(reopened.ok).toBe(true);
        expect(readdirSync(documentsDirectory).filter((entry) => entry.endsWith(".tmp"))).toEqual(
          [],
        );
        expect(JSON.parse(readFileSync(documentPath(root), "utf8"))).toEqual({
          version: "previous",
        });

        edge.disarm();
        const retried = store.replaceDocument(handle, {
          name: DOCUMENT,
          content: { version: "new" },
        });
        expect(retried.ok).toBe(true);
        expect(JSON.parse(readFileSync(documentPath(root), "utf8"))).toEqual({ version: "new" });
        store.releaseFence(handle);
      } finally {
        removeRoot(root);
      }
    });
  }

  test("an absent target stays absent under exhaustion and then lands atomically", () => {
    const root = makeTempRoot("gh222-exhausted-absent-target");
    try {
      const identity = makeIdentity(root);
      const edge = createTestEdge();
      const { store } = openStore(identity, { edge });
      const acquired = store.acquireFence("document-writer");
      if (!acquired.ok) throw new Error(acquired.error.code);
      const handle = acquired.value.handle;

      edge.armExhaustion(["replace-before-temp"]);
      const attempted = store.replaceDocument(handle, {
        name: DOCUMENT,
        content: { version: "new" },
      });
      const failure = observeExhaustion(attempted, "replace-before-temp", edge);
      expectExhausted(failure);
      expect(existsSync(documentPath(root))).toBe(false);
      const documents = existsSync(`${root}/documents.workspace-a`)
        ? readdirSync(`${root}/documents.workspace-a`)
        : [];
      expect(documents.filter((name) => !name.endsWith(".tmp"))).toEqual([]);

      edge.disarm();
      const retried = store.replaceDocument(handle, {
        name: DOCUMENT,
        content: { version: "new" },
      });
      expect(retried.ok).toBe(true);
      expect(JSON.parse(readFileSync(documentPath(root), "utf8"))).toEqual({ version: "new" });
      store.releaseFence(handle);
    } finally {
      removeRoot(root);
    }
  });
});

const TAIL_FRAGMENT = `{"schemaVersion":"delivery.state.v1","kind":"park","key":"torn","payload":"tail-canary-exhausted"`;
const TAIL_BYTES = Buffer.from(TAIL_FRAGMENT, "utf8");

const plantTerminalTear = (
  store: StateStorePort,
  identity: ReturnType<typeof makeIdentity>,
): void => {
  seedRecords(store, 3);
  writeFileSync(ledgerPath(identity), `${ledgerText(identity)}${TAIL_FRAGMENT}`);
};

describe("TC-GH222-017 salvage write under exhaustion leaves the ledger unchanged", () => {
  const salvagePoints: StateEdgeFaultPoint[] = ["salvage-quarantine-write", "salvage-ledger-write"];

  for (const point of salvagePoints) {
    test(`${point}: nothing lands, the store is still torn, and the retry yields one record and one artifact`, () => {
      const root = makeTempRoot("gh222-exhausted-salvage");
      try {
        const identity = makeIdentity(root);
        const edge = createTestEdge();
        const { store } = openStore(identity, { edge });
        plantTerminalTear(store, identity);
        const before = ledgerBytes(identity);
        const tornBefore = store.readRecords();
        expect(tornBefore.ok).toBe(false);
        const tornPosition = tornBefore.ok ? undefined : tornBefore.error.location.record;

        edge.armExhaustion([point]);
        const attempted = salvageTail(store);
        const failure = observeExhaustion(attempted, point, edge);
        expectExhausted(failure);
        if (!attempted.ok) expect(attempted.error.location.path).toContain(identity.stateDirectory);

        // Whole-ledger byte identity: still torn at the same position.
        expect(ledgerBytes(identity).equals(before)).toBe(true);
        const stillTorn = store.readRecords();
        expect(stillTorn.ok).toBe(false);
        if (!stillTorn.ok) expect(stillTorn.error.location.record).toBe(tornPosition);
        expect(ledgerText(identity)).not.toContain("state.salvage");
        // No quarantine artifact is presented as evidence for the failed attempt.
        expect(quarantineFiles(identity)).toEqual([]);

        // The retry produces exactly one salvage record and one artifact.
        edge.disarm();
        const retried = salvageTail(store);
        expect(retried.ok).toBe(true);
        if (!retried.ok || !retried.value.salvaged) return;
        const verified = store.readRecords();
        expect(verified.ok).toBe(true);
        if (verified.ok) {
          const salvageRecords = verified.value.records.filter(
            (record) => record.kind === "state.salvage",
          );
          expect(salvageRecords).toHaveLength(1);
          expect(verified.value.records).toHaveLength(4);
        }
        const artifacts = quarantineFiles(identity);
        expect(artifacts).toHaveLength(1);
        const artifact = readFileSync(`${root}/quarantine.workspace-a/${artifacts[0] as string}`);
        expect(artifact.equals(TAIL_BYTES)).toBe(true);
      } finally {
        removeRoot(root);
      }
    });
  }

  test("a non-exhaustion quarantine failure stays state.write.failed with the ledger unchanged", () => {
    const root = makeTempRoot("gh222-salvage-write-failed");
    try {
      const identity = makeIdentity(root);
      const edge = createTestEdge();
      const { store } = openStore(identity, { edge });
      plantTerminalTear(store, identity);
      const before = ledgerBytes(identity);

      // A generic (non-ENOSPC) write error at the same pre-commit seam.
      edge.arm(["salvage-quarantine-write"]);
      const attempted = salvageTail(store);
      expect(edge.raised).toContain("salvage-quarantine-write");
      expect(attempted.ok).toBe(false);
      if (!attempted.ok) {
        expect(attempted.error.code).toBe("state.write.failed");
        expect(attempted.error.code).not.toBe("state.storage.exhausted");
        expect(attempted.error.consequence).toBe("not_landed");
      }
      expect(ledgerBytes(identity).equals(before)).toBe(true);
      expect(quarantineFiles(identity)).toEqual([]);
    } finally {
      removeRoot(root);
    }
  });
});
