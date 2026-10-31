/**
 * `provider` command — `resolve`, `quota`, and `parks list` (GH-182 F-8).
 *
 * Pure and stream-free: the handler validates grammar, delegates to injected
 * runtime methods, and returns one data/error object. The CLI edge owns streams,
 * envelopes, redaction, and exit projection. No path sleeps or spawns.
 */
import type {
  ProviderEngineResult,
  ProviderParkView,
  ProviderResolveResult,
  StateResult,
} from "@delivery-os/core/contracts";
import type { CommandDefinition } from "../index.js";

export type ProviderRuntimeFailure = {
  readonly ok: false;
  readonly code: string;
  readonly summary: string;
};

export type ProviderCommandRuntime = {
  readonly resolve: (input: {
    readonly chainName?: string;
  }) => Promise<ProviderResolveResult | ProviderRuntimeFailure>;
  readonly quota: (input: {
    readonly providerName?: string;
  }) => Promise<ProviderEngineResult | ProviderRuntimeFailure>;
  readonly parks: (input: {
    readonly all?: boolean;
    readonly providerName?: string;
  }) => StateResult<readonly ProviderParkView[]>;
};

type Grammar =
  | { readonly kind: "resolve"; readonly chainName?: string }
  | { readonly kind: "quota"; readonly providerName?: string }
  | {
      readonly kind: "parks-list";
      readonly all: boolean;
      readonly providerName?: string;
    };

const invocationError = (summary: string): { readonly error: Record<string, unknown> } => ({
  error: { kind: "input", code: "input.value.rejected", summary },
});

const stringFlag = (flags: Readonly<Record<string, string | true>>, name: string) => {
  const value = flags[name];
  return typeof value === "string" ? value : undefined;
};

const grammarOf = (
  positionals: readonly string[],
  flags: Readonly<Record<string, string | true>>,
): Grammar | { readonly error: Record<string, unknown> } => {
  const [subcommand, second, ...rest] = positionals;
  if (subcommand === undefined) return invocationError("provider requires a subcommand");
  if (subcommand === "resolve") {
    if (second !== undefined || rest.length > 0)
      return invocationError("resolve takes no positional");
    if (flags["--provider"] !== undefined || flags["--all"] !== undefined) {
      return invocationError("resolve accepts only --chain");
    }
    return {
      kind: "resolve",
      ...(stringFlag(flags, "--chain") === undefined
        ? {}
        : { chainName: stringFlag(flags, "--chain") as string }),
    };
  }
  if (subcommand === "quota") {
    if (second !== undefined || rest.length > 0)
      return invocationError("quota takes no positional");
    if (flags["--chain"] !== undefined || flags["--all"] !== undefined) {
      return invocationError("quota accepts only --provider");
    }
    const providerName = stringFlag(flags, "--provider");
    return { kind: "quota", ...(providerName === undefined ? {} : { providerName }) };
  }
  if (subcommand === "parks") {
    if (second !== "list" || rest.length > 0) {
      return invocationError('provider parks requires the "list" subcommand');
    }
    if (flags["--chain"] !== undefined)
      return invocationError("parks list accepts only --all and --provider");
    const providerName = stringFlag(flags, "--provider");
    return {
      kind: "parks-list",
      all: flags["--all"] === true,
      ...(providerName === undefined ? {} : { providerName }),
    };
  }
  return invocationError(`unknown provider subcommand "${subcommand}"`);
};

const providerError = (
  code: string,
  summary: string,
): { readonly error: Record<string, unknown> } => ({
  error: {
    kind: code.startsWith("config.") ? "config" : "provider",
    code,
    summary,
  },
});

const withAnnouncement = (summary: string, announcementCode?: string): string =>
  announcementCode === undefined ? summary : `${summary} [${announcementCode}]`;

export const createProviderCommandDefinition = (
  runtime: ProviderCommandRuntime,
): CommandDefinition => ({
  flags: ["--all"],
  requiresValue: ["--chain", "--provider"],
  positionals: { max: 2 },
  humanSuccess: true,
  handler: async ({ flags, positionals }) => {
    const grammar = grammarOf(positionals, flags);
    if ("error" in grammar) return grammar;

    if (grammar.kind === "resolve") {
      const result = await runtime.resolve(
        grammar.chainName === undefined ? {} : { chainName: grammar.chainName },
      );
      if (!result.ok) {
        const code = "errorCode" in result ? result.errorCode : result.code;
        const announcement = "announcementCode" in result ? result.announcementCode : undefined;
        return providerError(code, withAnnouncement(result.summary, announcement));
      }
      const summary =
        result.decision.kind === "selected"
          ? `selected ${result.decision.providerName} (${result.decision.costClass})`
          : `parked ${result.decision.park.name} (${result.decision.park.cause}) until ${result.decision.park.expiresAt}`;
      return {
        data: {
          summary,
          chain: result.chainName,
          decision: result.decision,
          skipped: result.skipped,
          parks: result.parks,
          announcements: result.announcements,
        },
        ...(result.announcements
          .filter((entry) => entry.severity === "warning")
          .map((entry) => entry.message).length > 0
          ? {
              warnings: result.announcements
                .filter((entry) => entry.severity === "warning")
                .map((entry) => entry.message),
            }
          : {}),
      };
    }

    if (grammar.kind === "quota") {
      const result = await runtime.quota(
        grammar.providerName === undefined ? {} : { providerName: grammar.providerName },
      );
      if (!result.ok) {
        const code = "errorCode" in result ? result.errorCode : result.code;
        const announcement = "announcementCode" in result ? result.announcementCode : undefined;
        return providerError(code, withAnnouncement(result.summary, announcement));
      }
      return {
        data: { providers: result.providers, announcements: result.announcements },
        ...(result.announcements
          .filter((entry) => entry.severity === "warning")
          .map((entry) => entry.message).length > 0
          ? {
              warnings: result.announcements
                .filter((entry) => entry.severity === "warning")
                .map((entry) => entry.message),
            }
          : {}),
      };
    }

    const result = runtime.parks(
      grammar.providerName === undefined
        ? { all: grammar.all }
        : { all: grammar.all, providerName: grammar.providerName },
    );
    if (!result.ok) return { error: { ...result.error } };
    return { data: { parks: result.value } };
  },
});
