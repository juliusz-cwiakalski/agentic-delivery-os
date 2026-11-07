/**
 * `watchdog` command — the check-only lane family (GH-221 F-1..F-6).
 *
 * Grammar is validated before any lane read: exactly `preflight`, `teardown`,
 * or `liveness` plus one `<lane>`. Handlers evaluate and (for teardown) restore;
 * they never dispatch, spawn a session, kill, restart, or supervise. Failure
 * evidence rides the failure summary (PIN-1), success evidence rides
 * `data.evidence`, and exit projection stays in the shared surface.
 */
import {
  buildWatchdogTeardownData,
  buildWatchdogVerdictData,
  classifyWatchdogLiveness,
  evaluateWatchdogPreflight,
  formatStallEvidence,
  planWatchdogRestoration,
  readWatchdogSignals,
} from "@delivery-os/core";
import type { BrandIdentity } from "@delivery-os/core/contracts";
import {
  WATCHDOG_PROBES,
  WATCHDOG_STALL_HEARTBEAT_MS,
  type WatchdogGitPort,
  type WatchdogLaneRead,
  type WatchdogMemoryPublication,
  type WatchdogProbe,
  type WatchdogRestorationAction,
  type WatchdogSignalSource,
  type WatchdogVerdictData,
} from "@delivery-os/core/contracts";
import type { CommandDefinition } from "../index.js";

/** Everything the watchdog surface needs; all reads and mutations are injected. */
export type WatchdogCommandRuntime = {
  readonly readLane: (lane: string) => WatchdogLaneRead;
  readonly git: WatchdogGitPort;
  /** Production M1-S1 wires zero sources, so liveness always classifies absent (PIN-6). */
  readonly signalSources: readonly WatchdogSignalSource[];
};

type WatchdogFailure = { readonly ok: false; readonly error: Record<string, unknown> };
type WatchdogSuccess = { readonly ok: true; readonly data: Record<string, unknown> };
type WatchdogResult = WatchdogSuccess | WatchdogFailure;

type WatchdogFailureKind = "input" | "state" | "watchdog";

const failure = (kind: WatchdogFailureKind, code: string, summary: string): WatchdogFailure => ({
  ok: false,
  error: { kind, code, summary },
});

const GRAMMAR_SUMMARY = "result=failed; reason=grammar; need=<preflight|teardown|liveness> <lane>";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

type ParsedWatchdogGrammar = {
  readonly probe: WatchdogProbe;
  readonly lane: string;
};

const isProbe = (value: string): value is WatchdogProbe =>
  (WATCHDOG_PROBES as readonly string[]).includes(value);

/** Grammar runs before any lane read; a rejection never touches a runtime. */
const parseGrammar = (positionals: readonly string[]): ParsedWatchdogGrammar | undefined => {
  const [subcommand, lane] = positionals;
  if (
    positionals.length !== 2 ||
    subcommand === undefined ||
    lane === undefined ||
    lane.length === 0 ||
    !isProbe(subcommand)
  ) {
    return undefined;
  }
  return { probe: subcommand, lane };
};

const laneFailure = (lane: string, read: WatchdogLaneRead): WatchdogFailure | undefined => {
  if (read.ok) return undefined;
  return read.reason === "torn"
    ? failure(
        "state",
        "state.store.torn",
        `lane ${lane}: the lane record is torn; the lane cannot be evaluated`,
      )
    : failure(
        "input",
        "input.value.rejected",
        `lane ${lane} is ${read.reason}; provide a declared lane and retry`,
      );
};

