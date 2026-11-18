/**
 * The one shared launcher composition (GH-320 F-1, DEC-5).
 *
 * Both executable entries delegate here: the launcher composes the production
 * program from the process facts its bin injects and returns an exit code.
 * Behaviour is exported as a function (never as a module-level literal), the
 * command runtime is never called directly, and no ambient global is read: the
 * bins are the declared process edges and pass the facts in.
 */

import type { GithubChildRunner, GithubTransportPolicy } from "@delivery-os/adapters/github";
import { runEntrypoint, workingNameEnvironmentVariable } from "./entrypoint.js";
import {
  createProductionComposer,
  DECLARED_CREDENTIAL_REFERENCES,
  resolveCompositionTransportSelection,
} from "./production.js";

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
  /** The closed composition transport policy; absent means the declared default. */
  readonly githubTransportPolicy?: GithubTransportPolicy;
  /** An injected CLI child runner so composition tests spawn nothing. */
  readonly githubCliRunner?: GithubChildRunner;
};

/**
 * Run one executable invocation through the one shared composition.
 *
 * The override keeps its delivered precedence: a non-empty override supplies
 * the working name for both bins, and the invoking bin's declared default is
 * the floor when it is absent. The variable name is the entrypoint's one
 * accessor, never a second literal here (GH-320 F-9).
 */
export const runBinLauncher = async (options: BinLauncherOptions): Promise<number> => {
  const environment = options.environment;
  const override = environment[workingNameEnvironmentVariable()];
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
    // The one composition path: the wrapper runs only when the entrypoint
    // composes, so every self-description path returns before the probe. The
    // resolver's value is forwarded as a composition fact; the composer stays
    // synchronous and the launcher keeps no composition logic of its own.
    composeProgram: async (brand, invocation) => {
      const githubTransportSelection = await resolveCompositionTransportSelection({
        environment,
        ...(options.githubTransportPolicy === undefined
          ? {}
          : { policy: options.githubTransportPolicy }),
        ...(options.githubCliRunner === undefined ? {} : { runner: options.githubCliRunner }),
      });
      return createProductionComposer({
        environment,
        cwd: options.cwd,
        homeDirectory: environment.HOME ?? environment.USERPROFILE ?? "",
        workingName,
        processId: options.processId ?? 0,
        githubTransportSelection,
        ...(options.signalHost === undefined ? {} : { signalHost: options.signalHost }),
        ...(options.daemonEntry === undefined ? {} : { daemonEntry: options.daemonEntry }),
      })(brand, invocation);
    },
  });
};
