/**
 * `provider` command — `resolve`, `quota`, `parks list`, `profile resolve`, and
 * `watch status` (GH-182 F-8; GH-234 F-9).
 *
 * Pure and stream-free: the handler validates grammar, delegates to injected
 * runtime methods, and returns one data/error object. The CLI edge owns streams,
 * envelopes, redaction, and exit projection. No path sleeps or spawns.
 */
import type {
  EnvRecord,
  ProfileEligibility,
  ProfileEvent,
  ProfileSelectionResult,
  ProviderEngineResult,
  ProviderParkView,
  ProviderResolveResult,
  ProviderWatchConditionView,
  StateResult,
} from "@delivery-os/core/contracts";
import type { CommandDefinition } from "../index.js";

export type ProviderRuntimeFailure = {
  readonly ok: false;
  readonly code: string;
  readonly summary: string;
};

export type ProviderProfileResolveInput = {
  readonly agent?: string;
  readonly forSpawn?: boolean;
  readonly namePrefix?: string;
};

export type ProviderWatchStatusOutcome =
  | {
      readonly ok: true;
      readonly providers: readonly ProviderWatchConditionView[];
    }
  | ProviderRuntimeFailure;

export type ProviderCommandRuntime = {
  readonly resolve: (input: {
    readonly chainName?: string;
    readonly profile?: string;
  }) => Promise<ProviderResolveResult | ProviderRuntimeFailure>;
  readonly quota: (input: {
    readonly providerName?: string;
  }) => Promise<ProviderEngineResult | ProviderRuntimeFailure>;
  readonly parks: (input: {
    readonly all?: boolean;
    readonly providerName?: string;
  }) => StateResult<readonly ProviderParkView[]>;
  readonly profileResolve?: (
    input: ProviderProfileResolveInput,
  ) => Promise<ProfileSelectionResult | ProviderRuntimeFailure>;
  readonly watchStatus?: (input: {
    readonly providerName?: string;
  }) => Promise<ProviderWatchStatusOutcome>;
};

type Grammar =
  | { readonly kind: "resolve"; readonly chainName?: string; readonly profile?: string }
  | { readonly kind: "quota"; readonly providerName?: string }
  | {
      readonly kind: "parks-list";
      readonly all: boolean;
      readonly providerName?: string;
    }
  | {
      readonly kind: "profile-resolve";
      readonly agent?: string;
      readonly forSpawn: boolean;
    }
  | { readonly kind: "watch-status"; readonly providerName?: string };

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
      return invocationError("resolve accepts only --chain and --profile");
    }
    if (flags["--agent"] !== undefined || flags["--for-spawn"] !== undefined) {
      return invocationError("resolve accepts only --chain and --profile");
    }
    const chainName = stringFlag(flags, "--chain");
    const profile = stringFlag(flags, "--profile");
    return {
      kind: "resolve",
      ...(chainName === undefined ? {} : { chainName }),
      ...(profile === undefined ? {} : { profile }),
    };
  }
  if (subcommand === "quota") {
    if (second !== undefined || rest.length > 0)
      return invocationError("quota takes no positional");
    if (flags["--chain"] !== undefined || flags["--all"] !== undefined) {
      return invocationError("quota accepts only --provider");
    }
    if (flags["--profile"] !== undefined || flags["--agent"] !== undefined) {
      return invocationError("quota accepts only --provider");
    }
    const providerName = stringFlag(flags, "--provider");
    return { kind: "quota", ...(providerName === undefined ? {} : { providerName }) };
  }
  if (subcommand === "parks") {
    if (second !== "list" || rest.length > 0) {
      return invocationError('provider parks requires the "list" subcommand');
    }
    if (flags["--chain"] !== undefined || flags["--profile"] !== undefined) {
      return invocationError("parks list accepts only --all and --provider");
    }
    const providerName = stringFlag(flags, "--provider");
    return {
      kind: "parks-list",
      all: flags["--all"] === true,
      ...(providerName === undefined ? {} : { providerName }),
    };
  }
  if (subcommand === "profile") {
    if (second !== "resolve") {
      return invocationError('provider profile requires the "resolve" subcommand');
    }
    if (rest.length > 0) return invocationError("profile resolve takes no positional");
    if (
      flags["--chain"] !== undefined ||
      flags["--provider"] !== undefined ||
      flags["--all"] !== undefined
    ) {
      return invocationError("profile resolve accepts only --agent and --for-spawn");
    }
    if (flags["--for-spawn"] !== undefined && flags["--for-spawn"] !== true) {
      return invocationError("--for-spawn takes no value");
    }
    const agent = stringFlag(flags, "--agent");
    return {
      kind: "profile-resolve",
      forSpawn: flags["--for-spawn"] === true,
      ...(agent === undefined ? {} : { agent }),
    };
  }
  if (subcommand === "watch") {
    if (second !== "status") {
      return invocationError('provider watch requires the "status" subcommand');
    }
    if (rest.length > 0) return invocationError("watch status takes no positional");
    if (
      flags["--chain"] !== undefined ||
      flags["--all"] !== undefined ||
      flags["--agent"] !== undefined ||
      flags["--for-spawn"] !== undefined
    ) {
      return invocationError("watch status accepts only --provider");
    }
    const providerName = stringFlag(flags, "--provider");
    return { kind: "watch-status", ...(providerName === undefined ? {} : { providerName }) };
  }
  return invocationError(`unknown provider subcommand "${subcommand}"`);
};

