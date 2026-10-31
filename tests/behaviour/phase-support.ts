/**
 * In-process phase command harness (test-plan §4.1).
 *
 * Every run composes the real command definition with injected brand, clock,
 * temp change tree, and a temp state root; no child process is spawned. Raw
 * ledger access and the derived projection are exposed for three-way no-op and
 * append-only assertions.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  nodePmNotesFileSystemFacts,
  readPmNotesText,
  stagePmNotesPhaseEntry,
} from "../../packages/adapters/src/file";
import {
  createPhaseCommandDefinition,
  type PhaseCommandRuntime,
} from "../../packages/cli/src/commands/phase";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import type { StateStoreIdentity, StateStorePort } from "../../packages/core/src/contracts/index";
import {
  appendPhaseTransition,
  phaseStateDocumentName,
  readChangeTransitions,
  replacePhaseProjection,
} from "../../packages/core/src/state/index";
import {
  ledgerLines,
  ledgerPath,
  makeIdentity,
  openStore,
  removeRoot,
} from "../fixtures/state/harness";
import { bufferSink, SYNTHETIC_BRAND } from "../golden/helpers";

export const PHASE_REF = "GH-179";
export const PHASE_CHANGE_DIRECTORY = "doc/changes";

export type PhaseClock = {
  nextIso(): string;
  nowMs(): number;
  readonly issued: readonly string[];
};

export const makePhaseClock = (): PhaseClock => {
  const issued: string[] = [];
  let index = 0;
  return {
    nextIso: () => {
      const iso = new Date(Date.UTC(2026, 9, 31, 12, index, 0)).toISOString().replace(".000Z", "Z");
      index += 1;
      issued.push(iso);
      return iso;
    },
    nowMs: () => {
      index += 1;
      return index * 1_000;
    },
    get issued() {
      return [...issued];
    },
  };
};

export type PhaseRun = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly envelope?: Record<string, unknown>;
};

export type PhaseHarness = {
  readonly root: string;
  readonly stateRoot: string;
  readonly targetPath: string;
  readonly identity: StateStoreIdentity;
  readonly store: StateStorePort;
  readonly clock: PhaseClock;
  run(args: readonly string[], options?: { readonly json?: boolean }): Promise<PhaseRun>;
  rawLedgerLines(): string[];
  rawLedgerText(): string;
  transitionPayloads(): Record<string, unknown>[];
  targetText(): string;
  projectionContent(): unknown;
  cleanup(): void;
};

export const makePhaseRoot = (label = "phase"): string =>
  mkdtempSync(join(tmpdir(), `gh179-${label}-`));

const writeTarget = (root: string, text: string, relativeDirectory: string): string => {
  const directory = join(root, PHASE_CHANGE_DIRECTORY, relativeDirectory);
  mkdirSync(directory, { recursive: true });
  const target = join(directory, `chg-${PHASE_REF}-pm-notes.yaml`);
  writeFileSync(target, text);
  return target;
};

const recordsOf = (lines: readonly string[]): Record<string, unknown>[] =>
  lines.map((line) => {
    const parsed: unknown = JSON.parse(line);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("ledger line is not a record");
    }
    return parsed as Record<string, unknown>;
  });

export const createPhaseHarness = (
  fixtureText: string,
  label = "phase",
  relativeDirectory = `2026-10/2026-10-31--${PHASE_REF}--phase-fixture`,
): PhaseHarness => {
  const root = makePhaseRoot(label);
  const targetPath = writeTarget(root, fixtureText, relativeDirectory);
  const stateRoot = join(root, "state");
  const identity = makeIdentity(stateRoot, { workspaceId: "phase-fixture" });
  const { store } = openStore(identity);
  const clock = makePhaseClock();
  const facts = nodePmNotesFileSystemFacts();
  let fenceCounter = 0;
  const runtime: PhaseCommandRuntime = {
    readPmNotes: (changeRef) =>
      readPmNotesText({
        changeRef,
        changesDirectory: join(root, PHASE_CHANGE_DIRECTORY),
        fs: facts,
      }),
    stageEntry: (text, edit) => stagePmNotesPhaseEntry(text, edit),
    readRegistry: (changeRef) => {
      const read = readChangeTransitions(store, changeRef);
      if (!read.ok) return { ok: false, error: read.error };
      return {
        ok: true,
        verifiedEmpty: read.value.verifiedEmpty,
        transitions: read.value.transitions,
        evidence: read.value.evidence,
      };
    },
    appendTransition: (request) => appendPhaseTransition(store, request),
    replaceProjection: (request) => replacePhaseProjection(store, request),
    writePmNotes: (file, text) => {
      try {
        writeFileSync(file, text);
        return { ok: true };
      } catch {
        return { ok: false, message: `failed to write ${file}` };
      }
    },
    nowIso: () => clock.nextIso(),
    newFenceToken: () => {
      fenceCounter += 1;
      return `phase-writer-${fenceCounter}`;
    },
  };

  const run = async (
    args: readonly string[],
    options: { readonly json?: boolean } = {},
  ): Promise<PhaseRun> => {
    const stdout = bufferSink();
    const stderr = bufferSink();
    const deps: CliDependencies = {
      brand: SYNTHETIC_BRAND,
      clock: { now: () => clock.nowMs() },
      newRunId: () => "run-phase-fixture",
      secrets: [],
      program: { commands: { phase: createPhaseCommandDefinition(runtime) } },
    };
    const argv = options.json === false ? ["phase", ...args] : ["--json", "phase", ...args];
    const exitCode = await runCli(argv, { stdout, stderr }, deps);
    const text = stdout.value.trim();
    const envelope = text.length === 0 ? undefined : (JSON.parse(text) as Record<string, unknown>);
    return {
      exitCode,
      stdout: stdout.value,
      stderr: stderr.value,
      ...(envelope === undefined ? {} : { envelope }),
    };
  };

  return {
    root,
    stateRoot,
    targetPath,
    identity,
    store,
    clock,
    run,
    rawLedgerLines: () =>
      existsSync(ledgerPath(identity))
        ? ledgerLines(readFileSync(ledgerPath(identity), "utf8"))
        : [],
    rawLedgerText: () =>
      existsSync(ledgerPath(identity)) ? readFileSync(ledgerPath(identity), "utf8") : "",
    transitionPayloads: () =>
      recordsOf(
        existsSync(ledgerPath(identity))
          ? ledgerLines(readFileSync(ledgerPath(identity), "utf8"))
          : [],
      )
        .filter((record) => record.kind === "phase.transition")
        .map((record) => (record.payload as Record<string, unknown>) ?? {}),
    targetText: () => readFileSync(targetPath, "utf8"),
    projectionContent: () => {
      const key = `document:${phaseStateDocumentName(PHASE_REF)}`;
      const read = store.read({ requiredKeys: [key] });
      return read.ok ? read.value.values[key] : undefined;
    },
    cleanup: () => removeRoot(root),
  };
};

export const withPhaseHarness = async (
  fixtureText: string,
  body: (harness: PhaseHarness) => Promise<void> | void,
  label = "phase",
  relativeDirectory?: string,
): Promise<void> => {
  const harness = createPhaseHarness(fixtureText, label, relativeDirectory);
  try {
    await body(harness);
  } finally {
    harness.cleanup();
  }
};

/** Remove one one-line phase entry to build absent-phase and incomplete fixtures. */
export const withoutPhase = (text: string, phaseId: string): string =>
  text
    .split("\n")
    .filter((line) => !line.startsWith(`  ${phaseId}:`))
    .join("\n");

export const createTestClockValue = (index: number): string =>
  new Date(Date.UTC(2026, 9, 31, 12, index, 0)).toISOString().replace(".000Z", "Z");
