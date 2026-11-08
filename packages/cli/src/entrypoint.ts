/**
 * The executable entrypoint (GH-242 F-1, DEC-13, DEC-14).
 *
 * Resolves the working name once (typed configuration → non-empty
 * `DELIVERY_OS_WORKING_NAME` override → neutral `delivery-os` default), renders
 * root/command help and version with no state, network, git, or configuration
 * read, composes exactly the prompt-required command set, and fails closed
 * through the existing `fallback.internal` containment identity for an
 * invocation outside that set. It never invokes `process.exit`.
 */

import { resolveBrandIdentity } from "@delivery-os/core/branding";
import {
  type BrandIdentity,
  type CommandResult,
  FALLBACK_INTERNAL_CODE,
} from "@delivery-os/core/contracts";
import {
  PROMPT_REQUIRED_COMMANDS,
  type PromptRequiredCommand,
} from "./help/prompt-required-commands.js";
import { allHelpEntries, helpEntryFor, renderHelp, renderRootHelp } from "./help.js";
import {
  type CliDependencies,
  type CliMode,
  type CliStreams,
  type CommandDefinition,
  type CommandProgram,
  runCli,
} from "./index.js";

/** The neutral default working name; never the forbidden seed literal. */
const NEUTRAL_WORKING_NAME = "delivery-os";

/** The non-empty working-name override read from the injected environment. */
const WORKING_NAME_ENVIRONMENT = "DELIVERY_OS_WORKING_NAME";

/** The neutral default working name, exposed as behavior (no exported literal). */
export const neutralWorkingName = (): string => NEUTRAL_WORKING_NAME;

/** The working-name environment variable name, exposed as behavior. */
export const workingNameEnvironmentVariable = (): string => WORKING_NAME_ENVIRONMENT;

export { PROMPT_REQUIRED_COMMANDS, type PromptRequiredCommand };

/** Composes the prompt-required program; help/version never calls it. */
export type EntrypointComposer = (brand: BrandIdentity) => CommandProgram;

/** Injected entrypoint facts; every dynamic value arrives through options. */
export type EntrypointOptions = {
  readonly streams: CliStreams;
  readonly environment: Readonly<Record<string, string | undefined>>;
  /** The working name already resolved from typed configuration, when present. */
  readonly configuredWorkingName?: string;
  /** The composition root for prompt-required commands. */
  readonly composeProgram: EntrypointComposer;
  readonly version?: string;
  readonly build?: string;
  readonly clock?: CliDependencies["clock"];
  readonly newRunId?: () => string;
  readonly secrets?: readonly string[];
  readonly mode?: CliMode;
  readonly audit?: CliDependencies["audit"];
};

/** The composed, inert entrypoint surface (no command runtime is built yet). */
export type Entrypoint = {
  readonly brand: BrandIdentity;
  readonly version: string;
  readonly build: string;
  readonly composeProgram: EntrypointComposer;
};

const DEFAULT_VERSION = "0.0.0";
const DEFAULT_BUILD = "dev";

/**
 * Resolve the working name in declared order. A present, non-empty override is
 * passed to the branding resolver, which gives it precedence; otherwise the
 * configured name is used; the neutral default closes the no-config case.
 */
export const resolveWorkingName = (options: {
  readonly configuredWorkingName?: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
}): string => {
  const configured = options.configuredWorkingName;
  if (configured !== undefined && configured.length > 0) return configured;
  return neutralWorkingName();
};

/** Resolve the brand for the entrypoint (pure; reads only the injected facts). */
export const resolveEntrypointBrand = (options: {
  readonly configuredWorkingName?: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
}): BrandIdentity => {
  const workingName = resolveWorkingName(options);
  const override = options.environment[workingNameEnvironmentVariable()];
  const branded = resolveBrandIdentity(
    override === undefined || override.length === 0 ? { workingName } : { workingName, override },
  );
  if (branded.ok) return branded.value;
  // An invalid override/name is a resolver-input error. Help and version must
  // still be usable, so fall back to the neutral default rather than reading
  // configuration or crashing; no seed literal is introduced.
  const neutral = resolveBrandIdentity({ workingName: neutralWorkingName() });
  if (!neutral.ok) throw new Error("the neutral working name is unusable");
  return neutral.value;
};

const isGlobalFlag = (token: string): boolean =>
  token === "--json" || token === "--verbose" || token === "--pretty";

const nonGlobalTokens = (argv: readonly string[]): readonly string[] =>
  argv.filter((token) => !isGlobalFlag(token));

/** Build the entrypoint surface without composing any command runtime. */
export const createEntrypoint = (options: EntrypointOptions): Entrypoint => ({
  brand: resolveEntrypointBrand(options),
  version: options.version ?? DEFAULT_VERSION,
  build: options.build ?? DEFAULT_BUILD,
  composeProgram: options.composeProgram,
});

