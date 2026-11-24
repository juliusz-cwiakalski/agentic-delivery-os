/**
 * The executable entrypoint (GH-242 F-1, DEC-13, DEC-14).
 *
 * Resolves the working name once (typed configuration → non-empty
 * `DELIVERY_OS_WORKING_NAME` override → the invoking bin's declared default),
 * renders root/command help, version, and the install path with no state,
 * network, git, or configuration read, composes exactly the prompt-required
 * command set, and fails closed through the existing `fallback.internal`
 * containment identity for an invocation outside that set. It never invokes
 * `process.exit`.
 */

import { resolveCredentialSourceKey } from "@delivery-os/adapters/credentials";
import { resolveBrandIdentity } from "@delivery-os/core/branding";
import {
  type BrandIdentity,
  type CommandResult,
  type CredentialReference,
  FALLBACK_INTERNAL_CODE,
  PRE_FREEZE_WORKING_NAME_ENVIRONMENT_VARIABLE,
  PRIOR_WORKING_NAME_ENVIRONMENT_VARIABLE,
  resolveWorkingNameOverride,
} from "@delivery-os/core/contracts";
import { type BuildIdentity, buildTokenOf, fallbackVersion } from "./build-identity.js";
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
  createSecretRegistry,
  runCli,
  type SecretRegistry,
} from "./index.js";

/** The prior-identity working-name override's variable name. */
const WORKING_NAME_ENVIRONMENT = PRIOR_WORKING_NAME_ENVIRONMENT_VARIABLE;

/** The prior-identity working-name environment variable name. */
export const workingNameEnvironmentVariable = (): string => WORKING_NAME_ENVIRONMENT;

/** The three declared override variables: current, prior and pre-freeze. */
export const workingNameEnvironmentVariables = (environmentPrefix: string): readonly string[] => [
  `${environmentPrefix}WORKING_NAME`,
  PRIOR_WORKING_NAME_ENVIRONMENT_VARIABLE,
  PRE_FREEZE_WORKING_NAME_ENVIRONMENT_VARIABLE,
];

export { PROMPT_REQUIRED_COMMANDS, type PromptRequiredCommand };

/**
 * The invocation fact the entrypoint hands the composer (GH-288 F-3, DEC-5;
 * GH-309 F-3).
 *
 * The composition root needs the command token and the group-scope fact for
 * exactly one decision: a read-only surface must not run store-opening
 * maintenance. The group surface (`projects list`) and the flat record set
 * (`repos list`) are list reads, and the group-scoped `queue`/`status` forms
 * (`--project`) are likewise read-only. No other behaviour may branch on it.
 *
 * `runId` is the invocation's one run identity: the composer wires it into
 * capture paths that must join the command-audit ledger, and `runCli` records
 * the same value on the envelope and the audit invocation.
 */
export type EntrypointInvocationFact = {
  readonly command: string;
  readonly runId?: string;
  /** True when the invocation selects a group (`queue`/`status --project`). */
  readonly groupScoped: boolean;
  /** The invoking bin's declared prior identity, when it declares one. */
  readonly priorWorkingName?: string;
  /**
   * The one registered credential set for this invocation (GH-354 AC-F4-7).
   *
   * The entrypoint resolves the declared credential references against the
   * injected environment exactly once and hands the SAME values to the
   * serializer and to the composition root, so a surface that redacts before
   * bounding (the operator `last-message` read) cannot see an empty set while
   * the egress path sees the real one. No second discovery algorithm exists for
   * this operator/credential set: `registerEdgeSecrets` in the edge is the
   * separate lookup that still feeds `blockers` and `steer`, and it is not a
   * second discovery path for the values handed here.
   */
  readonly registeredSecrets?: readonly string[];
  /**
   * The composition-scoped notice sink: every queued warning line the
   * composition would attach to a handler's outcome is also reported here, so a
   * composition that fails before returning a program still lets the entrypoint
   * deliver the lines it already produced (GH-320 F-1, AC-F5-6).
   */
  readonly onCompositionNotice?: (notice: string) => void;
};

/**
 * Composes the prompt-required program; help/version never calls it.
 *
 * The return widens additively to a promise so composition may await one
 * edge-time decision (the transport selection) at the one invocation boundary.
 * Every delivered synchronous injector keeps compiling.
 */
