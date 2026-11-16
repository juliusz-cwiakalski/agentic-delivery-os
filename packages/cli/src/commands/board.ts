/**
 * The render-once `board` command definition (GH-229 F-6/F-7, GH-297 F-1..F-9).
 *
 * The handler owns no stream writes and chooses no exit code. Repository
 * selection, the per-repository read set, the pure four-section projection, and
 * the append-only decision ledger are injected at the edge. A failed load
 * withholds the whole board with its classified identity; a produced board
 * performs at most one decision-history read per repository and appends at most
 * one decision per newly defaulted gate. No timer or loop exists.
 */

import { projectBoard, renderBoardHuman } from "@delivery-os/core";
import type {
  BoardData,
  BoardOwnerHold,
  BoardRepositoryFacts,
  BoardScope,
  BoardSelection,
  BrandIdentity,
  OwnerGateSlaDecisionRecord,
  OwnerGateSlaPolicy,
  StateResult,
} from "@delivery-os/core/contracts";
import type { OwnerGateSlaDecisionAppendOutcome } from "@delivery-os/core/state";
import type { CommandDefinition } from "../index.js";

/** The resolved repository scope for one invocation (DM-7). */
export type BoardSelectionResolution =
  | {
      readonly ok: true;
      readonly scope: BoardScope;
      readonly selection: BoardSelection;
      readonly repositories: readonly string[];
      readonly omittedRepositories: number;
    }
  | { readonly ok: false; readonly kind: string; readonly code: string; readonly summary?: string };

/** One repository's injected facts, or its classified failure. */
export type BoardRepositoryLoad =
  | { readonly ok: true; readonly facts: BoardRepositoryFacts }
  | { readonly ok: false; readonly kind: string; readonly code: string; readonly summary?: string };

/** Everything the board handler reads or writes, injected at the edge. */
export type BoardCommandRuntime = {
  readonly resolve: (invocation: {
    readonly flags: Readonly<Record<string, boolean | string | readonly string[]>>;
  }) => BoardSelectionResolution | Promise<BoardSelectionResolution>;
  readonly loadRepository: (repository: string) => Promise<BoardRepositoryLoad>;
  readonly appendDecision: (
    repository: string,
    decision: OwnerGateSlaDecisionRecord,
  ) =>
    | StateResult<OwnerGateSlaDecisionAppendOutcome>
    | Promise<StateResult<OwnerGateSlaDecisionAppendOutcome>>;
  readonly ownerHold: () => BoardOwnerHold;
  readonly policy: OwnerGateSlaPolicy;
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

/** Build the board command definition over the injected selection and reads. */
export const createBoardCommandDefinition = (runtime: BoardCommandRuntime): CommandDefinition => ({
  flags: [],
  positionals: { max: 0 },
  humanText: (data: unknown, brand: BrandIdentity): string =>
    renderBoardHuman(data as BoardData, brand),
  handler: async (invocation) => {
    // Grammar refusals are the delivered `fallback.invocation` (DEC-17) and
    // happen before any source is read.
    const projectFlag = invocation.flags["--project"];
    if (projectFlag !== undefined && typeof projectFlag !== "string") {
      return failure(
        "fallback",
        "fallback.invocation",
        "result=refused; reason=project-needs-value",
      );
    }
    const resolved = await runtime.resolve(invocation);
    if (!resolved.ok) return failure(resolved.kind, resolved.code, resolved.summary);

    const facts: BoardRepositoryFacts[] = [];
    for (const repository of resolved.repositories) {
      const loaded = await runtime.loadRepository(repository);
      if (!loaded.ok) {
        return failure(
          loaded.kind,
          loaded.code,
          loaded.summary ?? `board withheld: repository ${repository} unavailable`,
        );
      }
      facts.push(loaded.facts);
    }

    const project = (repositories: readonly BoardRepositoryFacts[]) =>
      projectBoard({
        audience: "owner",
        scope: resolved.scope,
        selection: resolved.selection,
        repositories,
        omittedRepositories: resolved.omittedRepositories,
        ownerHold: runtime.ownerHold(),
        policy: runtime.policy,
        nowMs: runtime.nowMs(),
        nowIso: runtime.nowIso(),
      });

    // First pass: the decisions this invocation must append.
    const initial = project(facts);
    const appended = new Map<string, OwnerGateSlaDecisionRecord[]>();
    for (const repository of facts) {
      const decisions = initial.decisionsToApply[repository.key] ?? [];
      for (const decision of decisions) {
        const result = await runtime.appendDecision(repository.key, decision);
        if (!result.ok) return failure(result.error.kind, result.error.code);
        const bucket = appended.get(repository.key) ?? [];
        bucket.push(decision);
        appended.set(repository.key, bucket);
      }
    }
    if (appended.size === 0) return { data: initial.data } satisfies BoardSuccess;
    // Second pass: the post-append decision set, so an ask on a ref defaulted in
    // this run reads `applied` (DEC-16). No extra history read is performed.
    const projected = project(
      facts.map((repository) => ({
        ...repository,
        decisions: [...repository.decisions, ...(appended.get(repository.key) ?? [])],
      })),
    );
    return { data: projected.data } satisfies BoardSuccess;
  },
});
