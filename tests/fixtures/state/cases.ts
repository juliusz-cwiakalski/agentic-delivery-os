/**
 * Conformance case registry (GH-174 D7, test-plan §4.1).
 *
 * Cases are data: one definition, executed against every kind in the current
 * driver map. No case branches on a driver kind; kind-neutral observables are
 * compared by the suite.
 */
import { readFileSync, writeFileSync } from "node:fs";
import type { StateStorePort } from "../../packages/core/src/contracts/index";
import type { TestEdge } from "./harness";

export type CaseContext = {
  readonly store: StateStorePort;
  readonly edge: TestEdge;
  readonly root: string;
  readonly workspaceId: string;
  readonly ledgerPath: string;
};

export type CaseOutcome = {
  readonly ok: boolean;
  readonly values?: Readonly<Record<string, unknown>>;
  readonly code?: string;
  readonly verifiedEmpty?: boolean;
  readonly recordCount?: number;
};

export type ConformanceCase = {
  readonly id: string;
  readonly seed?: (context: CaseContext) => void;
  readonly observe: (context: CaseContext) => CaseOutcome;
};

const withFence = (
  context: CaseContext,
  body: (handle: Parameters<StateStorePort["append"]>[0]) => void,
): void => {
  const acquired = context.store.acquireFence("conformance-writer");
  if (!acquired.ok) throw new Error(`acquire failed: ${acquired.error.code}`);
  try {
    body(acquired.value.handle);
  } finally {
    context.store.releaseFence(acquired.value.handle);
  }
};

const mutateLine = (
  context: CaseContext,
  index: number,
  mutate: (record: Record<string, unknown>) => void,
): void => {
  const lines = readFileSync(context.ledgerPath, "utf8").split("\n");
  const record = JSON.parse(lines[index] as string) as Record<string, unknown>;
  mutate(record);
  lines[index] = JSON.stringify(record);
  writeFileSync(context.ledgerPath, lines.join("\n"));
};

const seedThreeRecords = (context: CaseContext): void => {
  withFence(context, (handle) => {
    for (const [key, payload] of [
      ["t1", "planted-payload-one"],
      ["t2", "planted-payload-two"],
      ["t3", "planted-payload-three"],
    ] as const) {
      context.store.append(handle, { kind: "park", recordKey: key, payload });
    }
  });
};

const readOutcome = (context: CaseContext, requiredKeys: readonly string[]): CaseOutcome => {
  const read = context.store.read({ requiredKeys });
  if (!read.ok) return { ok: false, code: read.error.code };
  return {
    ok: true,
    values: read.value.values,
    verifiedEmpty: read.value.evidence.verifiedEmpty,
    recordCount: read.value.evidence.recordCount,
  };
};

export const CONFORMANCE_CASES: readonly ConformanceCase[] = [
  {
    id: "open-empty-store",
    observe: (context) => readOutcome(context, []),
  },
  {
    id: "append-and-read",
    seed: (context) =>
      withFence(context, (handle) => {
        context.store.append(handle, { kind: "park", recordKey: "k1", payload: "value-1" });
        context.store.append(handle, { kind: "park", recordKey: "k2", payload: 2 });
      }),
    observe: (context) => readOutcome(context, ["k1", "k2"]),
  },
  {
    id: "key-set-pass",
    seed: (context) =>
      withFence(context, (handle) => {
        context.store.append(handle, { kind: "park", recordKey: "present", payload: 0 });
      }),
    observe: (context) => readOutcome(context, ["present"]),
  },
  {
    id: "key-set-fail",
    seed: (context) =>
      withFence(context, (handle) => {
        context.store.append(handle, { kind: "park", recordKey: "present", payload: 0 });
      }),
    observe: (context) => readOutcome(context, ["absent"]),
  },
  {
    id: "torn-truncated-tail",
    seed: (context) => {
      seedThreeRecords(context);
      const text = readFileSync(context.ledgerPath, "utf8");
      writeFileSync(context.ledgerPath, text.slice(0, -4));
    },
    observe: (context) => readOutcome(context, ["t1"]),
  },
  {
    id: "torn-framing-break",
    seed: (context) => {
      seedThreeRecords(context);
      const lines = readFileSync(context.ledgerPath, "utf8").split("\n");
      lines[1] = "{this-is-not-framed";
      writeFileSync(context.ledgerPath, lines.join("\n"));
    },
    observe: (context) => readOutcome(context, ["t1"]),
  },
  {
    id: "torn-sequence-gap",
    seed: (context) => {
      seedThreeRecords(context);
      mutateLine(context, 2, (record) => {
        record.sequence = Number(record.sequence) + 2;
      });
    },
    observe: (context) => readOutcome(context, ["t1"]),
  },
  {
    id: "torn-checksum-mismatch",
    seed: (context) => {
      seedThreeRecords(context);
      mutateLine(context, 1, (record) => {
        record.payload = "planted-payload-flipped";
      });
    },
    observe: (context) => readOutcome(context, ["t1"]),
  },
  {
    id: "value-depends-on-input",
    seed: (context) =>
      withFence(context, (handle) => {
        context.store.append(handle, { kind: "park", recordKey: "marker", payload: { n: 41 } });
      }),
    observe: (context) => readOutcome(context, ["marker"]),
  },
];
