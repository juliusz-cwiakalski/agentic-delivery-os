/**
 * The render-once `board` command definition (GH-229 F-6/F-7, DEC-9).
 *
 * The handler owns no stream writes and chooses no exit code. Collectors,
 * policy, decision history, append, and time are injected. A collector
 * unavailability returns one classified failure naming that collector; a fully
 * available board returns one bounded `data` payload. No timer or loop exists.
 */

import {
  collectorUnavailableCode,
  evaluateOwnerGateSla,
  renderBoardHuman,
  toBoardData,
} from "@delivery-os/core";
import type {
  BoardCollectorEvidence,
  BoardData,
  BrandIdentity,
  OwnerGateCollectorRead,
  OwnerGateFact,
  OwnerGateSlaDecisionRecord,
  OwnerGateSlaPolicy,
  StateResult,
} from "@delivery-os/core/contracts";
import type {
  OwnerGateSlaDecisionAppendOutcome,
  OwnerGateSlaDecisionsRead,
} from "@delivery-os/core/state";
import type { CommandDefinition } from "../index.js";

/** One required collector read, injected at the edge. */
export type BoardCollector = {
  readonly id: string;
  readonly read: () => Promise<OwnerGateCollectorRead>;
};

/** Everything the board handler reads or writes, injected at the edge. */
export type BoardCommandRuntime = {
  readonly collectors: readonly BoardCollector[];
  readonly policy: OwnerGateSlaPolicy;
  readonly readDecisions: () => StateResult<OwnerGateSlaDecisionsRead>;
  readonly appendDecision: (
    decision: OwnerGateSlaDecisionRecord,
  ) => StateResult<OwnerGateSlaDecisionAppendOutcome>;
  readonly nowIso: () => string;
  readonly nowMs: () => number;
};

type BoardSuccess = { readonly data: BoardData };
type BoardFailure = {
  readonly error: {
    readonly kind: string;
    readonly code: string;
    readonly summary?: string;
  };
};

const failure = (kind: string, code: string, summary?: string): BoardFailure => ({
  error: { kind, code, ...(summary === undefined ? {} : { summary }) },
});

type Collected =
  | {
      readonly ok: true;
      readonly gates: readonly OwnerGateFact[];
      readonly collectors: readonly BoardCollectorEvidence[];
    }
  | { readonly ok: false; readonly collector: string; readonly code: string };

/** Read every required collector exactly once; any failure withholds the board. */
const collectGates = async (runtime: BoardCommandRuntime): Promise<Collected> => {
  const gates: OwnerGateFact[] = [];
  const collectors: BoardCollectorEvidence[] = [];
  for (const collector of runtime.collectors) {
    const read = await collector.read();
    if (!read.ok) {
      const id = read.collector.length > 0 ? read.collector : collector.id;
      return { ok: false, collector: id, code: collectorUnavailableCode(id) };
    }
    gates.push(...read.gates);
    collectors.push({ collector: read.collector, outcome: "available" });
  }
  return { ok: true, gates, collectors };
};

const evaluate = (
  runtime: BoardCommandRuntime,
  gates: readonly OwnerGateFact[],
  decisions: readonly OwnerGateSlaDecisionRecord[],
): ReturnType<typeof evaluateOwnerGateSla> =>
  evaluateOwnerGateSla({
    audience: "owner",
    nowMs: runtime.nowMs(),
    nowIso: runtime.nowIso(),
    policy: runtime.policy,
    gates,
    decisions,
  });

/** Build the `board` command definition over injected collectors and state. */
export const createBoardCommandDefinition = (runtime: BoardCommandRuntime): CommandDefinition => ({
  flags: [],
  positionals: { max: 0 },
  humanText: (data: unknown, brand: BrandIdentity): string =>
    renderBoardHuman(data as BoardData, brand),
  handler: async () => {
    const collected = await collectGates(runtime);
    if (!collected.ok) {
      return failure(
        "status",
        collected.code,
        `board withheld: collector ${collected.collector} unavailable`,
      );
    }

    // A history read happens only when some gate is eligible for a default.
    const initial = evaluate(runtime, collected.gates, []);
    let decisions: readonly OwnerGateSlaDecisionRecord[] = [];
    if (initial.decisionsToApply.length > 0) {
      const read = runtime.readDecisions();
      if (!read.ok) return failure(read.error.kind, read.error.code);
      decisions = read.value.records;
    }
    const evaluation = evaluate(runtime, collected.gates, decisions);
    for (const decision of evaluation.decisionsToApply) {
      const appended = runtime.appendDecision(decision);
      if (!appended.ok) return failure(appended.error.kind, appended.error.code);
    }
    return { data: toBoardData(evaluation, collected.collectors) } satisfies BoardSuccess;
  },
});
