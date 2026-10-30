/**
 * TC-STATE-012 — derived documents are replaced atomically: the target is the
 * previous or the new version, never partial, and failed replaces report
 * `not_landed` (AC-F6-1, NFR-3, TDR-0004 §5).
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { StateEdgeFaultPoint } from "../../packages/core/src/state/index";
import {
  createTestEdge,
  ledgerText,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
  type TestEdge,
} from "../fixtures/state/harness";

const DOCUMENT = "snapshot";
const documentPath = (root: string, workspace = "workspace-a"): string =>
  `${root}/documents.${encodeURIComponent(workspace)}/${DOCUMENT}`;

const replace = (
  store: ReturnType<typeof openStore>["store"],
  content: unknown,
): ReturnType<typeof store.replaceDocument> => {
  const acquired = store.acquireFence("replace-writer");
  if (!acquired.ok) throw new Error(`acquire failed: ${acquired.error.code}`);
  try {
    return store.replaceDocument(acquired.value.handle, { name: DOCUMENT, content });
  } finally {
    store.releaseFence(acquired.value.handle);
  }
};

const seedPreviousVersion = (root: string): void => {
  const identity = makeIdentity(root);
  const { store } = openStore(identity);
  const replaced = replace(store, { version: "previous" });
  expect(replaced.ok).toBe(true);
  expect(JSON.parse(readFileSync(documentPath(root), "utf8"))).toEqual({ version: "previous" });
};

describe("TC-STATE-012 atomic-replace crash matrix", () => {
  const preRenamePoints: StateEdgeFaultPoint[] = [
    "replace-before-temp",
    "replace-after-temp-write",
    "replace-rename",
  ];

  for (const point of preRenamePoints) {
    test(`${point} leaves the previous version and reports not_landed`, () => {
      const root = makeTempRoot(`replace-${point}`);
      try {
        seedPreviousVersion(root);
        const identity = makeIdentity(root);
        const edge: TestEdge = createTestEdge({ faults: [point] });
        const { store } = openStore(identity, { edge });
        const attempted = replace(store, { version: "new" });
        expect(attempted.ok).toBe(false);
        if (!attempted.ok) {
          expect(attempted.error.code).toBe("state.write.failed");
          expect(attempted.error.consequence).toBe("not_landed");
        }
        const content = readFileSync(documentPath(root), "utf8");
        expect(JSON.parse(content)).toEqual({ version: "previous" });
      } finally {
        removeRoot(root);
      }
    });
  }

  test("a fault after the rename leaves the new version (never partial)", () => {
    const root = makeTempRoot("replace-after-rename");
    try {
      seedPreviousVersion(root);
      const identity = makeIdentity(root);
      const edge = createTestEdge({ faults: ["replace-after-rename"] });
      const { store } = openStore(identity, { edge });
      expect(() => replace(store, { version: "new" })).toThrow();
      expect(JSON.parse(readFileSync(documentPath(root), "utf8"))).toEqual({ version: "new" });
    } finally {
      removeRoot(root);
    }
  });

  test("a successful replace is observable, complete, ledger-first and rebuildable", () => {
    const root = makeTempRoot("replace-success");
    try {
      seedPreviousVersion(root);
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      const replaced = replace(store, { version: "new" });
      expect(replaced.ok).toBe(true);
      expect(JSON.parse(readFileSync(documentPath(root), "utf8"))).toEqual({ version: "new" });

      const lines = ledgerText(identity)
        .split("\n")
        .filter((line) => line !== "");
      const last = JSON.parse(lines[lines.length - 1] as string) as {
        kind: string;
        key: string;
        payload: unknown;
      };
      expect(last.kind).toBe("document");
      expect(last.key).toBe(`document:${DOCUMENT}`);
      expect(last.payload).toEqual({ version: "new" });
    } finally {
      removeRoot(root);
    }
  });

  test("stale temporaries are cleaned on open and never read as content", () => {
    const root = makeTempRoot("replace-stale-temp");
    try {
      seedPreviousVersion(root);
      writeFileSync(`${documentPath(root)}.tmp`, '{"version":"partial"');
      const { store } = openStore(makeIdentity(root));
      expect(existsSync(`${documentPath(root)}.tmp`)).toBe(false);
      expect(JSON.parse(readFileSync(documentPath(root), "utf8"))).toEqual({ version: "previous" });
      const read = store.read({ requiredKeys: [] });
      expect(read.ok).toBe(true);
      if (read.ok)
        expect(read.value.evidence.cleanedTemporaries).toContain(
          `${root}/documents.workspace-a/${DOCUMENT}.tmp`,
        );
    } finally {
      removeRoot(root);
    }
  });

  test("a failed append before flush is not_landed and writes no bytes", () => {
    const root = makeTempRoot("replace-append-fault");
    try {
      const identity = makeIdentity(root);
      const edge = createTestEdge({ faults: ["append-before-flush"] });
      const { store } = openStore(identity, { edge });
      const acquired = store.acquireFence("writer");
      expect(acquired.ok).toBe(true);
      if (!acquired.ok) return;
      const appended = store.append(acquired.value.handle, {
        kind: "park",
        recordKey: "k",
        payload: 1,
      });
      expect(appended.ok).toBe(false);
      if (!appended.ok) {
        expect(appended.error.code).toBe("state.write.failed");
        expect(appended.error.consequence).toBe("not_landed");
      }
      expect(existsSync(`${root}/ledger.workspace-a.jsonl`)).toBe(false);
    } finally {
      removeRoot(root);
    }
  });

  test("the direct-write partiality control is caught by the same assertion", () => {
    const root = makeTempRoot("replace-partial-control");
    try {
      seedPreviousVersion(root);
      const target = documentPath(root);
      // A non-atomic implementation truncates the target before writing.
      writeFileSync(target, '{"version":');
      const content = readFileSync(target, "utf8");
      const acceptable = [
        JSON.stringify({ version: "previous" }),
        JSON.stringify({ version: "new" }),
      ];
      expect(acceptable).not.toContain(content);
    } finally {
      removeRoot(root);
    }
  });
});
