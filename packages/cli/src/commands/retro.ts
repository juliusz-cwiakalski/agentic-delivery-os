/**
 * The `retro collect|report|action file|close|list [--level <name>]` command
 * definition (GH-232 F-1, F-5, F-8; GH-287 DEC-7).
 *
 * The handler owns the subcommand grammar, the `--level` value grammar, the
 * additive `action` verb-group grammar, and the declared-level validation before
 * any runtime call. It performs no stream write, chooses no exit code, and never
 * inspects `--json`. The shared parser classifies undeclared flags
 * (`fallback.invocation`).
 */
import {
  ACTION_FLAGS,
  ACTION_LIST_DATA_KEY,
  type BrandIdentity,
  RETRO_ACTION_VERBS,
  RETRO_DEFAULT_LEVEL,
  RETRO_IMPLEMENTED_LEVELS,
  RETRO_LEVEL_NAMES,
  RETRO_LEVEL_OWNING_STORIES,
  type RetroActionCloseData,
  type RetroActionCloseRequest,
  type RetroActionCommandOutcome,
  type RetroActionCommandRuntime,
  type RetroActionDraft,
  type RetroActionFileData,
  type RetroActionListData,
  type RetroActionVerb,
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

/** The composed runtime: the delivered modes plus the additive verb group. */
export type RetroCommandRuntimeWithActions = RetroCommandRuntime & {
  readonly actions?: RetroActionCommandRuntime;
};

type RetroHandlerError = RetroFailure & { readonly partial?: string };
type ActionHandlerError = {
  readonly kind: "retro" | "input" | "state";
  readonly code: string;
  readonly consequence: "not_landed";
  readonly summary?: string;
  readonly partial?: string;
};

const isRetroSubcommand = (value: string | undefined): value is "collect" | "report" | "action" =>
  value === "collect" || value === "report" || value === "action";

const isActionVerb = (value: string | undefined): value is RetroActionVerb =>
  value !== undefined && (RETRO_ACTION_VERBS as readonly string[]).includes(value);

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

const actionOutcomeToHandler = (
  outcome: RetroActionCommandOutcome,
): { readonly data: unknown } | { readonly error: ActionHandlerError } => {
  if (outcome.ok) return { data: outcome.data };
  const summary = "summary" in outcome.error ? outcome.error.summary : undefined;
  return {
    error: {
      kind: outcome.error.kind,
      code: outcome.error.code,
      consequence: "not_landed",
      ...(summary === undefined ? {} : { summary }),
      ...(outcome.partial === undefined ? {} : { partial: outcome.partial }),
    },
  };
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

const fileHuman = (data: RetroActionFileData): string =>
  `retro action filed: ${data.actionId} owner=${data.action.owner} (${data.action.ownerKind}) verb=${data.action.verb} window=${data.action.window} due=${data.action.dueDate}\n`;

const closeHuman = (data: RetroActionCloseData): string =>
  `retro action closed: ${data.actionId} route=${data.route} ${"artifactClosure"}=${data.artifactClosure} ${"outcomeClosure"}=${data.outcomeClosure} window=${data.windowState}\n`;

const listHuman = (data: RetroActionListData): string => {
  const lines = [`retro action list: ${String(data.actions.length)} action(s)`];
  for (const row of data.actions) {
    lines.push(
      `- ${row.actionId} owner=${row.owner} level=${row.level} window=${row.window} age=${String(row.age)}ms aging=${row.agingState} ${"artifactClosure"}=${row.artifactClosure} ${"outcomeClosure"}=${row.outcomeClosure}`,
    );
  }
  for (const window of data.windows) {
    lines.push(
      `window ${window.window}: ${String(window.openCount)} open / limit ${String(window.limit)}`,
    );
  }
  return `${lines.join("\n")}\n`;
};

const renderHuman = (data: unknown): string => {
  if (typeof data !== "object" || data === null) return "";
  if (ACTION_LIST_DATA_KEY in data) return listHuman(data as RetroActionListData);
  if ("verificationWindow" in data) return closeHuman(data as RetroActionCloseData);
  if ("action" in data) return fileHuman(data as RetroActionFileData);
  return "outcome" in data
    ? collectHuman(data as RetroCollectSummary)
    : reportHuman(data as RetroReportData);
};

const renderFailure = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null) return undefined;
  const partial = (error as { readonly partial?: unknown }).partial;
  return typeof partial === "string" && partial.length > 0 ? `${partial}\n` : undefined;
};

