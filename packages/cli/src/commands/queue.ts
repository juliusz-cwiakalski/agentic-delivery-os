/**
 * The read-only `queue ready` command definition (GH-176 F-1, F-2, D4).
 *
 * `queue` is the command and `ready` is its subcommand positional. The handler
 * owns no stream writes and chooses no exit code. Grammar (including the
 * canonical-ref length and duplicate checks) runs before any source read; only
 * a clean grammar calls the shared {@link collectStatusFacts} composition once.
 *
 * The `queue` family is the M0 ready-set; lanes and dispatch arrive in M2-S1.
 */
import {
  canonicalQueueRef,
  evaluateQueueReady,
  renderQueueHuman,
  renderQueueReadyHuman,
  type QueueSchedule,
} from "@delivery-os/core";
import {
  type BrandIdentity,
  QUEUE_CLAIM_RESULTS,
  QUEUE_DEFAULT_NEXT_ACTIONS,
  QUEUE_MAX_NEXT_ACTIONS,
  QUEUE_MAX_REF_CHARS,
  QUEUE_MUTATION_RESULTS,
  QUEUE_PARK_CAUSES,
  QUEUE_READY_MAX_CANDIDATES,
  QUEUE_READY_MAX_POSITIONALS,
  QUEUE_READY_MAX_WORK_ITEM_REF_CHARS,
  QUEUE_READY_WORK_ITEM_REF_PATTERN,
  QUEUE_RELEASE_RESULTS,
  type QueueClaimLease,
  type QueueDegradationReason,
  type QueueGraphEntry,
  type QueueMutationData,
  type QueueNextAction,
  type QueueParkCause,
  type QueueParkProjection,
  type QueuePlanData,
  type QueueReadData,
  type QueueReadyPayload,
  type QueueReleaseData,
} from "@delivery-os/core/contracts";
import type { CommandDefinition } from "../index.js";
import { collectStatusFacts, type StatusCommandRuntime } from "./status.js";

/** The queue command reuses the delivered status reader set verbatim. */
export type QueueReadyCommandRuntime = StatusCommandRuntime;

const REF_PARTS = /^([A-Za-z][A-Za-z0-9]*)-([0-9]+)$/;
const REF_SHAPE = new RegExp(QUEUE_READY_WORK_ITEM_REF_PATTERN);

const grammarRejection = (): { readonly error: Record<string, string> } => ({
  error: {
    kind: "input",
    code: "input.value.rejected",
    summary: "result=failed; reason=grammar",
  },
});

/** Uppercase the ASCII prefix and preserve the digits exactly as supplied. */
const canonicalize = (ref: string): string => {
  const match = REF_PARTS.exec(ref);
  if (match === null) return ref;
  const prefix = match[1] ?? "";
  const digits = match[2] ?? "";
  return `${prefix.toUpperCase()}-${digits}`;
};

type GrammarResult =
  | { readonly ok: true; readonly candidates: readonly string[] }
  | { readonly ok: false };

/** Validate and canonicalize the positional grammar without any source read. */
const parseGrammar = (positionals: readonly string[]): GrammarResult => {
  if (positionals[0] !== "ready") return { ok: false };
  const refs = positionals.slice(1);
  if (refs.length < 1 || refs.length > QUEUE_READY_MAX_CANDIDATES) return { ok: false };
  for (const ref of refs) {
    if (!REF_SHAPE.test(ref)) return { ok: false };
  }
  const canonical = refs.map(canonicalize);
  for (const ref of canonical) {
    if (ref.length > QUEUE_READY_MAX_WORK_ITEM_REF_CHARS) return { ok: false };
  }
  if (new Set(canonical).size !== canonical.length) return { ok: false };
  return { ok: true, candidates: canonical };
};