/**
 * Restrict a composed program to exactly the prompt-required set.
 *
 * A missing prompt-required command is a composition gap and throws: silently
 * shipping a partial surface is exactly what the honesty rule forbids.
 */
export const selectPromptRequiredProgram = (program: CommandProgram): CommandProgram => {
  const commands: Record<string, CommandDefinition> = {};
  for (const name of PROMPT_REQUIRED_COMMANDS) {
    const definition = program.commands[name];
    if (definition === undefined) {
      throw new Error(`prompt-required command "${name}" is not composed`);
    }
    commands[name] = definition;
  }
  const extra = Object.keys(program.commands).filter(
    (name) => !(PROMPT_REQUIRED_COMMANDS as readonly string[]).includes(name),
  );
  // Extra registrations are dropped, never advertised: the entrypoint claims
  // exactly the prompt-required set.
  return extra.length === 0 ? program : { commands };
};

/** A classified containment failure naming the missing composition. */
export const uncomposedDefinition = (command: string): CommandDefinition => ({
  handler: () => ({
    error: {
      kind: "fallback" as const,
      code: FALLBACK_INTERNAL_CODE,
      summary: `command "${command}" is not part of the composed prompt-required set`,
    },
  }),
});

const versionText = (entrypoint: Entrypoint): string =>
  `${entrypoint.brand.binaryName} ${entrypoint.version} (build ${entrypoint.build})\n`;

const isUnusableCommand = (program: CommandProgram, command: string): boolean =>
  program.commands[command] === undefined;

const dependenciesFor = (
  options: EntrypointOptions,
  entrypoint: Entrypoint,
  program: CommandProgram,
): CliDependencies => ({
  brand: entrypoint.brand,
  clock: options.clock ?? { now: () => Date.now() },
  newRunId: options.newRunId ?? (() => globalThis.crypto.randomUUID()),
  secrets: options.secrets ?? [],
  program,
  ...(options.mode === undefined ? {} : { mode: options.mode }),
  ...(options.audit === undefined ? {} : { audit: options.audit }),
});

/**
 * Emit self-description text through the single serialization chokepoint.
 *
 * The text travels as a human-success payload of an inert synthetic command, so
 * every byte passes the existing redaction/write path and no second stream
 * writer exists.
 */
const emitSelfDescription = (
  text: string,
  options: EntrypointOptions,
  entrypoint: Entrypoint,
): Promise<number> =>
  runCli(["self"], options.streams, {
    brand: entrypoint.brand,
    clock: options.clock ?? { now: () => Date.now() },
    newRunId: options.newRunId ?? (() => globalThis.crypto.randomUUID()),
    secrets: options.secrets ?? [],
    program: {
      commands: {
        self: {
          humanSuccess: true,
          humanText: () => text,
          handler: () => ({ data: {} }),
        },
      },
    },
  });

/**
 * Run one entrypoint invocation in process and return the exit code.
 *
 * Help and version return before the composer runs; the composer is only
 * invoked for a real command, so the self-description surface performs no
 * ambient read.
 */
export const runEntrypoint = async (
  argv: readonly string[],
  options: EntrypointOptions,
): Promise<number> => {
  const entrypoint = createEntrypoint(options);
  const tokens = nonGlobalTokens(argv);
  const first = tokens[0];

  if (first === "--version") {
    return emitSelfDescription(versionText(entrypoint), options, entrypoint);
  }

  if (first === undefined || first === "--help") {
    return emitSelfDescription(renderRootHelp(entrypoint.brand), options, entrypoint);
  }

  const helpIndex = tokens.indexOf("--help");
  if (helpIndex >= 0) {
    const path = tokens.slice(0, helpIndex);
    const help = helpEntryFor(path);
    if (help !== undefined) {
      return emitSelfDescription(renderHelp(help, entrypoint.brand), options, entrypoint);
    }
    // An unknown path falls through to the classified composition failure.
  }

  const command = first;
  const composed = (() => {
    try {
      return selectPromptRequiredProgram(entrypoint.composeProgram(entrypoint.brand));
    } catch {
      // A composition gap is reported as the containment identity, never as a
      // silent success or an unclassified crash.
      return { commands: {} };
    }
  })();

  const program = isUnusableCommand(composed, command)
    ? { commands: { [command]: uncomposedDefinition(command) } }
    : composed;

  return runCli(argv, options.streams, dependenciesFor(options, entrypoint, program));
};

/** The help inventory rendered for the current brand (used by coverage checks). */
export const helpInventory = (): readonly { readonly path: readonly string[] }[] =>
  allHelpEntries().map((help) => ({ path: help.path }));

/** A machine-visible version envelope helper for hosts that need one. */
export const versionData = (
  entrypoint: Entrypoint,
): { readonly binaryName: string; readonly version: string; readonly build: string } => ({
  binaryName: entrypoint.brand.binaryName,
  version: entrypoint.version,
  build: entrypoint.build,
});

export type { CommandResult };
