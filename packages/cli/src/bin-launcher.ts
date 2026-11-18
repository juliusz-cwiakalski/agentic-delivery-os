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
import type { BuildIdentity } from "./build-identity.js";
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
  /**
   * The injected build identity, when the invoking entry is a compiled
   * artifact. The bin observes the compiled fact and forwards the constant; a
   * workspace run passes nothing, so the delivered fallback stays verbatim.
   */
  readonly buildIdentity?: BuildIdentity;
  /**
   * The running artifact's real path, when a compiled run supplies it. Steps 2
   * and 3 of a replace read this composition fact instead of an ambient
   * process read.
   */
  readonly runningArtifactPath?: string;
  /** The closed composition transport policy; absent means the declared default. */
  readonly githubTransportPolicy?: GithubTransportPolicy;
  /** An injected CLI child runner so composition tests spawn nothing. */
  readonly githubCliRunner?: GithubChildRunner;
};

/**
 * The re-entry entry path for the compiled shape (F-3).
 *
 * A compiled artifact presents the runtime name and a virtual bundle path as
 * its first two arguments, so a spawn or a service unit given `argv[1]` would
 * receive a path inside the bundle. The bin observes the two process facts and
 * this rule answers the artifact's real executable path for a compiled run and
 * the delivered script path otherwise. The rule reads no ambient value.
 */
export const resolveReentryEntryPath = (input: {
  readonly argvEntry?: string;
  readonly execPath: string;
}): string => {
  const entry = input.argvEntry;
  if (entry === undefined || entry.length === 0) return input.execPath;
  return entry.startsWith("/$bunfs/") || entry.includes("/$bunfs/") ? input.execPath : entry;
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
    ...(options.buildIdentity === undefined ? {} : { buildIdentity: options.buildIdentity }),
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
