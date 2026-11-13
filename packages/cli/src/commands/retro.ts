/**
 * The `retro collect|report [--level <name>]` command definition (GH-232 F-1,
 * F-5, F-8; DEC-5).
 *
 * The handler owns the subcommand grammar, the `--level` value grammar, and the
 * declared-level validation before any runtime call. It performs no stream
 * write, chooses no exit code, and never inspects `--json`. The shared parser
 * classifies undeclared flags (`--ref`) as `fallback.invocation`.
 */
import {
  type BrandIdentity,
  RETRO_DEFAULT_LEVEL,
  RETRO_IMPLEMENTED_LEVELS,
  RETRO_LEVEL_NAMES,
  RETRO_LEVEL_OWNING_STORIES,
  type RetroCollectSummary,
  type RetroCommandData,
  type RetroCommandOutcome,
  type RetroCommandRuntime,
  type RetroFailure,
  type RetroLevelName,
  type RetroReportData,
} from "@delivery-os/core/contracts";
import type { CommandDefinition } from "../index.js";

export type { RetroCommandRuntime } from "@delivery-os/core/contracts";

type RetroHandlerError = RetroFailure & { readonly partial?: string };

const isRetroSubcommand = (value: string | undefined): value is "collect" | "report" =>
  value === "collect" || value === "report";

const isDeclaredLevel = (value: string): value is RetroLevelName =>
  (RETRO_LEVEL_NAMES as readonly string[]).includes(value);

const isImplemented = (value: RetroLevelName): boolean =>
  (RETRO_IMPLEMENTED_LEVELS as readonly string[]).includes(value);

const reject = (detail: string): { readonly error: RetroFailure } => ({
  error: {
    kind: "input",
    code: "input.value.rejected",
    consequence: "not_landed",
    summary: `retro: ${detail}`,
  },
});

const outcomeToHandler = (
  outcome: RetroCommandOutcome,
): { readonly data: RetroCommandData } | { readonly error: RetroHandlerError } =>
  outcome.ok
    ? { data: outcome.data }
    : {
        error:
          outcome.partial === undefined
            ? outcome.error
            : { ...outcome.error, partial: outcome.partial },
      };

const collectHuman = (data: RetroCollectSummary): string => {
  if (data.outcome === "no-target") {
    return `retro: no eligible ${data.level} target (${data.selection.reason ?? "empty selection"})\n`;
  }
  const scope = data.selection.changeRef ?? "unknown";
  return `retro: collected ${String(data.counts.collected)} item(s) for ${data.level} (${scope})\n`;
};

const reportHuman = (data: RetroReportData): string => {
  const lines = [`retro report: ${data.level}`];
  if (data.findings.length === 0) {
    lines.push("findings: none (verified-empty)");
  } else {
    lines.push(`findings: ${String(data.findings.length)}`);
    for (const finding of data.findings) {
      lines.push(`- [${finding.kind}] ${finding.text}`);
    }
  }
  lines.push(`follow-through: ${String(data.followThrough.length)}`);
  for (const entry of data.followThrough) {
    lines.push(`- ${entry.action}: ${entry.verdict}`);
  }
  const spendCitation = data.spend;
  if (spendCitation !== undefined) {
    if (spendCitation.state === "absent") {
      lines.push("spend: absent (spend.telemetry-absent; no captured telemetry)");
    } else {
      const total =
        spendCitation.tokensByClass.input +
        spendCitation.tokensByClass.output +
        spendCitation.tokensByClass.reasoning +
        spendCitation.tokensByClass.cacheRead +
        spendCitation.tokensByClass.cacheWrite;
      const roles = spendCitation.roles
        .map((entry) => `${entry.role}:${String(entry.tokens)}`)
        .join(", ");
      const models = spendCitation.models
        .map((entry) => `${entry.model}:${String(entry.tokens)}`)
        .join(", ");
      const timing = spendCitation.timing
        .map(
          (entry) =>
            `${entry.phase}:${entry.durationMs === null ? "open" : `${String(entry.durationMs)}ms`}`,
        )
        .join(", ");
      lines.push(`spend: present total ${String(total)} tokens`);
      lines.push(`- roles ${roles || "none"}`);
      lines.push(`- models ${models || "none"}`);
      lines.push(`- timing ${timing || "none"}`);
      lines.push(
        spendCitation.reconciliation === undefined
          ? "- reconcile unavailable"
          : `- reconcile ${spendCitation.reconciliation.verdict} (tolerance ${String(spendCitation.reconciliation.tolerance)}, basis ${spendCitation.reconciliation.basis})`,
      );
    }
  }
  lines.push(`evidence: ${data.evidenceRefs.join(", ")}`);
  return `${lines.join("\n")}\n`;
};

const renderHuman = (data: RetroCommandData): string =>
  "outcome" in data ? collectHuman(data) : reportHuman(data);

const renderFailure = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null) return undefined;
  const partial = (error as { readonly partial?: unknown }).partial;
  return typeof partial === "string" && partial.length > 0 ? `${partial}\n` : undefined;
};

/** Build the retro command definition over the injected runtime. */
export const createRetroCommandDefinition = (runtime: RetroCommandRuntime): CommandDefinition => ({
  flags: ["--level"],
  positionals: { max: 8 },
  humanText: (data: unknown, _brand: BrandIdentity): string | undefined =>
    renderHuman(data as RetroCommandData),
  humanFailureText: (error: unknown): string | undefined => renderFailure(error),
  handler: async (invocation) => {
    const tokens = invocation.argv;
    const subcommand = tokens[1];
    if (!isRetroSubcommand(subcommand)) {
      return reject(
        subcommand === undefined ? "missing subcommand" : `unknown subcommand "${subcommand}"`,
      );
    }
    let level: RetroLevelName = RETRO_DEFAULT_LEVEL;
    for (let index = 2; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (token === undefined) continue;
      if (token !== "--level") {
        return reject(`unexpected positional "${token}"`);
      }
      const value = tokens[index + 1];
      if (value === undefined || value.startsWith("--")) {
        return reject('missing value for "--level"');
      }
      index += 1;
      if (!isDeclaredLevel(value)) {
        return reject(`unknown level "${value}"; declared levels: ${RETRO_LEVEL_NAMES.join(", ")}`);
      }
      if (!isImplemented(value)) {
        return reject(
          `level "${value}" is declared but not implemented; owning story: ${RETRO_LEVEL_OWNING_STORIES[value]}`,
        );
      }
      level = value;
    }
    const outcome =
      subcommand === "collect" ? await runtime.collect({ level }) : await runtime.report({ level });
    return outcomeToHandler(outcome);
  },
});
