/** In-process CLI harness for the closeout command (test-plan §4.1 item 6). */

import { createCloseoutCommandDefinition } from "../../../packages/cli/src/commands/closeout";
import {
  type CloseoutComposition,
  createCloseoutCommandRuntime,
} from "../../../packages/cli/src/edge";
import { type CliDependencies, type CommandProgram, runCli } from "../../../packages/cli/src/index";
import type {
  CapsuleFileRuntime,
  CloseoutCapsuleFacts,
  CloseoutData,
  CloseoutDiffRead,
  CloseoutExpectedCapsuleEvent,
  CloseoutPromotionRuntime,
  CloseoutRetroFacts,
  CloseoutSessionFacts,
  CloseoutTelemetryRuntime,
} from "../../../packages/core/src/contracts/index";
import { bufferSink, SYNTHETIC_BRAND } from "../../golden/helpers";
import {
  CLOSEOUT_NOW_MS,
  CLOSEOUT_TIMESTAMP,
  type FakeGit,
  type FakeProvider,
  type FakeState,
  makeFacts,
  makeGit,
  makeProvider,
  makeState,
} from "./harness";

export type CliCloseoutHarness = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly envelope: Record<string, unknown>;
  readonly provider: FakeProvider;
  readonly git: FakeGit;
  readonly state: FakeState;
};

export type RunCloseoutCliOptions = {
  readonly facts?: ReturnType<typeof makeFacts>;
  readonly provider?: FakeProvider;
  readonly git?: FakeGit;
  readonly state?: FakeState;
  /** The append-only capsule runtime (GH-240 F-3). */
  readonly capsule?: CapsuleFileRuntime;
  readonly capsuleExpected?: readonly CloseoutExpectedCapsuleEvent[];
  readonly promotion?: CloseoutPromotionRuntime;
  readonly diffRead?: CloseoutDiffRead;
  readonly telemetry?: CloseoutTelemetryRuntime;
};

export const runCloseoutCli = async (
  argv: readonly string[],
  options: RunCloseoutCliOptions = {},
): Promise<CliCloseoutHarness> => {
  const provider = options.provider ?? makeProvider();
  const git = options.git ?? makeGit();
  const state = options.state ?? makeState();
  const baseFacts = options.facts ?? makeFacts();
  const facts =
    options.capsule === undefined
      ? baseFacts
      : { ...baseFacts, capsule: capsuleFactsOf(options.capsule, baseFacts.workItemRef) };
  const composition: CloseoutComposition = {
    planFacts: async () => facts,
    provider: provider.runtime,
    git: git.runtime,
    state: state.runtime,
    nowIso: () => CLOSEOUT_TIMESTAMP,
    newFenceToken: () => "fence-closeout",
    ...(options.capsule === undefined ? {} : { capsule: options.capsule }),
    ...(options.capsuleExpected === undefined
      ? {}
      : { capsuleExpected: () => options.capsuleExpected ?? [] }),
    ...(options.promotion === undefined
      ? {}
      : { promotion: () => options.promotion as CloseoutPromotionRuntime }),
    ...(options.diffRead === undefined ? {} : { diffRead: options.diffRead }),
    ...(facts.retro === undefined ? {} : { retro: facts.retro }),
    ...(facts.sessions === undefined ? {} : { sessions: facts.sessions }),
    ...(options.telemetry === undefined ? {} : { telemetry: options.telemetry }),
  };
  const runtime = createCloseoutCommandRuntime(composition);
  const program: CommandProgram = {
    commands: { closeout: createCloseoutCommandDefinition(runtime) },
  };
  const stdout = bufferSink();
  const stderr = bufferSink();
  let tick = 0;
  const deps: CliDependencies = {
    brand: SYNTHETIC_BRAND,
    clock: {
      now: () => {
        const value = tick === 0 ? CLOSEOUT_NOW_MS : CLOSEOUT_NOW_MS + 1;
        tick += 1;
        return value;
      },
    },
    newRunId: () => "run-closeout",
    secrets: [],
    program,
  };
  const exitCode = await runCli(argv, { stdout, stderr }, deps);
  const text = stdout.value.trim();
  const envelope: Record<string, unknown> =
    text.length === 0 ? {} : (JSON.parse(text) as Record<string, unknown>);
  return { exitCode, stdout: stdout.value, stderr: stderr.value, envelope, provider, git, state };
};

const capsuleFactsOf = (runtime: CapsuleFileRuntime, workItemRef: string): CloseoutCapsuleFacts => {
  const read = runtime.read(workItemRef);
  const candidates = runtime.readCandidates(workItemRef);
  return {
    present: read.ok && read.events.length > 0,
    valid: read.ok && candidates.ok,
    ...(read.ok
      ? {}
      : {
          refusal: {
            code: read.code,
            detail: read.detail,
            ...(read.line === undefined ? {} : { line: read.line }),
          },
        }),
    ...(candidates.ok ? {} : { refusal: { code: candidates.code, detail: candidates.detail } }),
    events: read.ok ? read.events.length : 0,
    candidates: candidates.ok ? candidates.candidates.length : 0,
  };
};

export const closeoutData = (envelope: Record<string, unknown>): CloseoutData => {
  const data = envelope.data;
  if (typeof data !== "object" || data === null) throw new Error("missing closeout data");
  return data as CloseoutData;
};

export const errorOf = (envelope: Record<string, unknown>): Record<string, unknown> => {
  const error = envelope.error;
  if (typeof error !== "object" || error === null) throw new Error("missing error");
  return error as Record<string, unknown>;
};
