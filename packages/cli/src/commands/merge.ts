/**
 * `merge <ref> [--dry-run] [--waive <gate-id> --waived-by <principal>]` (GH-225
 * F-1..F-8).
 *
 * The handler validates grammar before any read, resolves the declared gate set
 * and freshness bound from the injected configuration, then runs the pure
 * transaction over injected ports. It returns data or one classified failure
 * and never writes a stream or chooses an exit digit.
 */
import {
  type MergeFailure,
  type MergeTransactionConfig,
  type MergeTransactionPorts,
  renderMergeFailure,
  runMergeTransaction,
} from "@delivery-os/core";
import {
  MERGE_MAX_REASON_CHARS,
  type MergeDryRunReport,
  type MergeReport,
  type MergeWaiverDeclaration,
} from "@delivery-os/core/contracts";
import type { CommandDefinition, CommandHandler } from "../index.js";
import { renderDryRunHuman, renderMergeHuman } from "../output/merge-text.js";

/** A resolved merge configuration, or a classified configuration failure. */
export type MergeConfigRead =
  | { readonly ok: true; readonly config: MergeTransactionConfig }
  | { readonly ok: false; readonly code: string; readonly detail?: string };

/** Everything the merge surface needs, injected by the edge. */
export type MergeCommandRuntime = {
  readonly readConfig: (changeRef: string) => MergeConfigRead;
  readonly createPorts: (changeRef: string) => MergeTransactionPorts;
};

type MergeFailureEnvelope = {
  readonly ok: false;
  readonly error: Record<string, unknown>;
};

type MergeSuccess = {
  readonly ok: true;
  readonly data: MergeReport | MergeDryRunReport;
};

const GRAMMAR_SUMMARY = "result=refused; condition=merge.grammar";

const grammarFailure = (): MergeFailureEnvelope => ({
  ok: false,
  error: {
    kind: "input",
    code: "input.value.rejected",
    summary: `${GRAMMAR_SUMMARY}; remediation=declare merge <ref> with optional --dry-run and a paired --waive/--waived-by`,
  },
});

const configFailure = (read: {
  readonly code: string;
  readonly detail?: string;
}): MergeFailureEnvelope => ({
  ok: false,
  error: {
    kind: "config",
    code: read.code,
    summary: `result=refused; condition=${read.code}${read.detail === undefined ? "" : `; evidence=${read.detail}`}`,
  },
});

const failureEnvelope = (failure: MergeFailure): MergeFailureEnvelope => ({
  ok: false,
  error: {
    kind: failure.domainKind,
    code: failure.code,
    summary: renderMergeFailure(failure),
  },
});

const declarationOf = (
  flags: Readonly<Record<string, string | true>>,
): MergeWaiverDeclaration | undefined => {
  const gateId = flags["--waive"];
  const authorizer = flags["--waived-by"];
  if (typeof gateId !== "string" || typeof authorizer !== "string") return undefined;
  const reason = flags["--waive-reason"];
  return {
    gateId,
    authorizer,
    ...(typeof reason === "string" ? { reason: reason.slice(0, MERGE_MAX_REASON_CHARS) } : {}),
  };
};

const validWaiverGrammar = (flags: Readonly<Record<string, string | true>>): boolean => {
  const hasWaive = Object.hasOwn(flags, "--waive");
  const hasBy = Object.hasOwn(flags, "--waived-by");
  if (hasWaive !== hasBy) return false;
  if (!hasWaive) return true;
  const gateId = flags["--waive"];
  const authorizer = flags["--waived-by"];
  return (
    typeof gateId === "string" &&
    gateId.length > 0 &&
    typeof authorizer === "string" &&
    authorizer.trim().length > 0
  );
};

/** Build the merge command definition over the injected runtime. */
export const createMergeCommandDefinition = (runtime: MergeCommandRuntime): CommandDefinition => {
  const handler: CommandHandler = async (invocation) => {
    const ref = invocation.positionals[0];
    if (
      invocation.positionals.length !== 1 ||
      ref === undefined ||
      ref.length === 0 ||
      !/^[A-Za-z][A-Za-z0-9]*-[0-9]+$/.test(ref) ||
      !validWaiverGrammar(invocation.flags)
    ) {
      return grammarFailure();
    }
    const configRead = runtime.readConfig(ref);
    if (!configRead.ok) {
      return configFailure(configRead);
    }
    const declaration = declarationOf(invocation.flags);
    const outcome = await runMergeTransaction({
      changeRef: ref,
      dryRun: invocation.flags["--dry-run"] === true,
      waiverDeclarations: declaration === undefined ? [] : [declaration],
      config: configRead.config,
      ports: runtime.createPorts(ref),
    });
    if (outcome.kind === "merged") {
      return { ok: true, data: outcome.report } satisfies MergeSuccess;
    }
    if (outcome.kind === "dry-run") {
      return { ok: true, data: outcome.report } satisfies MergeSuccess;
    }
    return failureEnvelope(outcome.failure);
  };
  return {
    flags: ["--dry-run", "--waive-reason"],
    requiresValue: ["--waive", "--waived-by", "--waive-reason"],
    positionals: { max: 1 },
    humanSuccess: true,
    humanText: (data, brand) => {
      if (typeof data !== "object" || data === null || Array.isArray(data)) return undefined;
      const result = (data as { readonly result?: unknown }).result;
      if (result === "merged") return renderMergeHuman(data as MergeReport, brand);
      if (result === "verified") return renderDryRunHuman(data as MergeDryRunReport, brand);
      return undefined;
    },
    handler,
  };
};

/** Recognise a merged report (used by the output layer and tests). */
export const isMergeReport = (data: unknown): data is MergeReport =>
  typeof data === "object" &&
  data !== null &&
  !Array.isArray(data) &&
  (data as { readonly result?: unknown }).result === "merged";

/** Recognise a dry-run report. */
export const isDryRunReport = (data: unknown): data is MergeDryRunReport =>
  typeof data === "object" &&
  data !== null &&
  !Array.isArray(data) &&
  (data as { readonly result?: unknown }).result === "verified";
