/**
 * TC-VERIFY-012..015 — the exhaustive envelope/exit matrix, the summary grammar,
 * the read-only/network-free proof, and replay determinism. Every fixture is
 * generated per run or read from a committed fixture read-only.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import { nodePmNotesFileSystemFacts } from "../../packages/adapters/src/file";
import { createPhaseCommandDefinition } from "../../packages/cli/src/commands/phase";
import { createPhaseCommandRuntime } from "../../packages/cli/src/edge";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import { projectExitCode } from "../../packages/cli/src/projection";
import { ERROR_TABLE, type ErrorTableEntry } from "../../packages/core/src/contracts/index";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import { openStore } from "../fixtures/state/harness";
import { bufferSink, SYNTHETIC_BRAND } from "../golden/helpers";
import {
  appendLanding,
  corruptHeaderVersion,
  createVerifyHarness,
  createVerifyRecorder,
  createVerifyState,
  fullBase,
  guardStore,
  ledgerRecords,
  liteCompleteAbsent,
  materializeTarget,
  partialB,
  resealLedgerRecord,
  type VerifyHarness,
  type VerifyRun,
  type VerifyState,
  withCompletedPhase,
  withOpenPhase,
  writeLedgerRecords,
} from "./verify-support";

const CANARY = "planted-payload-verify-";
const REF = "GH-177";
const POSIX = process.platform !== "win32";
const MALFORMED_ROOT = "tests/fixtures/verify/malformed";

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

const dataOf = (run: VerifyRun): Record<string, unknown> => {
  const data = envelopeOf(run).data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("expected success data");
  }
  return data as Record<string, unknown>;
};

type HarnessFactory = { readonly harness: VerifyHarness; readonly cleanup: () => void };

const factoryFor = (
  document: unknown,
  options: { readonly stateFailure?: "torn" | "schema" | "keys" } = {},
): HarnessFactory => {
  if (options.stateFailure !== undefined) {
    const state = buildStateFailure(options.stateFailure);
    const harness = createVerifyHarness({ targetText: stringify(document), state });
    return {
      harness,
      cleanup: () => {
        harness.cleanup();
        state.cleanup();
      },
    };
  }
  const state = createVerifyState();
  const harness = createVerifyHarness({ targetText: stringify(document), state });
  return {
    harness,
    cleanup: () => {
      harness.cleanup();
      state.cleanup();
    },
  };
};

const factoryForMalformed = (caseName: string): HarnessFactory => {
  const state = createVerifyState();
  const harness = createVerifyHarness({
    changesDirectory: join(MALFORMED_ROOT, caseName),
    state,
  });
  return {
    harness,
    cleanup: () => {
      harness.cleanup();
      state.cleanup();
    },
  };
};

const factoryForMissingTarget = (): HarnessFactory => {
  const state = createVerifyState();
  const harness = createVerifyHarness({ omitTarget: true, state });
  return {
    harness,
    cleanup: () => {
      harness.cleanup();
      state.cleanup();
    },
  };
};

const runFactory = async (
  factory: HarnessFactory,
  args: readonly string[] = ["change", REF],
): Promise<VerifyRun> => {
  try {
    return await factory.harness.run(args);
  } finally {
    factory.cleanup();
  }
};

const runDoc = async (
  document: unknown,
  args: readonly string[] = ["change", REF],
  options: { readonly stateFailure?: "torn" | "schema" | "keys" } = {},
): Promise<VerifyRun> => runFactory(factoryFor(document, options), args);

const runMalformed = async (caseName: string): Promise<VerifyRun> =>
  runFactory(factoryForMalformed(caseName));

const runMissingTarget = async (): Promise<VerifyRun> => runFactory(factoryForMissingTarget());

const runGrammar = async (args: readonly string[]): Promise<VerifyRun> =>
  runFactory(factoryFor(fullBase()), args);

const corruptLedger = (
  state: VerifyState,
  mutate: (records: Record<string, unknown>[]) => void,
): void => {
  const records = ledgerRecords(state.identity);
  mutate(records);
  writeLedgerRecords(state.identity, records);
};

const buildStateFailure = (kind: "torn" | "schema" | "keys"): VerifyState => {
  const state = createVerifyState();
  appendLanding(state, "delivery", "complete", "2026-10-31T05:00:00Z");
  appendLanding(state, "quality_gates", "complete", "2026-10-31T05:05:00Z");
  if (kind === "torn") {
    corruptLedger(state, (records) => {
      const first = records[0];
      if (first === undefined) throw new Error("missing record");
      first.payload = "planted-payload-verify-flipped";
    });
  }
  if (kind === "schema") corruptHeaderVersion(state.identity);
  if (kind === "keys") {
    corruptLedger(state, (records) => {
      const latest = records[records.length - 1];
      if (latest === undefined) throw new Error("missing record");
      delete (latest.payload as Record<string, unknown>).transitions;
      resealLedgerRecord(latest);
    });
  }
  return state;
};

const runPermissionFailure = async (
  args: readonly string[] = ["change", REF],
): Promise<VerifyRun> => {
  const state = createVerifyState();
  try {
    appendLanding(state, "delivery", "complete", "2026-10-31T05:00:00Z");
    chmodSync(state.identity.stateDirectory, 0o755);
    const reopened = openStore(state.identity).store;
    const harness = createVerifyHarness({
      targetText: stringify(fullBase()),
      state: { ...state, store: reopened },
    });
    try {
      return await harness.run(args);
    } finally {
      harness.cleanup();
      chmodSync(state.identity.stateDirectory, 0o700);
    }
  } finally {
    state.cleanup();
  }
};

const factoryForPermission = (): HarnessFactory => {
  const state = createVerifyState();
  appendLanding(state, "delivery", "complete", "2026-10-31T05:00:00Z");
  chmodSync(state.identity.stateDirectory, 0o755);
  const reopened = openStore(state.identity).store;
  const harness = createVerifyHarness({
    targetText: stringify(fullBase()),
    state: { ...state, store: reopened },
  });
  return {
    harness,
    cleanup: () => {
      harness.cleanup();
      chmodSync(state.identity.stateDirectory, 0o700);
      state.cleanup();
    },
  };
};

const threeMissing = (): Record<string, unknown> => {
  const document = JSON.parse(JSON.stringify(fullBase())) as Record<string, unknown>;
  const phases = document.phases as Record<string, Record<string, unknown>>;
  for (const phaseId of ["test_planning", "delivery_planning", "dor_check"]) {
    const phase = phases[phaseId];
    if (phase === undefined) throw new Error(`missing phase ${phaseId}`);
    phase.completed = null;
  }
  return document;
};

type Cell = {
  readonly id: string;
  readonly code?: string;
  readonly exit: number;
  readonly token: string;
  readonly variant: string;
  readonly missing: string;
  readonly detail: "absent" | "optional" | "row-summary" | "exempt";
  readonly run: () => Promise<VerifyRun>;
};

const cells = (): Cell[] => {
  const list: Cell[] = [
    {
      id: "finished-full",
      exit: 0,
      token: "finished",
      variant: "full",
      missing: "-",
      detail: "exempt",
      run: () => runDoc(fullBase()),
    },
    {
      id: "finished-lite",
      exit: 0,
      token: "finished",
      variant: "lite",
      missing: "-",
      detail: "exempt",
      run: () => runDoc(liteCompleteAbsent()),
    },
    {
      id: "partial-full-single",
      code: "verify.ledger.incomplete",
      exit: 1,
      token: "partial",
      variant: "full",
      missing: "dor_check",
      detail: "absent",
      run: () => runDoc(withOpenPhase("dor_check")),
    },
    {
      id: "partial-full-multi",
      code: "verify.ledger.incomplete",
      exit: 1,
      token: "partial",
      variant: "full",
      missing: "test_planning,delivery_planning,dor_check",
      detail: "absent",
      run: () => runDoc(threeMissing()),
    },
    {
      id: "partial-lite",
      code: "verify.ledger.incomplete",
      exit: 1,
      token: "partial",
      variant: "lite",
      missing: "quality_gates",
      detail: "absent",
      run: () => runDoc(withOpenPhase("quality_gates", liteCompleteAbsent())),
    },
    {
      id: "partial-absent",
      code: "lint.phases.incomplete",
      exit: 1,
      token: "partial",
      variant: "full",
      missing: "dor_check",
      detail: "absent",
      run: () => runDoc(partialB()),
    },
    {
      id: "malformed",
      code: "lint.notes.malformed",
      exit: 1,
      token: "failed",
      variant: "unknown",
      missing: "-",
      detail: "optional",
      run: () => runMalformed("unparseable"),
    },
    {
      id: "keys-top-level",
      code: "lint.keys.missing",
      exit: 1,
      token: "failed",
      variant: "unknown",
      missing: "-",
      detail: "optional",
      run: () => runMalformed("missing-title"),
    },
    {
      id: "keys-entry",
      code: "lint.keys.missing",
      exit: 1,
      token: "failed",
      variant: "unknown",
      missing: "-",
      detail: "optional",
      run: () => runMalformed("missing-entry-started"),
    },
    {
      id: "keys-collection",
      code: "lint.keys.missing",
      exit: 1,
      token: "failed",
      variant: "unknown",
      missing: "-",
      detail: "optional",
      run: () => runMalformed("missing-collection-text"),
    },
    {
      id: "variant-unknown",
      code: "lint.variant.unknown",
      exit: 1,
      token: "failed",
      variant: "unknown",
      missing: "-",
      detail: "absent",
      run: () => runMalformed("unknown-variant-compressed"),
    },
    {
      id: "target-missing",
      code: "lint.target.missing",
      exit: 1,
      token: "failed",
      variant: "unknown",
      missing: "-",
      detail: "absent",
      run: runMissingTarget,
    },
    {
      id: "grammar-handler",
      code: "input.value.rejected",
      exit: 1,
      token: "failed",
      variant: "unknown",
      missing: "-",
      detail: "absent",
      run: () => runGrammar(["change"]),
    },
    {
      id: "grammar-parser-extra",
      code: "fallback.invocation",
      exit: 1,
      token: "outside-taxonomy",
      variant: "unknown",
      missing: "-",
      detail: "exempt",
      run: () => runGrammar(["change", REF, "extra"]),
    },
    {
      id: "grammar-parser-flag",
      code: "fallback.invocation",
      exit: 1,
      token: "outside-taxonomy",
      variant: "unknown",
      missing: "-",
      detail: "exempt",
      run: () => runGrammar(["--verify-gates", "change", REF]),
    },
    {
      id: "state-torn",
      code: "state.store.torn",
      exit: 2,
      token: "state-unverified",
      variant: "full",
      missing: "-",
      detail: "row-summary",
      run: () => runDoc(fullBase(), ["change", REF], { stateFailure: "torn" }),
    },
    {
      id: "state-schema",
      code: "state.schema.mismatch",
      exit: 2,
      token: "state-unverified",
      variant: "full",
      missing: "-",
      detail: "row-summary",
      run: () => runDoc(fullBase(), ["change", REF], { stateFailure: "schema" }),
    },
    {
      id: "state-keys",
      code: "state.keys.missing",
      exit: 2,
      token: "state-unverified",
      variant: "full",
      missing: "-",
      detail: "row-summary",
      run: () => runDoc(fullBase(), ["change", REF], { stateFailure: "keys" }),
    },
  ];
  if (POSIX) {
    list.push({
      id: "state-permission",
      code: "state.permission.denied",
      exit: 1,
      token: "failed",
      variant: "full",
      missing: "-",
      detail: "row-summary",
      run: runPermissionFailure,
    });
  }
  return list;
};

const segmentsOf = (summary: string): string[] => summary.split("; ");

describe("TC-VERIFY-012 exhaustive envelope and exit matrix", () => {
  test("every cell is one valid envelope with the projected exit and identity", async () => {
    const matrix = cells();
    const observed = new Set<string>();
    let successes = 0;
    let negatives = 0;
    for (const cell of matrix) {
      const run = await cell.run();
      expect(run.exitCode, cell.id).toBe(cell.exit);
      expect(assertEnvelopeContract(run.envelope), cell.id).toEqual([]);
      const envelope = envelopeOf(run);
      expect(Object.keys(envelope).length).toBe(5);
      if (cell.code === undefined) {
        successes += 1;
        expect(run.exitCode).toBe(0);
        const data = dataOf(run);
        expect(data.result).toBe("finished");
        expect(data.variant).toBe(cell.variant);
        continue;
      }
      negatives += 1;
      observed.add(cell.code);
      const error = errorOf(run);
      expect(error.code, cell.id).toBe(cell.code);
      const row = entryFor(cell.code);
      expect(cell.exit).toBe(projectExitCode(row.projectionClass));
      expect(run.exitCode).toBe(projectExitCode(row.projectionClass));
      expect(error.code).not.toBe("fallback.internal");
      if (cell.detail === "exempt") continue;
      const summary = String(error.summary);
      const prefix = `result=${cell.token}; variant=${cell.variant}; missing=${cell.missing}`;
      expect(summary.startsWith(prefix), `${cell.id}: ${summary}`).toBe(true);
      expect(summary).not.toContain("\n");
      expect(summary).not.toContain(CANARY);
      const segments = segmentsOf(summary);
      if (cell.detail === "absent") {
        expect(segments).toHaveLength(3);
      } else if (cell.detail === "row-summary") {
        expect(summary).toBe(`${prefix}; detail=${row.summary ?? ""}`);
      } else if (segments.length > 3) {
        expect(summary).toContain("; detail=");
        expect(summary).toContain("(at ");
      }
    }
    expect(successes).toBe(2);
    expect(negatives).toBeGreaterThan(successes);
    const expected = new Set<string>();
    for (const cell of matrix) if (cell.code !== undefined) expected.add(cell.code);
    expect(observed).toEqual(expected);
    expect([...observed]).not.toContain("state.level.unsupported");
  });

  test("human mode keeps exits and diagnostics with no second envelope", async () => {
    const representatives: Array<[string, HarnessFactory, readonly string[]]> = [
      ["finished", factoryFor(fullBase()), ["change", REF]],
      ["partial", factoryFor(withOpenPhase("dor_check")), ["change", REF]],
      ["malformed", factoryForMalformed("unparseable"), ["change", REF]],
      ["variant", factoryForMalformed("unknown-variant-compressed"), ["change", REF]],
      ["target", factoryForMissingTarget(), ["change", REF]],
      ["grammar", factoryFor(fullBase()), ["change"]],
    ];
    for (const [label, factory, args] of representatives) {
      const jsonRun = await factory.harness.run(args);
      const humanRun = await factory.harness.run(args, { json: false });
      factory.cleanup();
      expect(humanRun.exitCode, label).toBe(jsonRun.exitCode);
      expect(humanRun.stdout, label).not.toContain('"schemaVersion"');
      expect(humanRun.stderr, label).not.toContain("    at ");
      if (jsonRun.exitCode === 0) {
        expect(humanRun.stderr, label).toBe("");
      } else {
        expect(humanRun.stderr.length, label).toBeGreaterThan(0);
      }
    }
  });
});

describe("TC-VERIFY-013 summary grammar and structured tuple", () => {
  test("the exact full and LITE partial summaries", async () => {
    const full = await runDoc(threeMissing());
    expect(String(errorOf(full).summary)).toBe(
      "result=partial; variant=full; missing=test_planning,delivery_planning,dor_check",
    );
    const lite = await runDoc(withOpenPhase("quality_gates", liteCompleteAbsent()));
    expect(String(errorOf(lite).summary)).toBe(
      "result=partial; variant=lite; missing=quality_gates",
    );
    for (const run of [full, lite]) {
      const summary = String(errorOf(run).summary);
      expect(summary).not.toContain(", ");
      expect(summary.endsWith(",")).toBe(false);
      expect(segmentsOf(summary)).toHaveLength(3);
    }
  });

  test("an independent oracle recomputes the missing set", async () => {
    const document = threeMissing();
    const phases = document.phases as Record<string, Record<string, unknown>>;
    const order = [
      "clarify_scope",
      "specification",
      "test_planning",
      "delivery_planning",
      "dor_check",
      "delivery",
      "system_spec_update",
      "review_fix",
      "quality_gates",
      "dod_check",
      "pr_creation",
    ];
    const expected = order.filter((phaseId) => phases[phaseId]?.completed === null);
    expect(expected).toEqual(["test_planning", "delivery_planning", "dor_check"]);
    const run = await runDoc(document);
    expect(String(errorOf(run).summary)).toBe(
      `result=partial; variant=full; missing=${expected.join(",")}`,
    );
  });

  test("reversed key order twins are byte-identical for failures and success", async () => {
    const canonical = threeMissing();
    const reversed = JSON.parse(JSON.stringify(canonical)) as Record<string, unknown>;
    const phases = reversed.phases as Record<string, unknown>;
    reversed.phases = Object.fromEntries(Object.entries(phases).reverse());
    const first = await runDoc(canonical);
    const second = await runDoc(reversed);
    expect(second.exitCode).toBe(first.exitCode);
    expect(second.stdout).toBe(first.stdout);

    const full1 = await runDoc(fullBase());
    const reversedComplete = JSON.parse(JSON.stringify(fullBase())) as Record<string, unknown>;
    const completePhases = reversedComplete.phases as Record<string, unknown>;
    reversedComplete.phases = Object.fromEntries(Object.entries(completePhases).reverse());
    const full2 = await runDoc(reversedComplete);
    expect(full2.stdout).toBe(full1.stdout);
    expect(dataOf(full2)).toEqual(dataOf(full1));
  });

  test("success arrays are required-set ordered and missingPhases is empty", async () => {
    const data = dataOf(await runDoc(fullBase()));
    expect(data.requiredPhases).toEqual([
      "clarify_scope",
      "specification",
      "test_planning",
      "delivery_planning",
      "dor_check",
      "delivery",
      "system_spec_update",
      "review_fix",
      "quality_gates",
      "dod_check",
      "pr_creation",
    ]);
    expect(data.completedPhases).toEqual(data.requiredPhases);
    expect(data.missingPhases).toEqual([]);
    const required = data.requiredPhases;
    if (!Array.isArray(required)) throw new Error("requiredPhases is not an array");
    expect(required).not.toEqual([...required].sort());
  });
});

const digestFile = (path: string): string =>
  createHash("sha256")
    .update(existsSync(path) ? readFileSync(path) : Buffer.from("absent"))
    .digest("hex");

const digestTree = (directory: string): string => {
  const hash = createHash("sha256");
  if (!existsSync(directory)) return hash.update("absent").digest("hex");
  const walk = (current: string): void => {
    for (const name of readdirSync(current).sort()) {
      const path = join(current, name);
      if (statSync(path).isDirectory()) {
        hash.update(`dir:${name}`);
        walk(path);
      } else {
        hash.update(`file:${name}`);
        hash.update(readFileSync(path));
      }
    }
  };
  walk(directory);
  return hash.digest("hex");
};

const withDigests = async (
  factory: HarnessFactory,
  args: readonly string[],
): Promise<{ readonly run: VerifyRun; readonly readCalls: readonly string[] }> => {
  const changesDirectory = factory.harness.changesDirectory;
  const stateDirectory = factory.harness.state.identity.stateDirectory;
  const before = `${digestTree(changesDirectory)}:${digestTree(stateDirectory)}`;
  try {
    const run = await factory.harness.run(args);
    const after = `${digestTree(changesDirectory)}:${digestTree(stateDirectory)}`;
    expect(after).toBe(before);
    return { run, readCalls: [...factory.harness.recorder.calls] };
  } finally {
    factory.cleanup();
  }
};

describe("TC-VERIFY-014 read-only, network-free, spawn-free", () => {
  test("every class leaves the change tree and state root byte-identical", async () => {
    const scenarios: Array<[string, HarnessFactory, readonly string[]]> = [
      ["finished", factoryFor(fullBase()), ["change", REF]],
      ["partial", factoryFor(withOpenPhase("dor_check")), ["change", REF]],
      ["malformed", factoryForMalformed("unparseable"), ["change", REF]],
      ["variant", factoryForMalformed("unknown-variant-compressed"), ["change", REF]],
      ["target", factoryForMissingTarget(), ["change", REF]],
      ["grammar", factoryFor(fullBase()), ["change"]],
      ["torn", factoryFor(fullBase(), { stateFailure: "torn" }), ["change", REF]],
    ];
    if (POSIX) scenarios.push(["permission", factoryForPermission(), ["change", REF]]);
    for (const [label, factory, args] of scenarios) {
      const { run, readCalls } = await withDigests(factory, args);
      expect(run.exitCode, label).toBeGreaterThanOrEqual(0);
      for (const writeCall of ["acquireFence", "append", "replaceDocument", "releaseFence"]) {
        expect(readCalls, label).not.toContain(writeCall);
      }
      if (label === "grammar") {
        expect(readCalls).toEqual([]);
      } else {
        expect(readCalls).toContain("readPmNotes");
      }
    }
  });

  test("throwing write seams prove a write would fail the run", () => {
    const state = createVerifyState();
    try {
      const recorder = createVerifyRecorder();
      const guarded = guardStore(state.store, recorder, { throwOnMutation: true });
      expect(() => guarded.store.acquireFence("probe")).toThrow();
      expect(recorder.calls).toContain("acquireFence");
    } finally {
      state.cleanup();
    }
  });

  test("ambient clock and randomness stubs are never invoked", async () => {
    const originalNow = Date.now;
    const originalRandom = Math.random;
    Date.now = () => {
      throw new Error("ambient clock invoked");
    };
    Math.random = () => {
      throw new Error("ambient randomness invoked");
    };
    try {
      const run = await runDoc(withOpenPhase("dor_check"));
      expect(String(errorOf(run).summary)).toBe("result=partial; variant=full; missing=dor_check");
    } finally {
      Date.now = originalNow;
      Math.random = originalRandom;
    }
  });

  test("the projection is never read or rebuilt", async () => {
    const state = createVerifyState();
    try {
      appendLanding(state, "delivery", "complete", "2026-10-31T05:00:00Z");
      const documents = join(
        state.identity.stateDirectory,
        `documents.${encodeURIComponent(state.identity.workspaceId)}`,
      );
      mkdirSync(documents, { recursive: true });
      const projection = join(documents, "phase-state.GH-177.json");
      writeFileSync(projection, "not-json");
      const before = digestFile(projection);
      const harness = createVerifyHarness({ targetText: stringify(fullBase()), state });
      try {
        const run = await harness.run(["change", REF]);
        expect(run.exitCode).toBe(0);
        expect(harness.recorder.calls).not.toContain("replaceDocument");
        expect(digestFile(projection)).toBe(before);
      } finally {
        harness.cleanup();
      }
    } finally {
      state.cleanup();
    }
  });

  test("negative controls: a mutating phase records writes and a seeded cache write trips the digest", async () => {
    const target = materializeTarget(stringify(fullBase()));
    const state = createVerifyState();
    try {
      const recorder = createVerifyRecorder();
      const guarded = guardStore(state.store, recorder, { throwOnMutation: false });
      const runtime = createPhaseCommandRuntime({
        store: guarded.store,
        changesDirectory: target.changesDirectory,
        fs: nodePmNotesFileSystemFacts(),
        writeFile: (file, text) => writeFileSync(file, text),
        nowIso: () => "2026-10-31T06:00:00Z",
        newFenceToken: () => "phase-control",
      });
      const deps: CliDependencies = {
        brand: SYNTHETIC_BRAND,
        clock: { now: () => 0 },
        newRunId: () => "run-phase-control",
        secrets: [],
        program: { commands: { phase: createPhaseCommandDefinition(runtime) } },
      };
      const stdout = bufferSink();
      const stderr = bufferSink();
      await runCli(["--json", "phase", "complete", REF, "delivery"], { stdout, stderr }, deps);
      expect(recorder.calls).toContain("acquireFence");
      expect(recorder.calls).toContain("append");
      expect(recorder.calls).toContain("replaceDocument");
      expect(recorder.calls).toContain("releaseFence");
    } finally {
      state.cleanup();
      rmSync(target.root, { recursive: true, force: true });
    }

    const root = createVerifyState();
    try {
      const before = digestTree(root.identity.stateDirectory);
      writeFileSync(join(root.identity.stateDirectory, "cache.json"), "seeded");
      expect(digestTree(root.identity.stateDirectory)).not.toBe(before);
    } finally {
      root.cleanup();
    }
  });
});

describe("TC-VERIFY-015 determinism and replay equality", () => {
  test("identical facts replay byte-identically, including a fresh root", async () => {
    const classes: Array<[string, () => HarnessFactory, readonly string[]]> = [
      ["finished", () => factoryFor(fullBase()), ["change", REF]],
      ["partial", () => factoryFor(withOpenPhase("dor_check")), ["change", REF]],
      ["malformed", () => factoryForMalformed("unparseable"), ["change", REF]],
      ["variant", () => factoryForMalformed("unknown-variant-compressed"), ["change", REF]],
      ["target", () => factoryForMissingTarget(), ["change", REF]],
      ["grammar-handler", () => factoryFor(fullBase()), ["change"]],
      ["grammar-parser", () => factoryFor(fullBase()), ["change", REF, "extra"]],
      ["torn", () => factoryFor(fullBase(), { stateFailure: "torn" }), ["change", REF]],
    ];
    if (POSIX) {
      classes.push(["permission", factoryForPermission, ["change", REF]]);
    }
    for (const [label, make, args] of classes) {
      const first = make();
      const runA = await first.harness.run(args);
      const runB = await first.harness.run(args);
      first.cleanup();
      expect(runB.exitCode, label).toBe(runA.exitCode);
      expect(runB.stdout, label).toBe(runA.stdout);
      expect(runB.stderr, label).toBe(runA.stderr);

      const fresh = make();
      const runC = await fresh.harness.run(args);
      fresh.cleanup();
      expect(runC.stdout, label).toBe(runA.stdout);
      expect(runC.envelope, label).toEqual(runA.envelope);
    }
  });

  test("changing only the run id changes runId, never the tuple", async () => {
    const state = createVerifyState();
    try {
      const a = createVerifyHarness({ targetText: stringify(fullBase()), state, runId: "run-a" });
      const runA = await a.run(["change", REF]);
      a.cleanup();
      const b = createVerifyHarness({ targetText: stringify(fullBase()), state, runId: "run-b" });
      const runB = await b.run(["change", REF]);
      b.cleanup();
      expect(envelopeOf(runA).runId).toBe("run-a");
      expect(envelopeOf(runB).runId).toBe("run-b");
      expect(dataOf(runB)).toEqual(dataOf(runA));
    } finally {
      state.cleanup();
    }
  });

  test("a real input change flips the token, summary, and exit", async () => {
    const partial = await runDoc(withOpenPhase("dor_check"));
    expect(partial.exitCode).toBe(1);
    expect(String(errorOf(partial).summary)).toContain("missing=dor_check");
    const restored = await runDoc(withCompletedPhase("dor_check", withOpenPhase("dor_check")));
    expect(restored.exitCode).toBe(0);
    expect(dataOf(restored).result).toBe("finished");
  });
});