/** Build the `queue ready` command definition over injected readers. */
export const createQueueReadyCommandDefinition = (
  runtime: QueueReadyCommandRuntime,
): CommandDefinition => ({
  flags: [],
  positionals: { max: QUEUE_READY_MAX_POSITIONALS },
  humanText: (data: unknown, brand: BrandIdentity): string =>
    renderQueueReadyHuman(data as QueueReadyPayload, brand),
  handler: async (invocation) => {
    const grammar = parseGrammar(invocation.positionals);
    if (!grammar.ok) return grammarRejection();
    const facts = await collectStatusFacts(runtime);
    return { data: evaluateQueueReady({ ...facts, candidates: grammar.candidates }) };
  },
});

/* ------------------------- the full queue family ------------------------- */

/** One classified runtime failure projected as an envelope error. */
export type QueueRuntimeFailure = {
  readonly ok: false;
  readonly kind: string;
  readonly code: string;
  readonly summary?: string;
  readonly detail?: string;
};

/** A read surface's computed schedule plus truthful degradation. */
export type QueueRuntimeSchedule =
  | {
      readonly ok: true;
      readonly schedule: QueueSchedule;
      readonly degraded: readonly QueueDegradationReason[];
    }
  | QueueRuntimeFailure;

/** A landed intent mutation. */
export type QueueRuntimeMutation =
  | {
      readonly ok: true;
      readonly ref: string;
      readonly entry: QueueGraphEntry;
      readonly edges: readonly string[];
      readonly result: "added" | "updated" | "noop";
      readonly degraded: readonly QueueDegradationReason[];
    }
  | QueueRuntimeFailure;

/** A landed claim. */
export type QueueRuntimeClaim =
  | {
      readonly ok: true;
      readonly result: "claimed" | "renewed" | "taken-over";
      readonly selectedRef: string;
      readonly lease: QueueClaimLease;
      readonly action: QueueNextAction;
      readonly degraded: readonly QueueDegradationReason[];
    }
  | QueueRuntimeFailure;

/** A landed release (optionally with a park). */
export type QueueRuntimeRelease =
  | {
      readonly ok: true;
      readonly result: "released" | "parked" | "noop";
      readonly lease?: QueueClaimLease;
      readonly park?: QueueParkProjection;
      readonly degraded: readonly QueueDegradationReason[];
    }
  | QueueRuntimeFailure;

/** Everything the full queue command reads or writes, injected at the edge. */
export type QueueCommandRuntime = {
  readonly readSchedule: (next: number) => QueueRuntimeSchedule;
  readonly add: (input: {
    readonly ref: string;
    readonly priority?: number;
    readonly deps?: readonly string[];
  }) => QueueRuntimeMutation;
  readonly prioritize: (input: {
    readonly ref: string;
    readonly priority: number;
  }) => QueueRuntimeMutation;
  readonly dep: (input: { readonly ref: string; readonly onRef: string }) => QueueRuntimeMutation;
  readonly claim: (input: {
    readonly ref?: string;
    readonly holder: string;
  }) => QueueRuntimeClaim;
  readonly release: (input: {
    readonly ref: string;
    readonly holder?: string;
    readonly parkCause?: QueueParkCause;
  }) => QueueRuntimeRelease;
  /** The delivered ready-only definition, preserved byte-for-byte. */
  readonly readyDefinition?: CommandDefinition;
};

const runtimeFailure = (failure: QueueRuntimeFailure): { readonly error: QueueRuntimeFailure } => ({
  error: failure,
});

const fullGrammarRejection = (reason: string): { readonly error: Record<string, string> } => ({
  error: {
    kind: "input",
    code: "input.value.rejected",
    summary: `result=refused; reason=${reason}`,
  },
});

const parsePriority = (value: string | true | undefined): number | undefined => {
  if (typeof value !== "string") return undefined;
  if (!/^[0-9]+$/.test(value)) return undefined;
  return Number(value);
};

const parseNext = (value: string | true | undefined): number => {
  if (value === undefined) return QUEUE_DEFAULT_NEXT_ACTIONS;
  if (typeof value !== "string" || !/^[0-9]+$/.test(value)) return -1;
  const next = Number(value);
  return next >= 1 && next <= QUEUE_MAX_NEXT_ACTIONS ? next : QUEUE_MAX_NEXT_ACTIONS;
};

