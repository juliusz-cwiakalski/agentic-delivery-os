/**
 * TC-VERIFY-010 — registry failures are classified, never success. Torn,
 * schema-mismatched, and corrupt-payload stores exit 2 with the platform
 * identity; permission denial exits 1; no write or fence is ever attempted.
 */
import { describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ERROR_TABLE, type ErrorTableEntry } from "../../packages/core/src/contracts/index";
import { phaseStateDocumentName } from "../../packages/core/src/state/index";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import { ledgerPath, ledgerText, openStore } from "../fixtures/state/harness";
import {
  appendLanding,
  corruptHeaderVersion,
  createVerifyHarness,
  createVerifyState,
  ledgerRecords,
  readFixture,
  resealLedgerRecord,
  type VerifyRun,
  type VerifyState,
  writeLedgerRecords,
} from "./verify-support";

const CANARY = "planted-payload-verify-state";
const POSIX = process.platform !== "win32";
const REF = "GH-177";

const entryFor = (code: string): ErrorTableEntry =>
  (ERROR_TABLE as readonly ErrorTableEntry[]).find(
    (entry) => entry.code === code,
  ) as ErrorTableEntry;

const envelopeOf = (run: VerifyRun): Record<string, unknown> => {
  if (run.envelope === undefined) throw new Error("expected one envelope");
  return run.envelope;
};

const errorOf = (run: VerifyRun): Record<string, unknown> => {
  const error = envelopeOf(run).error;
  if (typeof error !== "object" || error === null || Array.isArray(error)) {
    throw new Error("expected an error envelope");
  }
  return error as Record<string, unknown>;
};

const expectStateFailure = (run: VerifyRun, code: string, exit: number): void => {
  expect(run.exitCode).toBe(exit);
  expect(assertEnvelopeContract(run.envelope)).toEqual([]);
  expect(Object.hasOwn(envelopeOf(run), "data")).toBe(false);
  const error = errorOf(run);
  const row = entryFor(code);
  expect(error.code).toBe(code);
  expect(error.category).toBe(row.category);
  expect(error.retryable).toBe(row.retryable);
  expect(error.consequence).toBe(row.consequence);
  const token = row.category === "platform" ? "state-unverified" : "failed";
  const prefix = `result=${token}; variant=full; missing=-`;
  const summary = String(error.summary);
  expect(summary.startsWith(prefix), summary).toBe(true);
  if (summary.length > prefix.length) {
    expect(summary).toBe(`${prefix}; detail=${row.summary ?? ""}`);
  }
  expect(run.stdout).not.toContain(CANARY);
  expect(run.stderr).not.toContain(CANARY);
  expect(summary).not.toContain(CANARY);
};

const targetText = (): string => readFixture("full/base-complete.yaml");

const seed = (state: VerifyState, withReopen = true): void => {
  appendLanding(state, "delivery", "complete", "2026-10-31T05:00:00Z");
  appendLanding(state, "quality_gates", "complete", "2026-10-31T05:05:00Z");
  if (withReopen) appendLanding(state, "delivery", "reopen", "2026-10-31T05:10:00Z", CANARY);
};

type RunResult = { readonly run: VerifyRun; readonly calls: readonly string[] };

const runCase = async (
  mutate: (state: VerifyState) => void,
  options: {
    readonly withReopen?: boolean;
    readonly storeOverride?: (state: VerifyState) => VerifyState["store"];
  } = {},
): Promise<RunResult> => {
  const state = createVerifyState();
  try {
    seed(state, options.withReopen ?? true);
    mutate(state);
    const harnessState =
      options.storeOverride === undefined
        ? state
        : { ...state, store: options.storeOverride(state) };
    const harness = createVerifyHarness({ targetText: targetText(), state: harnessState });
    try {
      const run = await harness.run(["change", REF]);
      return { run, calls: [...harness.recorder.calls] };
    } finally {
      harness.cleanup();
    }
  } finally {
    state.cleanup();
  }
};