/** One parsed flag set: every declared flag token mapped to its value. */
type ParsedFlags =
  | { readonly ok: true; readonly values: Readonly<Record<string, string>> }
  | { readonly ok: false; readonly detail: string };

const parseFlags = (
  tokens: readonly string[],
  declared: readonly string[],
  startIndex: number,
): ParsedFlags => {
  const values: Record<string, string> = {};
  for (let index = startIndex; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined) continue;
    if (!declared.includes(token)) return { ok: false, detail: `unexpected positional "${token}"` };
    const value = tokens[index + 1];
    if (value === undefined || value.startsWith("--")) {
      return { ok: false, detail: `missing value for "${token}"` };
    }
    values[token] = value;
    index += 1;
  }
  return { ok: true, values };
};

const actionDeclaredFlags = Object.values(ACTION_FLAGS);

type LevelParse =
  | { readonly ok: true; readonly level: RetroLevelName }
  | { readonly ok: false; readonly error: RetroFailure };

const parseLevel = (values: Readonly<Record<string, string>>): LevelParse => {
  const raw = values[ACTION_FLAGS.level];
  if (raw === undefined) return { ok: true, level: RETRO_DEFAULT_LEVEL };
  if (!isDeclaredLevel(raw)) {
    return {
      ok: false,
      error: reject(`unknown level "${raw}"; declared levels: ${RETRO_LEVEL_NAMES.join(", ")}`)
        .error,
    };
  }
  if (!isImplemented(raw)) {
    return {
      ok: false,
      error: reject(
        `level "${raw}" is declared but not implemented; owning story: ${RETRO_LEVEL_OWNING_STORIES[raw]}`,
      ).error,
    };
  }
  return { ok: true, level: raw };
};

/** Parse `--outcome-window <start>..<end>`; a malformed shape is refused. */
const parseWindow = (
  raw: string | undefined,
): { readonly start: string; readonly end: string } | undefined => {
  if (raw === undefined) return undefined;
  const [start, end] = raw.split("..");
  if (start === undefined || end === undefined || start.length === 0 || end.length === 0) {
    return undefined;
  }
  return { start, end };
};

const buildDraft = (
  values: Readonly<Record<string, string>>,
  level: RetroLevelName,
): RetroActionDraft | undefined => {
  const window = parseWindow(values[ACTION_FLAGS.outcomeWindow]);
  const outcomeEvidence = values[ACTION_FLAGS.outcomeEvidence];
  const draft: RetroActionDraft = {
    ...(values[ACTION_FLAGS.owner] === undefined ? {} : { owner: values[ACTION_FLAGS.owner] }),
    ...(values[ACTION_FLAGS.ownerKind] === undefined
      ? {}
      : { ownerKind: values[ACTION_FLAGS.ownerKind] }),
    ...(values[ACTION_FLAGS.verb] === undefined ? {} : { verb: values[ACTION_FLAGS.verb] }),
    ...(values[ACTION_FLAGS.measurableOutcome] === undefined
      ? {}
      : { measurableOutcome: values[ACTION_FLAGS.measurableOutcome] }),
    ...(values[ACTION_FLAGS.trackerEntry] === undefined
      ? {}
      : { trackerEntry: values[ACTION_FLAGS.trackerEntry] }),
    ...(values[ACTION_FLAGS.dueDate] === undefined
      ? {}
      : { dueDate: values[ACTION_FLAGS.dueDate] }),
    ...(values[ACTION_FLAGS.verificationArtifact] === undefined
      ? {}
      : { verificationArtifact: values[ACTION_FLAGS.verificationArtifact] }),
    ...(outcomeEvidence === undefined || window === undefined
      ? {}
      : {
          outcomeVerifier: {
            evidence: outcomeEvidence,
            windowStart: window.start,
            windowEnd: window.end,
          },
        }),
    ...(values[ACTION_FLAGS.rollbackCondition] === undefined
      ? {}
      : { rollbackCondition: values[ACTION_FLAGS.rollbackCondition] }),
    level,
    ...(values[ACTION_FLAGS.window] === undefined ? {} : { window: values[ACTION_FLAGS.window] }),
  };
  if (values[ACTION_FLAGS.outcomeWindow] !== undefined && window === undefined) return undefined;
  return draft;
};

