/**
 * The in-process `dispatch attempts` harness (GH-289 §6).
 *
 * One isolated state root under the repository-local approved base, a store
 * wrapper that exposes read/append/fence counters and accepts no root, key, or
 * path of its own, a fixed repository resolver, and an active-reference source
 * that exercises the delivered local PM context seam in its four states.
 * Fixtures are never named `*.test.ts`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { nodeFileSystemFacts } from "../../../packages/adapters/src/file/config-source";
import { readLocalPmContext } from "../../../packages/adapters/src/file/pm-context";
import {
  readDispatchAttemptHistory,
  type DispatchAttemptsReadInput,
} from "../../../packages/core/src/app/dispatch-attempts";
import {
  appendDispatchAttempt,
  readDispatchAttempts,
} from "../../../packages/core/src/app/dispatch-ledger";
import type {
  DispatchAttemptRecord,
  StateRecord,
  StateStorePort,
} from "../../../packages/core/src/contracts/index";
import { APPROVED_BASE, guardStateFixtureRoot } from "../projects/state-scope";
import { makeIdentity, openStore } from "../state/harness";
import { ATTEMPTS_REF, ledgerOf } from "./attempt-records";

/** The four local-context states the omitted `--ref` case must distinguish. */
export type ActiveChangeState = "absent" | "unparsable" | "no-active-change" | "present";

export type AttemptsHarnessOptions = {
  readonly label?: string;
  /** The repository the fixed resolver returns; `undefined` makes it unresolvable. */
  readonly repository?: string | undefined;
  readonly activeChange?: ActiveChangeState;
  readonly activeRef?: string;
  /** Records appended through the delivered ledger helper before the read. */
  readonly records?: readonly DispatchAttemptRecord[];
  /** A store wrapper around the counted store (faults, explicit ledger views). */
  readonly wrap?: (store: StateStorePort) => StateStorePort;
};

export type AttemptsHarness = {
  readonly root: string;
  readonly checkout: string;
  readonly contextPath: string;
  readonly store: StateStorePort;
  readonly counters: StoreCounters;
  readonly read: (
    input?: DispatchAttemptsReadInput,
  ) => ReturnType<typeof readDispatchAttemptHistory>;
  /** The seeded records as the delivered reader returns them. */
  readonly records: () => readonly DispatchAttemptRecord[];
  readonly dispose: () => void;
};

/** The observable port counters; the wrapper accepts no state-supplying input. */
export type StoreCounters = {
  readonly readRecords: number;
  readonly append: number;
  readonly acquireFence: number;
  readonly replaceDocument: number;
};

const countersOf = (): { -readonly [K in keyof StoreCounters]: number } => ({
  readRecords: 0,
  append: 0,
  acquireFence: 0,
  replaceDocument: 0,
});

/**
 * Wrap a store so every port call is counted. The wrapper supplies no root,
 * key, or path: it cannot become a second way to inject state.
 */
export const countStore = (
  store: StateStorePort,
): { readonly store: StateStorePort; readonly counters: StoreCounters } => {
  const counters = countersOf();
  const wrapped: StateStorePort = {
    ...store,
    readRecords: () => {
      counters.readRecords += 1;
      return store.readRecords();
    },
    append: (handle, request) => {
      counters.append += 1;
      return store.append(handle, request);
    },
    acquireFence: (token) => {
      counters.acquireFence += 1;
      return store.acquireFence(token);
    },
    replaceDocument: (handle, request) => {
      counters.replaceDocument += 1;
      return store.replaceDocument(handle, request);
    },
  };
  return { store: wrapped, counters };
};

/**
 * Replace a store's ledger view with an explicitly supplied record set while
 * keeping every other port call real. The delivered reader still validates each
 * payload on the way in, so the seam cannot bypass validation.
 */
export const storeWithRecords = (
  store: StateStorePort,
  records: readonly StateRecord[],
): StateStorePort => ({
  ...store,
  readRecords: () => ({
    ok: true,
    value: {
      records,
      evidence: {
        storePath: join(store.identity.stateDirectory, "ledger.jsonl"),
        verification: ["framing", "terminal", "sequence", "checksum"],
        verifiedEmpty: records.length === 0,
        recordCount: records.length,
      },
    },
  }),
});

/** Build one ledger record for the explicit-view seam. */
export const attemptLedgerRecord = (
  attempt: DispatchAttemptRecord,
  sequence: number,
): StateRecord => ({
  schemaVersion: "delivery.state.v1",
  kind: "dispatch.attempt",
  key: `dispatch.attempt.${attempt.attemptId}`,
  sequence,
  checksum: "fixture",
  payload: attempt as unknown as StateRecord["payload"],
});

const writeContext = (checkout: string, state: ActiveChangeState, ref: string): string => {
  const contextPath = join(checkout, ".ai", "local", "pm-context.yaml");
  mkdirSync(join(checkout, ".ai", "local"), { recursive: true });
  if (state === "absent") return contextPath;
  const body =
    state === "unparsable"
      ? "active_change: [unterminated\n"
      : state === "no-active-change"
        ? "parked_changes: []\n"
        : `active_change:\n  workItemRef: ${ref}\n  branch: feat/${ref}/fixture\nparked_changes: []\n`;
  writeFileSync(contextPath, body);
  return contextPath;
};

export const createAttemptsHarness = (options: AttemptsHarnessOptions = {}): AttemptsHarness => {
  const label = options.label ?? "attempts";
  mkdirSync(APPROVED_BASE, { recursive: true });
  const root = mkdtempSync(join(APPROVED_BASE, `gh289-${label}-`));
  guardStateFixtureRoot(root);
  const checkout = join(root, "checkout");
  mkdirSync(checkout, { recursive: true });
  const contextPath = writeContext(
    checkout,
    options.activeChange ?? "present",
    options.activeRef ?? ATTEMPTS_REF,
  );

  const { store: base } = openStore(
    makeIdentity(join(root, "state"), { workspaceId: `ws-${label}` }),
  );
  for (const record of options.records ?? ledgerOf(3)) {
    const appended = appendDispatchAttempt(base, "seed-fence", record);
    if (!appended.ok) throw new Error(`attempt seeding failed: ${appended.code}`);
  }
  const { store: counted, counters } = countStore(base);
  const store = options.wrap === undefined ? counted : options.wrap(counted);
  const repository = "repository" in options ? options.repository : "github.com/owner/repo";
  const fs = nodeFileSystemFacts();
  const read = (input: DispatchAttemptsReadInput = {}) =>
    readDispatchAttemptHistory(
      {
        store,
        resolveRepository: () => repository,
        resolveActiveRef: () => {
          const context = readLocalPmContext({ path: contextPath, fs });
          return context.ok ? (context.context.activeChange?.workItemRef ?? null) : null;
        },
        contextPath,
      },
      input,
    );
  return {
    root,
    checkout,
    contextPath,
    store,
    counters,
    read,
    records: () => {
      const readRecords = readDispatchAttempts(base);
      return readRecords.ok ? readRecords.records : [];
    },
    dispose: () => rmSync(root, { recursive: true, force: true }),
  };
};
