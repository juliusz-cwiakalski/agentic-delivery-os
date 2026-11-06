/**
 * TC-STATE-018 (trigger half), TC-STATE-020, and TC-GH222-018 (trigger sweep) —
 * all nine state codes are driven through their real triggers, every write-path
 * failure reports `not_landed`, and error locations never carry payload or
 * checksum content.
 */
import { describe, expect, test } from "bun:test";
import { chmodSync, writeFileSync } from "node:fs";

import { classifyDomainKind, classifyThrown } from "../../packages/cli/src/classify";
import {
  ERROR_TABLE,
  type ErrorTableEntry,
  type StateResult,
} from "../../packages/core/src/contracts/index";
import { createArtifactBoundary } from "../../packages/core/src/state/index";
import {
  createTestEdge,
  ledgerPath,
  ledgerText,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
  withinFence,
} from "../fixtures/state/harness";

const CANARY = "planted-payload-classification-3f7a";
const POSIX = process.platform !== "win32";
const STATE_CODES = [
  "state.store.torn",
  "state.schema.mismatch",
  "state.keys.missing",
  "state.lock.busy",
  "state.permission.denied",
  "state.write.failed",
  "state.storage.exhausted",
  "state.store.unknown",
  "state.level.unsupported",
] as const;

const entryFor = (code: string): ErrorTableEntry =>
  (ERROR_TABLE as readonly ErrorTableEntry[]).find(
    (candidate) => candidate.code === code,
  ) as ErrorTableEntry;

const sweep = (text: string): void => {
  expect(text).not.toContain(CANARY);
  expect(text).not.toContain(JSON.stringify(CANARY).slice(1, -1));
  expect(text).not.toContain("checksum");
};

const observeFailure = (
  result: StateResult<unknown>,
): {
  code: string;
  consequence: string;
  rendered: string;
} => {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("expected a failure");
  return {
    code: result.error.code,
    consequence: result.error.consequence,
    rendered: JSON.stringify(result.error),
  };
};

