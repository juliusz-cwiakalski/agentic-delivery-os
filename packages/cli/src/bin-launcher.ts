/**
 * The one shared launcher composition (GH-320 F-1, DEC-5).
 *
 * Both executable entries delegate here: the launcher reads the environment,
 * the working directory, and the home directory exactly once, composes the
 * production program, and returns an exit code. Behaviour is exported as a
 * function (never as a module-level literal), the command runtime is never
 * called directly, and each bin declares only its own identity facts.
 */

import { createProductionComposer, DECLARED_CREDENTIAL_REFERENCES } from "./production.js";
import { runEntrypoint } from "./entrypoint.js";
import type { CliStreams } from "./output/serialize.js";

/** The invoking bin's declared facts, plus test-injectable process facts. */
export type BinLauncherOptions = {
  /** The invoking bin's own identity, declared at the process edge. */
  readonly declaredWorkingName: string;
  /** The identity's declared prior identity, when the bin has one. */
  readonly priorWorkingName?: string;
  readonly argv?: readonly string[];
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly cwd?: string;
  readonly streams?: CliStreams;
  readonly processId?: number;
  readonly signalHost?: {
    readonly once: (event: "SIGINT" | "SIGTERM", listener: () => void) => void;
    readonly removeListener: (event: "SIGINT" | "SIGTERM", listener: () => void) => void;
  };
  readonly daemonEntry?: string;
};

/** The working-name override variable shared by both bins (DEC-4). */
const WORKING_NAME_OVERRIDE = "DELIVERY_OS_WORKING_NAME";

/**
 * Run one executable invocation through the one shared composition.
 *
 * The override keeps its delivered precedence: a non-empty override supplies
 * the working name for both bins, and the invoking bin's declared default is
 * the floor when it is absent.
 */
export const runBinLauncher = async (options: BinLauncherOptions): Promise<number> => {
  const environment: Readonly<Record<string, string | undefined>> =
    options.environment ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const argv = options.argv ?? process.argv.slice(2);
  const homeDirectory = environment.HOME ?? environment.USERPROFILE ?? "";
  const override = environment[WORKING_NAME_OVERRIDE];
  const workingName =
    override !== undefined && override.length > 0 ? override : options.declaredWorkingName;
  const daemonEntry = options.daemonEntry ?? process.argv[1];
  return runEntrypoint(argv, {
    streams: options.streams ?? { stdout: process.stdout, stderr: process.stderr },
    environment,
    declaredWorkingName: options.declaredWorkingName,
    ...(options.priorWorkingName === undefined
      ? {}
      : { priorWorkingName: options.priorWorkingName }),
    credentialReferences: DECLARED_CREDENTIAL_REFERENCES,
    composeProgram: createProductionComposer({
      environment,
      cwd,
      homeDirectory,
      workingName,
      processId: options.processId ?? process.pid,
      ...(options.signalHost === undefined ? { signalHost: process } : { signalHost: options.signalHost }),
      ...(daemonEntry === undefined ? {} : { daemonEntry }),
    }),
  });
};
