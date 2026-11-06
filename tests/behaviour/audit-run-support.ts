/**
 * Shared in-process runCli harness for the GH-223 audit behaviour suites.
 * Deterministic clock/run-id, injected environment, buffer streams, and the
 * store-backed audit seam composed at the CLI edge. No process is spawned.
 */
import { createCliAudit, resolveCliMode } from "../../packages/cli/src/edge";
import {
  type CliAuditDependencies,
  type CliDependencies,
  type CliMode,
  type CommandDefinition,
  type CommandHandler,
  type CommandProgram,
  runCli,
} from "../../packages/cli/src/index";
import type { AuditAgentIdentity } from "../../packages/core/src/contracts/index";
import type { AuditStoreFixture } from "../fixtures/state/harness";
import { bufferSink, SYNTHETIC_BRAND } from "../golden/helpers";

export const IDENTITY_VARIABLE = `${SYNTHETIC_BRAND.environmentPrefix}AGENT_IDENTITY`;

export type RunOptions = {
  readonly argv: readonly string[];
  readonly program: CommandProgram;
  readonly runId: string;
  readonly ticks?: readonly [number, number];
  readonly secrets?: readonly string[];
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly mode?: CliMode;
  readonly repo?: string;
  readonly identity?: AuditAgentIdentity;
};

export type RunResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

const clockFrom = (ticks: readonly [number, number]): CliDependencies["clock"] => {
  let index = 0;
  return {
    now: () => {
      const value = ticks[Math.min(index, 1)] as number;
      index += 1;
      return value;
    },
  };
};

/** Run one invocation through the in-process surface with audit wired. */
export const runAudited = async (
  fixture: AuditStoreFixture,
  options: RunOptions,
): Promise<RunResult> => {
  const stdout = bufferSink();
  const stderr = bufferSink();
  const auditComposition = createCliAudit({
    store: fixture.store,
    scope: fixture.identity.workspaceId,
    ...(options.repo === undefined ? {} : { repo: options.repo }),
    environment: options.environment ?? {},
    environmentPrefix: SYNTHETIC_BRAND.environmentPrefix,
  });
  const audit: CliAuditDependencies =
    options.identity === undefined
      ? auditComposition
      : { ...auditComposition, identity: options.identity };
  const deps: CliDependencies = {
    brand: SYNTHETIC_BRAND,
    clock: clockFrom(options.ticks ?? [1000, 1013]),
    newRunId: () => options.runId,
    secrets: options.secrets ?? [],
    program: options.program,
    mode: options.mode ?? resolveCliMode({ isTTY: false }),
    audit,
  };
  const exitCode = await runCli(options.argv, { stdout, stderr }, deps);
  return { exitCode, stdout: stdout.value, stderr: stderr.value };
};

export type ProgramKind =
  | "success"
  | "void"
  | "classified-user"
  | "classified-platform"
  | "unknown";

const handlerFor = (kind: ProgramKind): CommandHandler => {
  switch (kind) {
    case "success":
      return () => ({ data: { message: "all good", count: 2 } });
    case "void":
      return () => ({ data: {} });
    case "classified-user":
      return () => {
        throw { kind: "input" };
      };
    case "classified-platform":
      return () => {
        throw { kind: "provider", code: "provider.quota.exceeded" };
      };
    case "unknown":
      return () => {
        throw new Error("synthetic unknown failure");
      };
    default:
      return () => ({ data: {} });
  }
};

/** A single-command program with optional flag/positional metadata. */
export const programFor = (kind: ProgramKind): CommandProgram => {
  const definition: CommandDefinition = {
    handler: handlerFor(kind),
    flags: ["--format", "--raw"],
    requiresValue: ["--name"],
    conflicts: [["--format", "--raw"]],
    positionals: { max: 2 },
  };
  return { commands: { status: definition } };
};

/** The raw argv for the four broken-invocation shapes. */
export const BROKEN_ARGV = {
  unknownCommand: ["--json", "nope"],
  unknownFlag: ["--json", "status", "--wat"],
  missingValue: ["--json", "status", "--name"],
  conflictingFlags: ["--json", "status", "--format", "--raw"],
} as const;