const preflight = async (
  runtime: WatchdogCommandRuntime,
  lane: string,
): Promise<WatchdogResult> => {
  const read = runtime.readLane(lane);
  const failed = laneFailure(lane, read);
  if (failed !== undefined) return failed;
  if (!read.ok) return failure("input", "input.value.rejected", `lane ${lane} is unavailable`);
  const evaluation = evaluateWatchdogPreflight({
    lane: read.record,
    checkout: await runtime.git.readCheckoutFacts({
      baseRef: read.record.baseRef,
      workspacePaths: read.record.workspacePaths,
    }),
  });
  if (evaluation.outcome === "admitted") {
    return {
      ok: true,
      data: buildWatchdogVerdictData({
        probe: "preflight",
        lane,
        verdict: "ok",
        evidence: evaluation.evidence,
      }),
    };
  }
  if (evaluation.outcome === "refused") {
    return failure(
      "watchdog",
      evaluation.reason === "dirty" ? "watchdog.checkout-dirty" : "watchdog.checkout-non-base",
      evaluation.evidence,
    );
  }
  return failure("input", "input.value.rejected", evaluation.evidence);
};

const assertNever = (value: never): never => {
  throw new Error(`unreachable watchdog action ${JSON.stringify(value)}`);
};

const teardown = async (runtime: WatchdogCommandRuntime, lane: string): Promise<WatchdogResult> => {
  const read = runtime.readLane(lane);
  const failed = laneFailure(lane, read);
  if (failed !== undefined) return failed;
  if (!read.ok) return failure("input", "input.value.rejected", `lane ${lane} is unavailable`);
  const checkout = await runtime.git.readCheckoutFacts({
    baseRef: read.record.baseRef,
    workspacePaths: read.record.workspacePaths,
  });
  const plan = planWatchdogRestoration({ lane: read.record, checkout });
  if (!plan.ok) return failure("input", "input.value.rejected", plan.evidence);

  const actions: WatchdogRestorationAction[] = [];
  for (const action of plan.actions) {
    switch (action.action) {
      case "preserve-commit": {
        const mutation = await runtime.git.preserveCommit({
          ref: action.ref,
          commit: action.commit,
        });
        if (!mutation.ok) {
          return failure("input", "input.value.rejected", `${action.evidence}: ${mutation.detail}`);
        }
        actions.push({
          kind: "preserve-commit",
          observation: `stranded commit preserved as ${action.ref}`,
          evidence: action.evidence,
        });
        break;
      }
      case "restore-checkout": {
        const mutation = await runtime.git.restoreCheckout({ baseRef: action.baseRef });
        if (!mutation.ok) {
          return failure("input", "input.value.rejected", `${action.evidence}: ${mutation.detail}`);
        }
        actions.push({
          kind: "restore-checkout",
          observation: `checkout restored to base ${action.baseRef}`,
          evidence: action.evidence,
        });
        break;
      }
      case "checkout-unchanged":
        actions.push({
          kind: "checkout-unchanged",
          observation: "nothing to restore",
          evidence: action.evidence,
        });
        break;
      case "remove-residue": {
        const mutation = await runtime.git.removePath({ path: action.path });
        if (!mutation.ok) {
          return failure("input", "input.value.rejected", `${action.evidence}: ${mutation.detail}`);
        }
        actions.push({
          kind: "remove-residue",
          observation: `${action.path} removed`,
          evidence: action.evidence,
        });
        break;
      }
      case "preserve-content":
        actions.push({
          kind: "preserve-content",
          observation: `${action.path} preserved in place`,
          evidence: action.evidence,
        });
        break;
      default:
        assertNever(action);
    }
  }

  return {
    ok: true,
    data: buildWatchdogTeardownData({
      lane,
      verdict: "ok",
      evidence: `restored lane ${lane} to base ${read.record.baseRef}`,
      actions,
      memory: plan.memory,
    }),
  };
};