const isParkCause = (value: string): value is QueueParkCause =>
  (QUEUE_PARK_CAUSES as readonly string[]).includes(value);

/** Build the Appendix C read payload from a computed schedule. */
export const toQueueReadData = (
  schedule: QueueSchedule,
  degraded: readonly QueueDegradationReason[],
): QueueReadData => ({
  schemaVersion: "delivery.queue.v1",
  entries: schedule.entries,
  leases: schedule.leases,
  weights: schedule.weights,
  parks: schedule.parks,
  findings: schedule.findings,
  degraded,
  truncated: schedule.truncated,
  counts: {
    entries: schedule.entries.length,
    ready: schedule.entries.filter((entry) => entry.state === "ready").length,
    held: schedule.entries.filter((entry) => entry.state === "held").length,
    parked: schedule.entries.filter((entry) => entry.state === "parked").length,
    leases: schedule.leases.length,
    parks: schedule.parks.length,
  },
});

/** Build the `queue plan` payload (the same collections plus nextActions). */
export const toQueuePlanData = (
  schedule: QueueSchedule,
  degraded: readonly QueueDegradationReason[],
): QueuePlanData => ({
  ...toQueueReadData(schedule, degraded),
  nextActions: schedule.nextActions,
});

const mutationData = (mutation: QueueRuntimeMutation): QueueMutationData => {
  if (!mutation.ok) throw new Error("mutation failure is not data");
  return {
    ref: mutation.ref,
    entry: {
      ref: mutation.ref,
      ...(mutation.entry.repository === undefined
        ? {}
        : { repository: mutation.entry.repository }),
      state: mutation.result === "noop" ? "ready" : "ready",
      rankClass: mutation.entry.rankClass,
      priority: mutation.entry.priority,
      weightClass: mutation.entry.weightClass,
      weightClassSource: "absent",
      deps: mutation.edges,
      blocking: [],
    },
    edges: mutation.edges,
    result: mutation.result,
    degraded: mutation.degraded,
  };
};

const claimData = (claim: QueueRuntimeClaim) => {
  if (!claim.ok) throw new Error("claim failure is not data");
  return {
    result: claim.result,
    selectedRef: claim.selectedRef,
    lease: claim.lease,
    action: claim.action,
    degraded: claim.degraded,
  };
};

const releaseData = (release: QueueRuntimeRelease): QueueReleaseData => {
  if (!release.ok) throw new Error("release failure is not data");
  return {
    result: release.result,
    ...(release.lease === undefined ? {} : { lease: release.lease }),
    ...(release.park === undefined ? {} : { park: release.park }),
    degraded: release.degraded,
  };
};

/** Failures print `result=refused` before the classified refusal. */
const humanFailure = (): string => "result=refused\n";

/**
 * The full `queue` command definition. `ready` is delegated to the delivered
 * definition unchanged; the additive subcommands share the declared grammar and
 * bounded untrusted-input validation before any read.
 */