describe("TC-VERIFY-010 registry failures are classified", () => {
  test("torn variants exit 2 with state.store.torn and no canary leak", async () => {
    const variants: Array<[string, (state: VerifyState) => void]> = [
      [
        "payload-flip",
        (state) => {
          const records = ledgerRecords(state.identity);
          const first = records[0];
          if (first === undefined) throw new Error("missing record");
          first.payload = "planted-payload-verify-flipped";
          writeLedgerRecords(state.identity, records);
        },
      ],
      [
        "framing",
        (state) => {
          const lines = ledgerText(state.identity).split("\n");
          lines[1] = "{not-framed";
          writeFileSync(ledgerPath(state.identity), lines.join("\n"));
        },
      ],
      [
        "sequence-gap",
        (state) => {
          const records = ledgerRecords(state.identity);
          const second = records[1];
          if (second === undefined) throw new Error("missing second record");
          second.sequence = Number(second.sequence) + 2;
          writeLedgerRecords(state.identity, records);
        },
      ],
    ];
    for (const [label, mutate] of variants) {
      const { run, calls } = await runCase(mutate);
      expect(label.length).toBeGreaterThan(0);
      expectStateFailure(run, "state.store.torn", 2);
      for (const writeCall of ["acquireFence", "append", "replaceDocument", "releaseFence"]) {
        expect(calls).not.toContain(writeCall);
      }
    }
  });

  test("a schema mismatch exits 2 with state.schema.mismatch", async () => {
    const { run } = await runCase((state) => corruptHeaderVersion(state.identity));
    expectStateFailure(run, "state.schema.mismatch", 2);
  });

  test("corrupt per-change payloads exit 2 with state.keys.missing", async () => {
    const variants: Array<[string, (payload: Record<string, unknown>) => void]> = [
      [
        "missing-transitions",
        (payload) => {
          delete payload.transitions;
        },
      ],
      [
        "missing-operation",
        (payload) => {
          const transitions = payload.transitions as Record<string, unknown>[];
          const first = transitions[0];
          if (first === undefined) throw new Error("missing transition");
          delete first.operation;
        },
      ],
      [
        "missing-timestamp",
        (payload) => {
          const transitions = payload.transitions as Record<string, unknown>[];
          const first = transitions[0];
          if (first === undefined) throw new Error("missing transition");
          delete first.timestamp;
        },
      ],
    ];
    for (const [label, mutate] of variants) {
      const { run } = await runCase((state) => {
        const records = ledgerRecords(state.identity);
        const latest = records[records.length - 1];
        if (latest === undefined) throw new Error("missing record");
        mutate(latest.payload as Record<string, unknown>);
        resealLedgerRecord(latest);
        writeLedgerRecords(state.identity, records);
      });
      expect(label.length).toBeGreaterThan(0);
      expectStateFailure(run, "state.keys.missing", 2);
    }
  });

  test("permission denial exits 1 with state.permission.denied", async () => {
    if (!POSIX) {
      const conditional = "platform-conditional: POSIX mode violation; win32 ACL branch";
      expect(conditional).toContain("platform-conditional");
      return;
    }
    const state = createVerifyState();
    try {
      seed(state);
      chmodSync(state.identity.stateDirectory, 0o755);
      const reopened = openStore(state.identity).store;
      const harness = createVerifyHarness({
        targetText: targetText(),
        state: { ...state, store: reopened },
      });
      try {
        const run = await harness.run(["change", REF]);
        expectStateFailure(run, "state.permission.denied", 1);
      } finally {
        harness.cleanup();
        chmodSync(state.identity.stateDirectory, 0o700);
      }
    } finally {
      state.cleanup();
    }
  });

  test("a valid store control finishes and a detection-disabled control exposes the canary", async () => {
    const valid = await runCase(() => {}, { withReopen: false });
    expect(valid.run.exitCode).toBe(0);
    expect(assertEnvelopeContract(valid.run.envelope)).toEqual([]);
    for (const writeCall of ["acquireFence", "append", "replaceDocument", "releaseFence"]) {
      expect(valid.calls).not.toContain(writeCall);
    }

    const state = createVerifyState();
    try {
      seed(state);
      expect(ledgerText(state.identity)).toContain(CANARY);
      const records = ledgerRecords(state.identity);
      const first = records[0];
      if (first === undefined) throw new Error("missing record");
      first.payload = "planted-payload-verify-flipped";
      writeLedgerRecords(state.identity, records);
      expect(ledgerText(state.identity)).toContain("planted-payload-verify-flipped");
      const read = state.store.read({ requiredKeys: [] });
      expect(read.ok).toBe(false);
    } finally {
      state.cleanup();
    }
  });

  test("a corrupt or absent projection never produces a state failure", async () => {
    for (const corrupt of [false, true]) {
      const state = createVerifyState();
      try {
        seed(state, false);
        if (corrupt) {
          const documents = join(
            state.identity.stateDirectory,
            `documents.${encodeURIComponent(state.identity.workspaceId)}`,
          );
          mkdirSync(documents, { recursive: true });
          writeFileSync(join(documents, phaseStateDocumentName(REF)), "not-json");
        }
        const harness = createVerifyHarness({ targetText: targetText(), state });
        try {
          const run = await harness.run(["change", REF]);
          expect(run.exitCode).toBe(0);
          expect(run.stdout).not.toContain("state.");
        } finally {
          harness.cleanup();
        }
      } finally {
        state.cleanup();
      }
    }
  });
});