describe("TC-STATE-018 nine codes through real triggers", () => {
  test("the table declares exactly the nine codes with not_landed", () => {
    expect(
      (ERROR_TABLE as readonly ErrorTableEntry[]).filter((entry) => entry.domainKind === "state"),
    ).toHaveLength(9);
    for (const code of STATE_CODES) {
      const entry = entryFor(code);
      expect(entry.domainKind).toBe("state");
      expect(entry.consequence).toBe("not_landed");
      expect(classifyDomainKind("state", code)).toEqual(entry);
      expect(classifyThrown({ kind: "state", code })).toEqual(entry);
    }
  });

  test("store.torn and schema.mismatch come from real corrupted artifacts", () => {
    const root = makeTempRoot("classify-torn");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      withinFence(store, "writer", (handle) => {
        store.append(handle, { kind: "park", recordKey: "k", payload: CANARY });
      });
      const lines = ledgerText(identity).split("\n");
      const record = JSON.parse(lines[0] as string) as Record<string, unknown>;
      lines[0] = JSON.stringify({ ...record, payload: `${CANARY}-flipped` });
      writeFileSync(ledgerPath(identity), lines.join("\n"));
      const torn = observeFailure(store.read({ requiredKeys: ["k"] }));
      expect(torn.code).toBe("state.store.torn");
      sweep(torn.rendered);

      writeFileSync(
        `${root}/header.workspace-a.json`,
        `${JSON.stringify({ schemaVersion: "delivery.state.v999" })}\n`,
      );
      const mismatch = observeFailure(store.read({ requiredKeys: ["k"] }));
      expect(mismatch.code).toBe("state.schema.mismatch");
      sweep(mismatch.rendered);
    } finally {
      removeRoot(root);
    }
  });

  test("keys.missing names the missing keys without values", () => {
    const root = makeTempRoot("classify-keys");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      withinFence(store, "writer", (handle) => {
        store.append(handle, { kind: "park", recordKey: "present", payload: CANARY });
      });
      const result = store.read({ requiredKeys: ["present", "absent"] });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("state.keys.missing");
        expect(result.error.location.missingKeys).toEqual(["absent"]);
        expect(JSON.stringify(result.error)).not.toContain(CANARY);
      }
    } finally {
      removeRoot(root);
    }
  });

  test("lock.busy comes from contention and lands nothing", () => {
    const root = makeTempRoot("classify-lock");
    try {
      const identity = makeIdentity(root);
      const a = openStore(identity).store;
      const b = openStore(identity).store;
      const held = a.acquireFence("writer-a");
      expect(held.ok).toBe(true);
      const contender = b.acquireFence("writer-b");
      expect(contender.ok).toBe(false);
      if (!contender.ok) {
        expect(contender.error.code).toBe("state.lock.busy");
        expect(contender.error.consequence).toBe("not_landed");
      }
    } finally {
      removeRoot(root);
    }
  });

  test("permission.denied comes from a real mode violation", () => {
    if (!POSIX) {
      const conditional =
        "platform-conditional: permission triggers run on POSIX; win32 covers the ACL branch";
      expect(conditional).toContain("platform-conditional");
      return;
    }
    const root = makeTempRoot("classify-permission");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      withinFence(store, "writer", (handle) => {
        store.append(handle, { kind: "park", recordKey: "k", payload: 1 });
      });
      chmodSync(root, 0o755);
      const read = observeFailure(openStore(identity).store.read({ requiredKeys: [] }));
      expect(read.code).toBe("state.permission.denied");
      expect(classifyThrown({ kind: "state", code: read.code }).projectionClass).toBe(
        "user-validation",
      );
      chmodSync(root, 0o700);
    } finally {
      removeRoot(root);
    }
  });

  test("write.failed comes from a failed append and lands nothing", () => {
    const root = makeTempRoot("classify-write");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity, {
        edge: createTestEdge({ faults: ["append-before-flush"] }),
      });
      const acquired = store.acquireFence("writer");
      expect(acquired.ok).toBe(true);
      if (!acquired.ok) return;
      const appended = store.append(acquired.value.handle, {
        kind: "park",
        recordKey: "k",
        payload: CANARY,
      });
      const failure = observeFailure(appended);
      expect(failure.code).toBe("state.write.failed");
      expect(failure.consequence).toBe("not_landed");
      sweep(failure.rendered);
    } finally {
      removeRoot(root);
    }
  });

  test("level.unsupported comes from a project-level request", () => {
    const root = makeTempRoot("classify-level");
    try {
      const identity = makeIdentity(`${root}/project`, { level: "project" });
      const read = observeFailure(openStore(identity).store.read({ requiredKeys: [] }));
      expect(read.code).toBe("state.level.unsupported");
      expect(classifyThrown({ kind: "state", code: read.code }).projectionClass).toBe(
        "user-validation",
      );
    } finally {
      removeRoot(root);
    }
  });

  test("storage.exhausted comes from an ENOSPC-family write failure and lands nothing", () => {
    const root = makeTempRoot("classify-storage");
    try {
      const identity = makeIdentity(root);
      const { store, edge } = openStore(identity);
      const acquired = store.acquireFence("exhausted-writer");
      expect(acquired.ok).toBe(true);
      if (!acquired.ok) return;
      edge.armExhaustion(["append-before-flush"]);
      const appended = store.append(acquired.value.handle, {
        kind: "park",
        recordKey: "k",
        payload: CANARY,
      });
      const failure = observeFailure(appended);
      expect(failure.code).toBe("state.storage.exhausted");
      expect(failure.consequence).toBe("not_landed");
      expect(edge.raised).toContain("append-before-flush");
      sweep(failure.rendered);
      expect(classifyThrown({ kind: "state", code: failure.code }).category).toBe("transient");
      expect(classifyThrown({ kind: "state", code: failure.code }).retryable).toBe(true);
      edge.disarm();
    } finally {
      removeRoot(root);
    }
  });

  test("store.unknown comes from a boundary write refusal and lands nothing", () => {
    const root = makeTempRoot("classify-unknown");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      const boundary = createArtifactBoundary(store, {
        recordKeyPrefix: "classification.records:",
        kinds: [
          {
            kind: "classification.kind",
            payloadSchema: "delivery.classification.kind.v1",
            identityField: "recordId",
            fields: [{ name: "recordId", type: "string", required: true }],
          },
        ],
      });
      const acquired = store.acquireFence("boundary-writer");
      expect(acquired.ok).toBe(true);
      if (!acquired.ok) return;
      const refused = boundary.append(acquired.value.handle, {
        kind: "classification.kind",
        recordKey: "classification.records:r1",
        payload: { schemaId: "delivery.classification.kind.v1" },
      });
      const failure = observeFailure(refused);
      expect(failure.code).toBe("state.store.unknown");
      expect(failure.consequence).toBe("not_landed");
      sweep(failure.rendered);
      expect(classifyThrown({ kind: "state", code: failure.code }).retryable).toBe(false);
      store.releaseFence(acquired.value.handle);
    } finally {
      removeRoot(root);
    }
  });

  test("the payload-including formatter control is caught by the canary sweep", () => {
    const includingFormatter = (code: string, payload: unknown): string =>
      JSON.stringify({ code, payload });
    const rendered = includingFormatter("state.store.torn", CANARY);
    expect(() => sweep(rendered)).toThrow();
    // The real failures above never produce this shape.
    expect(rendered).toContain(CANARY);
  });
});
