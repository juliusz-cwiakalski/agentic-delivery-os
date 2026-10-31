/**
 * In-process lint command harness (test-plan §4.1).
 *
 * Every run builds the lint command program with injected brand/clock/id and
 * calls `runCli` in process; no child process is spawned. Fixture trees live
 * under a fresh `mkdtemp` OS-temp root and are removed by the caller.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringify } from "yaml";
import {
  nodePmNotesFileSystemFacts,
  readPmNotesTarget,
} from "../../packages/adapters/src/file/pm-notes-parser";
import {
  createLintCommandDefinition,
  type LintCommandRuntime,
  type LintRegistryRead,
} from "../../packages/cli/src/commands/lint";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import { bufferSink, SYNTHETIC_BRAND } from "../golden/helpers";
import { readPmNotesFixture } from "./pm-notes-lint-support";

export type LintRun = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly envelope?: Record<string, unknown>;
};

export type LintRuntimeOptions = {
  readonly json?: boolean;
  readonly runId?: string;
  readonly ticks?: readonly [number, number];
};

export const emptyRegistry = (): LintRegistryRead => ({
  ok: true,
  verifiedEmpty: true,
  recordCount: 0,
  verification: [],
  projection: { present: false },
});

export const runLint = async (
  runtime: LintCommandRuntime,
  args: readonly string[],
  options: LintRuntimeOptions = {},
): Promise<LintRun> => {
  const stdout = bufferSink();
  const stderr = bufferSink();
  const ticks = options.ticks ?? [100, 100];
  let tick = 0;
  const deps: CliDependencies = {
    brand: SYNTHETIC_BRAND,
    clock: {
      now: () => {
        const value = ticks[Math.min(tick, 1)] as number;
        tick += 1;
        return value;
      },
    },
    newRunId: () => options.runId ?? "run-lint-fixture",
    secrets: [],
    program: { commands: { lint: createLintCommandDefinition(runtime) } },
  };
  const argv = options.json === false ? ["lint", ...args] : ["--json", "lint", ...args];
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

export type FixtureRuntime = {
  readonly root: string;
  readonly target: string;
  readonly runtime: LintCommandRuntime;
  cleanup(): void;
};

const makeRoot = (): string => mkdtempSync(join(tmpdir(), "gh179-lint-command-"));

export const runtimeForText = (
  text: string,
  registry: (changeRef: string) => LintRegistryRead = emptyRegistry,
): FixtureRuntime => {
  const root = makeRoot();
  const directory = join(root, "doc/changes/2026-10/2026-10-31--GH-179--fixture");
  mkdirSync(directory, { recursive: true });
  const target = join(directory, "chg-GH-179-pm-notes.yaml");
  writeFileSync(target, text);
  const facts = nodePmNotesFileSystemFacts();
  return {
    root,
    target,
    runtime: {
      readPmNotes: (changeRef) =>
        readPmNotesTarget({
          changeRef,
          changesDirectory: join(root, "doc/changes"),
          fs: facts,
        }),
      readRegistry: registry,
    },
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
};

export const runtimeForFixture = (
  relative: string,
  registry?: (changeRef: string) => LintRegistryRead,
): FixtureRuntime => runtimeForText(readPmNotesFixture(relative), registry);

export const runtimeForValue = (
  value: unknown,
  registry?: (changeRef: string) => LintRegistryRead,
): FixtureRuntime => runtimeForText(stringify(value), registry);

export const runtimeWithoutTarget = (
  registry: (changeRef: string) => LintRegistryRead = emptyRegistry,
): FixtureRuntime => {
  const root = makeRoot();
  mkdirSync(join(root, "doc/changes"), { recursive: true });
  const facts = nodePmNotesFileSystemFacts();
  return {
    root,
    target: join(root, "doc/changes"),
    runtime: {
      readPmNotes: (changeRef) =>
        readPmNotesTarget({ changeRef, changesDirectory: join(root, "doc/changes"), fs: facts }),
      readRegistry: registry,
    },
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
};

export const targetText = (target: string): string => readFileSync(target, "utf8");