const liveness = (runtime: WatchdogCommandRuntime, lane: string): WatchdogResult => {
  const read = runtime.readLane(lane);
  const failed = laneFailure(lane, read);
  if (failed !== undefined) return failed;
  const signals = readWatchdogSignals(runtime.signalSources, lane);
  if (signals === undefined) {
    return failure(
      "watchdog",
      "watchdog.signals-absent",
      `lane ${lane}: no declared progress-signal sources are available; the answer is unknown`,
    );
  }
  const evaluation = classifyWatchdogLiveness(signals);
  if (evaluation.outcome === "absent") {
    return failure("watchdog", "watchdog.signals-absent", `lane ${lane}: ${evaluation.evidence}`);
  }
  if (evaluation.verdict === "stalled") {
    const { heartbeatAgeMs, tokenDelta, traffic } = evaluation.signals;
    if (typeof heartbeatAgeMs !== "number" || tokenDelta !== 0 || traffic !== 0) {
      return failure("watchdog", "watchdog.signals-absent", `lane ${lane}: ${evaluation.evidence}`);
    }
    // GAP-T2 resolved as DEC-1: a corroborated stall is a classified refusal at
    // exit 1, with the corroborating signals as the bounded key=value corpus.
    return failure(
      "watchdog",
      "watchdog.liveness-stalled",
      formatStallEvidence({
        reason: "watchdog.liveness-stalled",
        heartbeatAgeMs,
        tokenDelta,
        traffic,
        stallBoundMs: WATCHDOG_STALL_HEARTBEAT_MS,
      }),
    );
  }
  return {
    ok: true,
    data: buildWatchdogVerdictData({
      probe: "liveness",
      lane,
      verdict: evaluation.verdict,
      signals: evaluation.signals,
      evidence: evaluation.evidence,
    }),
  };
};

const isVerdictData = (data: unknown): data is WatchdogVerdictData & Record<string, unknown> =>
  isRecord(data) &&
  typeof data.probe === "string" &&
  typeof data.lane === "string" &&
  typeof data.verdict === "string" &&
  typeof data.evidence === "string";

const isMemoryList = (value: unknown): value is readonly WatchdogMemoryPublication[] =>
  Array.isArray(value) &&
  value.every(
    (entry) =>
      isRecord(entry) && typeof entry.path === "string" && typeof entry.status === "string",
  );

const isActionList = (value: unknown): value is readonly WatchdogRestorationAction[] =>
  Array.isArray(value) &&
  value.every(
    (entry) =>
      isRecord(entry) &&
      typeof entry.kind === "string" &&
      typeof entry.observation === "string" &&
      typeof entry.evidence === "string",
  );

/** Render the verdict/restoration lines with the same evidence as `--json`. */
export const renderWatchdogHuman = (data: unknown, brand: BrandIdentity): string | undefined => {
  if (!isVerdictData(data)) return undefined;
  const lines = [
    `${brand.binaryName} watchdog ${data.probe} ${data.lane}: ${data.verdict}`,
    `evidence: ${data.evidence}`,
  ];
  const actions = isRecord(data) ? data.actions : undefined;
  if (isActionList(actions)) {
    for (const action of actions) {
      lines.push(`action ${action.kind}: ${action.observation} — ${action.evidence}`);
    }
  }
  const memory = isRecord(data) ? data.memory : undefined;
  if (isMemoryList(memory)) {
    for (const publication of memory) {
      lines.push(`memory ${publication.status}: ${publication.path} — ${publication.evidence}`);
    }
  }
  return `${lines.join("\n")}\n`;
};

/**
 * Build the one check-only watchdog command. `positionals.max` is two so a third
 * positional is rejected by the parser (`fallback.invocation`) before the
 * handler; there are no command-specific flags, and `--json` is global.
 */
export const createWatchdogCommandDefinition = (
  runtime: WatchdogCommandRuntime,
): CommandDefinition => ({
  flags: [],
  positionals: { max: 2 },
  humanText: (data, brand) => renderWatchdogHuman(data, brand),
  handler: async (invocation) => {
    const grammar = parseGrammar(invocation.positionals);
    if (grammar === undefined) {
      return { error: failure("input", "input.value.rejected", GRAMMAR_SUMMARY).error };
    }
    switch (grammar.probe) {
      case "preflight":
        return preflight(runtime, grammar.lane);
      case "teardown":
        return teardown(runtime, grammar.lane);
      case "liveness":
        return liveness(runtime, grammar.lane);
      default:
        return assertNever(grammar.probe);
    }
  },
});
