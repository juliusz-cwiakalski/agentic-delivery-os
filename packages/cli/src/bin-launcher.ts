/**
 * The one shared launcher composition (GH-320 F-1, DEC-5).
 *
 * Both executable entries delegate here: the launcher composes the production
 * program from the process facts its bin injects and returns an exit code.
 * Behaviour is exported as a function (never as a module-level literal), the
 * command runtime is never called directly, and no ambient global is read: the
 * bins are the declared process edges and pass the facts in.
 */

import { createProductionComposer, DECLARED_CREDENTIAL_REFERENCES } from "./production.js";
import { runEntrypoint } from "./entrypoint.js";

/** The one sink shape the launcher forwards to the entrypoint. */
export type LauncherStreams = {
  readonly stdout: { readonly write: (chunk: string) => void };
  readonly stderr: { readonly write: (chunk: string) => void };
};

/** The invoking bin's declared facts, plus the process facts it observes. */
export type BinLauncherOptions = {
  /** The invoking bin's own identity, declared at the process edge. */
  readonly declaredWorkingName: string;
  /** The identity's declared prior identity, when the bin has one. */
  readonly priorWorkingName?: string;
  readonly argv: readonly string[];
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly cwd: string;
  readonly streams: LauncherStreams;
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
  const environment = options.environment;
  const override = environment[WORKING_NAME_OVERRIDE];
  const workingName =
    override !== undefined && override.length > 0 ? override : options.declaredWorkingName;
  return runEntrypoint(options.argv, {
    streams: options.streams,
    environment,
    declaredWorkingName: options.declaredWorkingName,
    ...(options.priorWorkingName === undefined
      ? {}
      : { priorWorkingName: options.priorWorkingName }),
    credentialReferences: DECLARED_CREDENTIAL_REFERENCES,
    composeProgram: createProductionComposer({
      environment,
      cwd: options.cwd,
      homeDirectory: environment.HOME ?? environment.USERPROFILE ?? "",
      workingName,
      processId: options.processId ?? 0,
      ...(options.signalHost === undefined ? {} : { signalHost: options.signalHost }),
      ...(options.daemonEntry === undefined ? {} : { daemonEntry: options.daemonEntry }),
    }),
  });
};