export type EntrypointComposer = (
  brand: BrandIdentity,
  invocation?: EntrypointInvocationFact,
) => CommandProgram | Promise<CommandProgram>;

/** Injected entrypoint facts; every dynamic value arrives through options. */
export type EntrypointOptions = {
  readonly streams: CliStreams;
  readonly environment: Readonly<Record<string, string | undefined>>;
  /**
   * The invoking bin's declared default working name: the required identity
   * floor. It is never optional-with-a-default, so no neutral identity can be
   * reintroduced here.
   */
  readonly declaredWorkingName: string;
  /** The invoking bin's declared prior identity, when it declares one. */
  readonly priorWorkingName?: string;
  /** The working name already resolved from typed configuration, when present. */
  readonly configuredWorkingName?: string;
  /** The composition root for prompt-required commands. */
  readonly composeProgram: EntrypointComposer;
  /**
   * The build identity injected by the compiled artifact (F-2, DM-1).
   *
   * Absent in every workspace run, test, and embedder, which keeps the
   * delivered `0.0.0`/`dev` fallback verbatim. The injected object is the one
   * identity source: it supersedes the delivered `version`/`build` inputs.
   */
  readonly buildIdentity?: BuildIdentity;
  readonly version?: string;
  readonly build?: string;
  readonly clock?: CliDependencies["clock"];
  readonly newRunId?: () => string;
  readonly secrets?: readonly string[];
  /** Declared credential references whose resolved values are redacted. */
  readonly credentialReferences?: readonly CredentialReference[];
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

const DEFAULT_VERSION = fallbackVersion();
const DEFAULT_BUILD = buildTokenOf(undefined);

/**
 * Resolve the working name in declared order. A present, non-empty configured
 * name wins; otherwise the invoking bin's declared default is the floor. The
 * override is applied by the resolver, which gives it precedence.
 */
export const resolveWorkingName = (options: {
  readonly configuredWorkingName?: string;
  readonly declaredWorkingName?: string;
}): string | undefined => {
  const configured = options.configuredWorkingName;
  if (configured !== undefined && configured.length > 0) return configured;
  const declared = options.declaredWorkingName;
  if (declared !== undefined && declared.length > 0) return declared;
  return undefined;
};

/**
 * Resolve the brand outcome for the entrypoint (pure; reads only the injected
 * facts). An unusable name or override falls back for self-description to the
 * invoking bin's declared default, then to the configured name; when no usable
 * identity exists at all the outcome carries no brand, so the caller fails
 * closed through the containment identity instead of inventing a name.
 */
const entrypointBrandOutcome = (options: {
  readonly configuredWorkingName?: string;
  readonly declaredWorkingName?: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
}): { readonly ok: true; readonly brand: BrandIdentity } | { readonly ok: false } => {
  const workingName = resolveWorkingName(options);
  if (workingName === undefined) return { ok: false };
  const base = resolveBrandIdentity({ workingName });
  if (!base.ok) {
    for (const candidate of [options.declaredWorkingName, options.configuredWorkingName]) {
      if (candidate === undefined || candidate.length === 0) continue;
      const resolvedCandidate = resolveBrandIdentity({ workingName: candidate });
      if (resolvedCandidate.ok) return { ok: true, brand: resolvedCandidate.value };
    }
    return { ok: false };
  }
  const resolution = resolveWorkingNameOverride({
    environment: options.environment,
    environmentPrefix: base.value.environmentPrefix,
  });
  const branded = resolveBrandIdentity(
    resolution.override === undefined
      ? { workingName }
      : { workingName, override: resolution.override },
  );
  if (branded.ok) return { ok: true, brand: branded.value };
  // A present-but-invalid override must not fall back to a lower-precedence
  // channel. Self-description answers the declared identity (the delivered
  // behaviour); a configuration-bearing command fails closed because the
  // composition re-reads the invalid override and returns the containment.
  if (resolution.override !== undefined) return { ok: true, brand: base.value };
  for (const candidate of [options.declaredWorkingName, options.configuredWorkingName]) {
    if (candidate === undefined || candidate.length === 0) continue;
    const resolvedCandidate = resolveBrandIdentity({ workingName: candidate });
    if (resolvedCandidate.ok) return { ok: true, brand: resolvedCandidate.value };
  }
  return { ok: false };
};

/** Resolve the brand for the entrypoint; throws only when no identity exists. */
export const resolveEntrypointBrand = (options: {
  readonly configuredWorkingName?: string;
  readonly declaredWorkingName?: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
}): BrandIdentity => {
  const outcome = entrypointBrandOutcome(options);
  if (!outcome.ok) throw new Error("no declared working identity is available");
  return outcome.brand;
};

const isGlobalFlag = (token: string): boolean =>
  token === "--json" || token === "--verbose" || token === "--pretty";

const nonGlobalTokens = (argv: readonly string[]): readonly string[] =>
  argv.filter((token) => !isGlobalFlag(token));

/**
 * Whether the invocation is a group-scoped read (GH-309 F-3): the additive
 * `queue list --project` and `status --project` forms read per-checkout state
 * and must not maintain the host index.
 */
const isGroupScopedInvocation = (command: string, argv: readonly string[]): boolean =>
  (command === "queue" || command === "status") && argv.includes("--project");

/** Build the entrypoint surface without composing any command runtime. */
export const createEntrypoint = (options: EntrypointOptions): Entrypoint => ({
  brand: resolveEntrypointBrand(options),
  version: options.buildIdentity?.version ?? options.version ?? DEFAULT_VERSION,
  build:
    options.buildIdentity === undefined
      ? (options.build ?? DEFAULT_BUILD)
      : buildTokenOf(options.buildIdentity),
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

/**
 * A classified containment failure naming the missing composition.
 *
 * `notices` carries the composition-scoped warning lines already produced before
 * the failure: a prior-identity fallback read is reported even when composition
 * then fails and the containment identity answers instead (GH-320 F-1,
 * AC-F5-6). The delivered warnings channel writes them to stderr, never into the
 * payload, and the exit projection is untouched.
 */
export const uncomposedDefinition = (
  command: string,
  notices: readonly string[] = [],
): CommandDefinition => ({
  handler: () => ({
    error: {
      kind: "fallback" as const,
      code: FALLBACK_INTERNAL_CODE,
      summary: `command "${command}" is not part of the composed prompt-required set`,
    },
    ...(notices.length === 0 ? {} : { warnings: notices }),
  }),
});

const versionText = (entrypoint: Entrypoint): string =>
  `${entrypoint.brand.binaryName} ${entrypoint.version} (build ${entrypoint.build})\n`;

const isUnusableCommand = (program: CommandProgram, command: string): boolean =>
  program.commands[command] === undefined;

/**
 * Register the declared truth-read keys for redaction from the injected
 * environment and the declared references only. An absent or empty value is not
 * registered; no ambient environment read is added.
 */
const entrypointSecrets = (options: EntrypointOptions, brand: BrandIdentity): readonly string[] => {
  const values = new Set<string>(options.secrets ?? []);
  for (const reference of options.credentialReferences ?? []) {
    const key = resolveCredentialSourceKey(reference, brand);
    const value = options.environment[key];
    if (typeof value === "string" && value.length > 0) values.add(value);
  }
  return [...values];
};

const dependenciesFor = (
  options: EntrypointOptions,
  entrypoint: Entrypoint,
  program: CommandProgram,
  runId: string,
  secrets: SecretRegistry,
): CliDependencies => ({
  brand: entrypoint.brand,
  clock: options.clock ?? { now: () => Date.now() },
  // The invocation's one run identity: generated once here so the composed
  // capture paths and the audit record share it.
  newRunId: () => runId,
  secrets,
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
    secrets: createSecretRegistry(options.secrets ?? []),
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
/**
 * A containment-only brand for the no-identity path.
 *
 * The absence of the required declared default is reported through the
 * delivered containment identity; this label exists only so the delivered
 * diagnostic and serialization path can run. It is not an invented working
 * name and it is never selected as an identity.
 */
const containmentBrand = (): BrandIdentity => {
  const branded = resolveBrandIdentity({ workingName: FALLBACK_INTERNAL_CODE });
  if (!branded.ok) throw new Error("the containment identity is unusable");
  return branded.value;
};

/** Emit the containment identity for an invocation that declares no identity. */
const emitNoIdentityContainment = (
  requested: string | undefined,
  options: EntrypointOptions,
  emitEnvelope: boolean,
): Promise<number> =>
  runCli(emitEnvelope ? ["self", "--json"] : ["self"], options.streams, {
    brand: containmentBrand(),
    clock: options.clock ?? { now: () => Date.now() },
    newRunId: options.newRunId ?? (() => globalThis.crypto.randomUUID()),
    secrets: createSecretRegistry(options.secrets ?? []),
    program: {
      commands: {
        self: {
          handler: () => ({
            error: {
              kind: "fallback" as const,
              code: FALLBACK_INTERNAL_CODE,
              summary:
                requested === undefined
                  ? "no declared working identity is available for this invocation"
                  : `command "${requested}" is not part of the composed prompt-required set: ` +
                    "no declared working identity is available for this invocation",
            },
          }),
        },
      },
    },
  });

export const runEntrypoint = async (
  argv: readonly string[],
  options: EntrypointOptions,
): Promise<number> => {
  const tokens = nonGlobalTokens(argv);
  const first = tokens[0];
  if (!entrypointBrandOutcome(options).ok) {
    return emitNoIdentityContainment(first, options, argv.includes("--json"));
  }
  const entrypoint = createEntrypoint(options);

  if (first === "--version") {
    return emitSelfDescription(versionText(entrypoint), options, entrypoint);
  }

  if (first === "--print-install-path") {
    return emitSelfDescription(`${entrypoint.brand.installPath}\n`, options, entrypoint);
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

  // A command-scoped `--version` is the same identity-only answer as the root
  // form, but only for a KNOWN command with `--version` as its immediate next
  // token (F-2). An unknown leading command falls through to the classified
  // composition failure, and a positional keeps `fallback.invocation` at exit 1.
  const versionIndex = tokens.indexOf("--version");
  if (versionIndex === 1 && helpEntryFor([first]) !== undefined) {
    return emitSelfDescription(versionText(entrypoint), options, entrypoint);
  }
  // An unknown leading command keeps its classified composition failure: the
  // self-description flag is dropped so the command's own containment answers
  // instead of a grammar refusal for the flag.
  const cliArgv =
    versionIndex === 1 && helpEntryFor([first]) === undefined
      ? argv.filter((token) => token !== "--version")
      : argv;

  const command = first;
  // One run identity per invocation, generated before composition so capture
  // paths composed for this command can join the audit ledger's record.
  const runId = (options.newRunId ?? (() => globalThis.crypto.randomUUID()))();
  // The composition-scoped notices already produced travel this sink, so a
  // composition that fails (or is discarded for an uncomposed command) still
  // reports its fallback read through the delivered warnings channel (F-1).
  const compositionNotices: string[] = [];
  // The ONE registered credential set (GH-354 AC-F4-7): the declared
  // credential references resolved against the injected environment plus any
  // injected values. The composed program receives it as an invocation fact so
  // the operator runtime redacts with the same values the serializer does.
  // The live registry (DM-7): the static environment-style registration the
  // entrypoint keeps; the resolver registers material on materialization.
  const registeredSecrets = createSecretRegistry(entrypointSecrets(options, entrypoint.brand));
  // The await stays inside the containment `try`: a rejected composition (a
  // synchronous throw or a rejected promise) yields the containment identity
  // instead of an unhandled rejection, exactly as the delivered sync path did.
  const composed = await (async (): Promise<CommandProgram> => {
    try {
      const program = await entrypoint.composeProgram(entrypoint.brand, {
        command,
        runId,
        groupScoped: isGroupScopedInvocation(command, argv),
        registeredSecrets: registeredSecrets.values(),
        ...(options.priorWorkingName === undefined
          ? {}
          : { priorWorkingName: options.priorWorkingName }),
        onCompositionNotice: (notice) => {
          compositionNotices.push(notice);
        },
      });
      return selectPromptRequiredProgram(program);
    } catch {
      // A composition gap is reported as the containment identity, never as a
      // silent success or an unclassified crash.
      return { commands: {} };
    }
  })();

  const program = isUnusableCommand(composed, command)
    ? { commands: { [command]: uncomposedDefinition(command, compositionNotices) } }
    : composed;

  return runCli(
    cliArgv,
    options.streams,
    dependenciesFor(options, entrypoint, program, runId, registeredSecrets),
  );
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