const buildCloseRequest = (values: Readonly<Record<string, string>>): RetroActionCloseRequest => ({
  ...(values[ACTION_FLAGS.action] === undefined ? {} : { actionId: values[ACTION_FLAGS.action] }),
  ...(values[ACTION_FLAGS.route] === undefined ? {} : { route: values[ACTION_FLAGS.route] }),
  ...(values[ACTION_FLAGS.plane] === undefined ? {} : { plane: values[ACTION_FLAGS.plane] }),
  ...(values[ACTION_FLAGS.decision] === undefined
    ? {}
    : { decision: values[ACTION_FLAGS.decision] }),
  ...(values[ACTION_FLAGS.verificationArtifact] === undefined
    ? {}
    : { artifact: values[ACTION_FLAGS.verificationArtifact] }),
  ...(values[ACTION_FLAGS.reason] === undefined ? {} : { reason: values[ACTION_FLAGS.reason] }),
  ...(values[ACTION_FLAGS.successor] === undefined
    ? {}
    : { successor: values[ACTION_FLAGS.successor] }),
  ...(values[ACTION_FLAGS.evidence] === undefined
    ? {}
    : { evidence: values[ACTION_FLAGS.evidence] }),
});

/** Handle the additive `retro action <verb>` group. */
const handleAction = async (
  runtime: RetroActionCommandRuntime,
  tokens: readonly string[],
): Promise<{ readonly data: unknown } | { readonly error: ActionHandlerError }> => {
  const verb = tokens[2];
  if (!isActionVerb(verb)) {
    return {
      error: {
        kind: "input",
        code: "input.value.rejected",
        consequence: "not_landed",
        summary:
          verb === undefined
            ? "retro action: missing verb; declared verbs: file, close, list"
            : `retro action: unknown verb "${verb}"; declared verbs: file, close, list`,
      },
    };
  }
  const parsed = parseFlags(tokens, actionDeclaredFlags, 3);
  if (!parsed.ok) {
    return {
      error: {
        kind: "input",
        code: "input.value.rejected",
        consequence: "not_landed",
        summary: `retro action: ${parsed.detail}`,
      },
    };
  }
  const parsedLevel = parseLevel(parsed.values);
  if (!parsedLevel.ok) {
    const failure = parsedLevel.error;
    const summary = "summary" in failure ? failure.summary : undefined;
    return {
      error: {
        kind: "input",
        code: failure.code,
        consequence: "not_landed",
        ...(summary === undefined ? {} : { summary }),
      },
    };
  }
  if (verb === "file") {
    const draft = buildDraft(parsed.values, parsedLevel.level);
    if (draft === undefined) {
      return {
        error: {
          kind: "input",
          code: "input.value.rejected",
          consequence: "not_landed",
          summary: 'retro action: "--outcome-window" expects "<start>..<end>"',
        },
      };
    }
    return actionOutcomeToHandler(await runtime.file(draft));
  }
  if (verb === "close") {
    return actionOutcomeToHandler(await runtime.close(buildCloseRequest(parsed.values)));
  }
  const windowFilter = parsed.values[ACTION_FLAGS.window];
  return actionOutcomeToHandler(
    await runtime.list(windowFilter === undefined ? {} : { window: windowFilter }),
  );
};

/** Build the retro command definition over the injected runtime. */
export const createRetroCommandDefinition = (
  runtime: RetroCommandRuntimeWithActions,
): CommandDefinition => ({
  flags: [...new Set(["--level", ...actionDeclaredFlags])],
  positionals: { max: 16 },
  humanText: (data: unknown, _brand: BrandIdentity): string | undefined => renderHuman(data),
  humanFailureText: (error: unknown): string | undefined => renderFailure(error),
  handler: async (invocation) => {
    const tokens = invocation.argv;
    const subcommand = tokens[1];
    if (!isRetroSubcommand(subcommand)) {
      return reject(
        subcommand === undefined ? "missing subcommand" : `unknown subcommand "${subcommand}"`,
      );
    }
    if (subcommand === "action") {
      if (runtime.actions === undefined) {
        return reject("the action registry is not composed in this invocation");
      }
      return handleAction(runtime.actions, tokens);
    }
    const parsed = parseFlags(tokens, ["--level"], 2);
    if (!parsed.ok) return reject(parsed.detail);
    const parsedLevel = parseLevel(parsed.values);
    if (!parsedLevel.ok) return { error: parsedLevel.error };
    const level = parsedLevel.level;
    const outcome =
      subcommand === "collect" ? await runtime.collect({ level }) : await runtime.report({ level });
    return outcomeToHandler(outcome);
  },
});