const providerError = (
  code: string,
  summary: string,
): { readonly error: Record<string, unknown> } => ({
  error: {
    kind: code.startsWith("config.") ? "config" : code.startsWith("input.") ? "input" : "provider",
    code,
    summary,
  },
});

const withAnnouncement = (summary: string, announcementCode?: string): string =>
  announcementCode === undefined ? summary : `${summary} [${announcementCode}]`;

type ProfileResolveData = {
  readonly outcome: "selected" | "switched" | "reverted" | "refused";
  readonly code?: string;
  readonly profile?: string;
  readonly tier?: string;
  readonly rung?: string;
  readonly agentOverrides?: Readonly<Record<string, string>>;
  readonly eligibility: readonly ProfileEligibility[];
  readonly events: readonly ProfileEvent[];
  readonly envRecord?: EnvRecord;
  readonly summary: string;
};

const isProfileResolveData = (value: unknown): value is ProfileResolveData => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { readonly outcome?: unknown; readonly eligibility?: unknown };
  return (
    (candidate.outcome === "selected" ||
      candidate.outcome === "switched" ||
      candidate.outcome === "reverted" ||
      candidate.outcome === "refused") &&
    Array.isArray(candidate.eligibility)
  );
};

const isWatchConditionView = (value: unknown): value is ProviderWatchConditionView => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.condition === "string" &&
    typeof candidate.source === "string" &&
    typeof candidate.checkedAt === "string"
  );
};

const isWatchStatusData = (
  value: unknown,
): value is { readonly providers: readonly ProviderWatchConditionView[] } => {
  if (typeof value !== "object" || value === null) return false;
  const providers = (value as { readonly providers?: unknown }).providers;
  return Array.isArray(providers) && providers.every(isWatchConditionView);
};

export const createProviderCommandDefinition = (
  runtime: ProviderCommandRuntime,
): CommandDefinition => ({
  flags: ["--all", "--for-spawn"],
  requiresValue: ["--chain", "--provider", "--profile", "--agent"],
  positionals: { max: 3 },
  humanSuccess: true,
  exitProjection: (data) =>
    isProfileResolveData(data) && data.outcome === "refused" ? "platform-provider" : "success",
  humanText: (data) => {
    if (isWatchStatusData(data)) {
      return data.providers
        .map((provider) => `${provider.name}: ${provider.condition} (${provider.source})`)
        .join("\n");
    }
    if (isProfileResolveData(data)) {
      if (data.outcome === "refused") return `profile refused: ${data.summary}`;
      const rung = data.rung === undefined ? "" : `, rung ${data.rung}`;
      return `profile ${data.profile ?? "?"} (tier ${data.tier ?? "?"}${rung})`;
    }
    return undefined;
  },
  handler: async ({ flags, positionals, brand }) => {
    const grammar = grammarOf(positionals, flags);
    if ("error" in grammar) return grammar;

    if (grammar.kind === "resolve") {
      const result = await runtime.resolve({
        ...(grammar.chainName === undefined ? {} : { chainName: grammar.chainName }),
        ...(grammar.profile === undefined ? {} : { profile: grammar.profile }),
      });
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
          ...(grammar.profile === undefined ? {} : { profile: grammar.profile }),
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

    if (grammar.kind === "profile-resolve") {
      if (runtime.profileResolve === undefined) {
        return providerError(
          "input.value.rejected",
          "provider profile resolve is not wired on this surface",
        );
      }
      const result = await runtime.profileResolve({
        ...(grammar.agent === undefined ? {} : { agent: grammar.agent }),
        ...(grammar.forSpawn ? { forSpawn: true } : {}),
        namePrefix: brand.environmentPrefix,
      });
      if (!result.ok) {
        if ("eligibility" in result && result.code === "provider.profile.unavailable") {
          // Fail-closed selection: a successful envelope carrying the full
          // eligibility list, projected to exit 2 by the command definition.
          return {
            data: {
              outcome: "refused",
              code: result.code,
              summary: result.summary,
              eligibility: result.eligibility,
              events: result.events,
            } satisfies ProfileResolveData,
          };
        }
        return providerError(result.code, result.summary);
      }
      const data: ProfileResolveData = {
        outcome: result.outcome,
        profile: result.decision.profile,
        tier: result.decision.tier,
        rung: result.decision.rung,
        agentOverrides: result.decision.agentOverrides,
        eligibility: result.decision.eligibility,
        events: result.events,
        ...(result.decision.envRecord === undefined
          ? {}
          : { envRecord: result.decision.envRecord }),
        summary: `resolved ${result.decision.profile} (${result.outcome})`,
      };
      return { data };
    }

    if (grammar.kind === "watch-status") {
      if (runtime.watchStatus === undefined) {
        return providerError(
          "input.value.rejected",
          "provider watch status is not wired on this surface",
        );
      }
      const result = await runtime.watchStatus(
        grammar.providerName === undefined ? {} : { providerName: grammar.providerName },
      );
      if (!result.ok) return providerError(result.code, result.summary);
      return { data: { providers: result.providers } };
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