export const createQueueCommandDefinition = (
  runtime: QueueCommandRuntime,
): CommandDefinition => ({
  flags: ["--next", "--priority", "--dep", "--holder", "--park"],
  requiresValue: ["--next", "--priority", "--dep", "--holder", "--park"],
  positionals: { max: 3 },
  humanText: (data: unknown): string => renderQueueHuman(data as never),
  humanFailureText: (): string => humanFailure(),
  handler: (invocation) => {
    const [subcommand, first, second, ...extra] = invocation.positionals;
    if (extra.length > 0) return fullGrammarRejection("positionals");
    if (subcommand === "ready") {
      if (runtime.readyDefinition === undefined) {
        return fullGrammarRejection("ready-unavailable");
      }
      return runtime.readyDefinition.handler(invocation);
    }
    if (subcommand === "list") {
      if (first !== undefined) return fullGrammarRejection("list-positionals");
      const read = runtime.readSchedule(QUEUE_DEFAULT_NEXT_ACTIONS);
      if (!read.ok) return runtimeFailure(read);
      return { data: toQueueReadData(read.schedule, read.degraded) };
    }
    if (subcommand === "plan") {
      if (first !== undefined) return fullGrammarRejection("plan-positionals");
      const next = parseNext(invocation.flags["--next"]);
      if (next < 0) return fullGrammarRejection("next");
      const read = runtime.readSchedule(next);
      if (!read.ok) return runtimeFailure(read);
      return { data: toQueuePlanData(read.schedule, read.degraded) };
    }
    const ref = first === undefined ? undefined : canonicalQueueRef(first);
    if (subcommand === "add") {
      if (ref === undefined || first === undefined || second !== undefined) {
        return fullGrammarRejection("add-grammar");
      }
      const priorityValue = invocation.flags["--priority"];
      const priority =
        priorityValue === undefined ? undefined : parsePriority(priorityValue);
      if (priorityValue !== undefined && priority === undefined) {
        return fullGrammarRejection("priority");
      }
      const dep = invocation.flags["--dep"];
      if (dep !== undefined && (typeof dep !== "string" || canonicalQueueRef(dep) === undefined)) {
        return fullGrammarRejection("dep");
      }
      const mutation = runtime.add({
        ref,
        ...(priority === undefined ? {} : { priority }),
        ...(dep === undefined ? {} : { deps: [dep] }),
      });
      if (!mutation.ok) return runtimeFailure(mutation);
      return { data: mutationData(mutation) };
    }
    if (subcommand === "prioritize") {
      if (ref === undefined || second === undefined) return fullGrammarRejection("prioritize-grammar");
      const priority = parsePriority(second);
      if (priority === undefined) return fullGrammarRejection("priority");
      const mutation = runtime.prioritize({ ref, priority });
      if (!mutation.ok) return runtimeFailure(mutation);
      return { data: mutationData(mutation) };
    }
    if (subcommand === "dep") {
      if (ref === undefined || second === undefined) return fullGrammarRejection("dep-grammar");
      const onRef = canonicalQueueRef(second);
      if (onRef === undefined) return fullGrammarRejection("on-ref");
      const mutation = runtime.dep({ ref, onRef });
      if (!mutation.ok) return runtimeFailure(mutation);
      return { data: mutationData(mutation) };
    }
    if (subcommand === "claim") {
      if (second !== undefined) return fullGrammarRejection("claim-grammar");
      const holderFlag = invocation.flags["--holder"];
      const holder = typeof holderFlag === "string" ? holderFlag : "local";
      if (holder.length === 0) return fullGrammarRejection("holder");
      const claim = runtime.claim({
        ...(ref === undefined ? {} : { ref }),
        holder,
      });
      if (!claim.ok) return runtimeFailure(claim);
      return { data: claimData(claim) };
    }
    if (subcommand === "release") {
      if (ref === undefined || second !== undefined) return fullGrammarRejection("release-grammar");
      const holderFlag = invocation.flags["--holder"];
      const parkFlag = invocation.flags["--park"];
      if (parkFlag !== undefined) {
        if (typeof parkFlag !== "string" || !isParkCause(parkFlag)) {
          return fullGrammarRejection("park-cause");
        }
      }
      const release = runtime.release({
        ref,
        ...(typeof holderFlag === "string" ? { holder: holderFlag } : {}),
        ...(typeof parkFlag === "string" && isParkCause(parkFlag)
          ? { parkCause: parkFlag }
          : {}),
      });
      if (!release.ok) return runtimeFailure(release);
      return { data: releaseData(release) };
    }
    return fullGrammarRejection("subcommand");
  },
});

/** The accepted mutation/claim/release result vocabularies (structural re-export). */
export const QUEUE_MUTATION_RESULT_VALUES = QUEUE_MUTATION_RESULTS;
export const QUEUE_CLAIM_RESULT_VALUES = QUEUE_CLAIM_RESULTS;
export const QUEUE_RELEASE_RESULT_VALUES = QUEUE_RELEASE_RESULTS;
export const QUEUE_MAX_NEXT = QUEUE_MAX_NEXT_ACTIONS;
export const QUEUE_MAX_REFERENCE_CHARS = QUEUE_MAX_REF_CHARS;
