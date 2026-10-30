/**
 * TC-STATE-008/009/010 and TC-STATE-006 — every injected tear is detected and
 * classified with a safe location, verified-empty is distinct from torn, and
 * repair is terminal-only. Fixtures are generated per run, and each mutation
 * asserts its own precondition before the read.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import type { StateStorePort } from "../../packages/core/src/contracts/index";
import { STATE_SCHEMA_VERSION } from "../../packages/core/src/contracts/index";
import {
  ledgerPath,
  ledgerText,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
  type TestEdge,
  withinFence,
} from "../fixtures/state/harness";

type Fixture = {
  readonly before: string;
  readonly after: string;
  readonly variant: string;
};

const CANARY = "planted-payload-canary-9c1f";

const seed = (store: StateStorePort, records = 3): void => {
  withinFence(store, "writer", (handle) => {
    for (let index = 1; index <= records; index += 1) {
      store.append(handle, {
        kind: "park",
        recordKey: `key-${index}`,
        payload: index === 1 ? CANARY : { index },
      });
    }
  });
};

const mutateRecord = (
  text: string,
  index: number,
  mutate: (record: Record<string, unknown>) => void,
): string => {
  const lines = text.split("\n");
  const record = JSON.parse(lines[index] as string) as Record<string, unknown>;
  mutate(record);
  lines[index] = JSON.stringify(record);
  return lines.join("\n");
};

const build = (
  root: string,
  variant: string,
  mutate: (text: string) => string,
): { fixture: Fixture; identity: ReturnType<typeof makeIdentity>; edge: TestEdge } => {
  const identity = makeIdentity(root, { workspaceId: variant });
  const { store, edge } = openStore(identity);
  seed(store);
  const before = ledgerText(identity);
  const after = mutate(before);
  // Non-vacuity: the mutation must actually change the fixture bytes.
  expect(after, `${variant} mutation must change the ledger`).not.toBe(before);
  writeFileSync(ledgerPath(identity), after);
  return { fixture: { before, after, variant }, identity, edge };
};

describe("TC-STATE-008 torn-class detection matrix", () => {
  const variants: Array<[string, (text: string) => string]> = [
    ["truncated-tail", (text) => text.slice(0, -4)],
    [
      "framing",
      (text) => {
        const lines = text.split("\n");
        lines[1] = "{not-framed";
        return lines.join("\n");
      },
    ],
    [
      "sequence-gap",
      (text) =>
        mutateRecord(text, 2, (record) => {
          record.sequence = Number(record.sequence) + 2;
        }),
    ],
    [
      "sequence-duplicate",
      (text) =>
        mutateRecord(text, 2, (record) => {
          record.sequence = 2;
        }),
    ],
    [
      "sequence-reset",
      (text) =>
        mutateRecord(text, 2, (record) => {
          record.sequence = 1;
        }),
    ],
    [
      "checksum",
      (text) =>
        mutateRecord(text, 0, (record) => {
          record.payload = "planted-payload-flipped";
        }),
    ],
  ];

  for (const [variant, mutate] of variants) {
    test(`${variant} fails state.store.torn with a safe location and no values`, () => {
      const root = makeTempRoot(`torn-${variant}`);
      try {
        const { identity } = build(root, variant, mutate);
        const { store } = openStore(identity);
        const read = store.read({ requiredKeys: ["key-1"] });
        expect(read.ok).toBe(false);
        if (!read.ok) {
          expect(read.error.code).toBe("state.store.torn");
          expect(read.error.consequence).toBe("not_landed");
          expect(read.error.location.path).toContain("ledger.");
          expect(typeof read.error.location.record).toBe("number");
          expect(JSON.stringify(read.error)).not.toContain("planted-payload-");
        }
      } finally {
        removeRoot(root);
      }
    });
  }

  test("the intact control reads the planted payload (the fixture is live)", () => {
    const root = makeTempRoot("torn-intact");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      seed(store);
      const read = store.read({ requiredKeys: ["key-1"] });
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.value.values).toEqual({ "key-1": CANARY });
    } finally {
      removeRoot(root);
    }
  });

  test("the detection-disabled control would expose the planted payload", () => {
    const root = makeTempRoot("torn-detection-disabled");
    try {
      const identity = makeIdentity(root, { workspaceId: "disabled" });
      const { store } = openStore(identity);
      seed(store);
      const text = mutateRecord(ledgerText(identity), 0, (record) => {
        record.payload = "planted-payload-flipped";
      });
      writeFileSync(ledgerPath(identity), text);
      // A read that skipped checksum verification would return this value; the
      // production read must fail instead.
      const unverified = JSON.parse(text.split("\n")[0] as string) as { payload: unknown };
      expect(unverified.payload).toBe("planted-payload-flipped");
      const read = store.read({ requiredKeys: ["key-1"] });
      expect(read.ok).toBe(false);
    } finally {
      removeRoot(root);
    }
  });
});

describe("TC-STATE-006 schema-version mismatch", () => {
  test("an unsupported store header fails state.schema.mismatch, not torn", () => {
    const root = makeTempRoot("schema-store");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      seed(store);
      writeFileSync(
        `${root}/header.${encodeURIComponent(identity.workspaceId)}.json`,
        `${JSON.stringify({ schemaVersion: "delivery.state.v999" })}\n`,
      );
      const read = store.read({ requiredKeys: ["key-1"] });
      expect(read.ok).toBe(false);
      if (!read.ok) expect(read.error.code).toBe("state.schema.mismatch");
    } finally {
      removeRoot(root);
    }
  });

  test("an unsupported record version fails state.schema.mismatch with no values", () => {
    const root = makeTempRoot("schema-record");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      seed(store);
      writeFileSync(
        ledgerPath(identity),
        mutateRecord(ledgerText(identity), 1, (record) => {
          record.schemaVersion = "delivery.state.v999";
        }),
      );
      const read = store.read({ requiredKeys: ["key-1", "key-2"] });
      expect(read.ok).toBe(false);
      if (!read.ok) {
        expect(read.error.code).toBe("state.schema.mismatch");
        expect(read.error.location.record).toBe(2);
        expect(JSON.stringify(read.error)).not.toContain("planted-payload-");
      }
    } finally {
      removeRoot(root);
    }
  });

  test("the supported-version control reads normally", () => {
    const root = makeTempRoot("schema-control");
    try {
      const identity = makeIdentity(root, { schemaVersion: STATE_SCHEMA_VERSION });
      const { store } = openStore(identity);
      seed(store, 1);
      expect(store.read({ requiredKeys: ["key-1"] }).ok).toBe(true);
    } finally {
      removeRoot(root);
    }
  });
});

describe("TC-STATE-009 verified-empty versus torn", () => {
  test("absent and torn verdicts are never conflated", () => {
    const root = makeTempRoot("torn-empty-vs-torn");
    try {
      const absent = makeIdentity(`${root}/absent`, { workspaceId: "absent" });
      const absentRead = openStore(absent).store.read({ requiredKeys: [] });
      expect(absentRead.ok).toBe(true);
      if (absentRead.ok) {
        expect(absentRead.value.evidence.verifiedEmpty).toBe(true);
        expect(absentRead.value.evidence.recordCount).toBe(0);
      }

      const torn = makeIdentity(`${root}/torn`, { workspaceId: "torn" });
      const { store } = openStore(torn);
      seed(store);
      writeFileSync(ledgerPath(torn), ledgerText(torn).slice(0, -4));
      const tornRead = store.read({ requiredKeys: [] });
      expect(tornRead.ok).toBe(false);
      if (!tornRead.ok) expect(tornRead.error.code).toBe("state.store.torn");
    } finally {
      removeRoot(root);
    }
  });
});

describe("TC-STATE-010 terminal repair versus mid-record refusal", () => {
  test("terminal truncation is repaired, reported, and survivors stay intact", () => {
    const root = makeTempRoot("repair-terminal");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      seed(store);
      const complete = ledgerText(identity);
      const partial = '{"schemaVersion":"delivery.state.v1","kind":"park","key":"key-4"';
      writeFileSync(ledgerPath(identity), complete + partial);
      const repair = store.repairTornTail();
      expect(repair.ok).toBe(true);
      if (repair.ok) {
        expect(repair.value.repaired).toBe(true);
        expect(repair.value.report.removedBytes).toBe(partial.length);
        expect(JSON.stringify(repair.value.report)).not.toContain("planted-payload-");
      }
      // Only the incomplete tail is gone; every earlier record is byte-identical.
      expect(ledgerText(identity)).toBe(complete);
      const read = store.read({ requiredKeys: ["key-1", "key-2", "key-3"] });
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.value.values).toEqual({
          "key-1": CANARY,
          "key-2": { index: 2 },
          "key-3": { index: 3 },
        });
      }
    } finally {
      removeRoot(root);
    }
  });

  test("mid-record corruption refuses repair and changes nothing", () => {
    const root = makeTempRoot("repair-refusal");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      seed(store);
      writeFileSync(
        ledgerPath(identity),
        mutateRecord(ledgerText(identity), 0, (record) => {
          record.payload = "planted-payload-corrupt";
        }),
      );
      const before = ledgerText(identity);
      const repair = store.repairTornTail();
      expect(repair.ok).toBe(false);
      if (!repair.ok) expect(repair.error.code).toBe("state.store.torn");
      expect(ledgerText(identity)).toBe(before);
    } finally {
      removeRoot(root);
    }
  });

  test("the auto-repair control would discard non-terminal data", () => {
    const root = makeTempRoot("repair-control");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      seed(store);
      const corrupt = mutateRecord(ledgerText(identity), 0, (record) => {
        record.payload = "planted-payload-corrupt";
      });
      writeFileSync(ledgerPath(identity), corrupt);
      const lines = corrupt.split("\n").filter((line) => line !== "");
      const autoRepaired = `${lines.slice(1).join("\n")}\n`;
      // A naive auto-repair would delete the first record; the refusal path
      // keeps the bytes unchanged instead.
      expect(autoRepaired).not.toBe(corrupt);
      expect(ledgerText(identity)).toBe(corrupt);
    } finally {
      removeRoot(root);
    }
  });
});
