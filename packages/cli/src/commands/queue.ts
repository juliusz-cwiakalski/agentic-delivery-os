/**
 * The `queue` command family (GH-176 F-1, F-2, D4; GH-237 F-10, Appendix C).
 *
 * `queue ready` is the delivered read-only ready-set and is delegated to its
 * own definition unchanged. The same command now also serves `queue
 * list|plan|add|prioritize|dep|claim|release` over the scheduling engine;
 * dispatch/session execution remains M1-S9. The handler owns no stream writes
 * and chooses no exit code. Grammar (including the canonical-ref length and
 * duplicate checks) runs before any source read; only a clean grammar calls the
 * shared {@link collectStatusFacts} composition or the injected scheduling
 * runtime.
 */
import {
  boundQueuePlanData,
  boundQueueReadData,
  canonicalQueueRef,
  evaluateQueueReady,
  type QueueReconcileOutcome,
  type QueueSchedule,
  renderQueueHuman,
  renderQueueReadyHuman,
} from "@delivery-os/core";
import {
  type BrandIdentity,
  QUEUE_CLAIM_RESULTS,
  QUEUE_DEFAULT_NEXT_ACTIONS,
  QUEUE_DEPENDENCY_MUTATION_RESULTS,
  QUEUE_MAX_NEXT_ACTIONS,
  QUEUE_MAX_REF_CHARS,
  QUEUE_MUTATION_RESULTS,
  QUEUE_PARK_CAUSES,
  QUEUE_READY_MAX_CANDIDATES,
  QUEUE_READY_MAX_POSITIONALS,
  QUEUE_READY_MAX_WORK_ITEM_REF_CHARS,
  QUEUE_READY_WORK_ITEM_REF_PATTERN,
  QUEUE_RECONCILE_RESULTS,
  QUEUE_RELEASE_RESULTS,
  QUEUE_REMOVAL_REASONS,
  QUEUE_REMOVAL_RESULTS,
  type QueueBlocking,
  type QueueClaimLease,
  type QueueDegradationReason,
  type QueueDependencyRemovalData,
  type QueueEntryState,
  type QueueGraphEntry,
  type QueueMutationData,
  type QueueNextAction,
  type QueueParkCause,
  type QueueParkProjection,
  type QueuePlanData,
  type QueueReadData,
  type QueueReadyPayload,
  type QueueReconcileData,
  type QueueReleaseData,
  type QueueRemovalReason,
  type QueueRemoveData,
  type QueueWeightClass,
  type QueueWeightClassSource,
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
  /** The live lease's holder on a `queue.single-flight` refusal (TDR-0027). */
  readonly holder?: string;
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
      readonly entryState: QueueEntryState;
      readonly blocking: readonly QueueBlocking[];
      readonly weightClass: QueueWeightClass;
      readonly weightClassSource: QueueWeightClassSource;
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

/** A landed reason-bearing removal (GH-292 F-1). */
export type QueueRuntimeRemoval =
  | {
      readonly ok: true;
      readonly ref: string;
      readonly reason: QueueRemovalReason;
      readonly readySet: readonly string[];
      readonly degraded: readonly QueueDegradationReason[];
    }
  | QueueRuntimeFailure;

/** A landed dependency-edge removal (GH-292 F-3). */
export type QueueRuntimeDependencyRemoval =
  | {
      readonly ok: true;
      readonly ref: string;
      readonly entry: QueueGraphEntry;
      readonly entryState: QueueEntryState;
      readonly blocking: readonly QueueBlocking[];
      readonly weightClass: QueueWeightClass;
      readonly weightClassSource: QueueWeightClassSource;
      readonly edges: readonly string[];
      readonly result: (typeof QUEUE_DEPENDENCY_MUTATION_RESULTS)[number];
      readonly readySet: readonly string[];
      readonly degraded: readonly QueueDegradationReason[];
    }
  | QueueRuntimeFailure;

/** A landed reconcile sweep (GH-292 F-5): the core outcome plus the derived surfaces. */
export type QueueRuntimeReconcile =
  | {
      readonly ok: true;
      readonly value: QueueReconcileOutcome;
      readonly readySet: readonly string[];
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
  readonly claim: (input: { readonly ref?: string; readonly holder: string }) => QueueRuntimeClaim;
  readonly release: (input: {
    readonly ref: string;
    readonly holder?: string;
    readonly parkCause?: QueueParkCause;
    /** The absolute provider-window expiry, required for cause provider-window. */
    readonly parkUntil?: string;
  }) => QueueRuntimeRelease;
  /** The reason-bearing removal (GH-292 F-1); an absent reason is the queue identity. */
  readonly remove: (input: {
    readonly ref: string;
    readonly reason?: QueueRemovalReason;
  }) => QueueRuntimeRemoval;
  /** The dependency-edge removal (GH-292 F-3); an absent edge is a noop. */
  readonly depRemove: (input: {
    readonly ref: string;
    readonly onRef: string;
  }) => QueueRuntimeDependencyRemoval;
  /** The tracker-truth reconcile sweep (GH-292 F-5); rides the injected read port. */
  readonly reconcile: (input: { readonly ref?: string }) => Promise<QueueRuntimeReconcile>;
  /** The delivered ready-only definition, preserved byte-for-byte. */
  readonly readyDefinition?: CommandDefinition;
  /** The additive live watch stream (GH-238 F-13); absent stays truthful. */
  readonly watch?: () => AsyncIterable<string>;
};

const runtimeFailure = (
  failure: QueueRuntimeFailure,
): { readonly error: Record<string, unknown> } => {
  // TDR-0027: the single-flight holder rides the record-shaped envelope-root
  // `detail`, never the error object and never the prose `detail` string.
  if (failure.holder !== undefined) {
    return {
      error: {
        ok: failure.ok,
        kind: failure.kind,
        code: failure.code,
        ...(failure.summary === undefined ? {} : { summary: failure.summary }),
        detail: { holder: failure.holder },
      },
    };
  }
  return { error: failure };
};

const fullGrammarRejection = (reason: string): { readonly error: Record<string, string> } => ({
  error: {
    kind: "input",
    code: "input.value.rejected",
    summary: `result=refused; reason=${reason}`,
  },
});

/** A rejected `--reason` value names the offending value in the summary (TC-QLC-003). */
const reasonRejection = (value: string): { readonly error: Record<string, string> } => ({
  error: {
    kind: "input",
    code: "input.value.rejected",
    summary: `result=refused; reason=reason-${value}`,
  },
});

const isRemovalReason = (value: string): value is QueueRemovalReason =>
  (QUEUE_REMOVAL_REASONS as readonly string[]).includes(value);

/**
 * The remediation hint for a `--watch` invocation. Live streaming belongs to
 * the resident daemon (M1-S18); this release is one-shot scheduling only.
 */
const RESIDENT_DAEMON_WATCH_HINT =
  "Live --watch streaming is provided by the resident daemon (M1-S18), which is not part of this one-shot release; rerun without --watch.";

const watchRefusal = (): { readonly error: Record<string, string> } => ({
  error: {
    kind: "fallback",
    code: "fallback.invocation",
    summary: "result=refused; reason=watch-unsupported",
    remediationHint: RESIDENT_DAEMON_WATCH_HINT,
  },
});

const invocationRefusal = (reason: string): { readonly error: Record<string, string> } => ({
  error: {
    kind: "fallback",
    code: "fallback.invocation",
    summary: `result=refused; reason=${reason}`,
  },
});

const parseUntil = (value: string | true | undefined): string | undefined => {
  if (typeof value !== "string") return undefined;
  return Number.isFinite(Date.parse(value)) ? value : undefined;
};

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
): QueueReadData =>
  boundQueueReadData({
    schemaVersion: "delivery.queue.v1",
    entries: schedule.entries,
    leases: schedule.leases,
    weights: schedule.weights,
    parks: schedule.parks,
    findings: schedule.findings,
    degraded,
    truncated: schedule.truncated,
    ...(schedule.ownerHold === undefined ? {} : { ownerHold: schedule.ownerHold }),
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
): QueuePlanData =>
  boundQueuePlanData({
    ...toQueueReadData(schedule, degraded),
    nextActions: schedule.nextActions,
  });

const mutationData = (mutation: QueueRuntimeMutation): QueueMutationData => {
  if (!mutation.ok) throw new Error("mutation failure is not data");
  return {
    ref: mutation.ref,
    entry: {
      ref: mutation.ref,
      ...(mutation.entry.repository === undefined ? {} : { repository: mutation.entry.repository }),
      state: mutation.entryState,
      rankClass: mutation.entry.rankClass,
      priority: mutation.entry.priority,
      weightClass: mutation.weightClass,
      weightClassSource: mutation.weightClassSource,
      deps: mutation.edges,
      blocking: mutation.blocking,
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

/** The `queue remove` payload (GH-292 Appendix C): exactly the six declared keys. */
const removalData = (removal: QueueRuntimeRemoval): QueueRemoveData => {
  if (!removal.ok) throw new Error("removal failure is not data");
  return {
    ref: removal.ref,
    result: "removed",
    reason: removal.reason,
    readySet: removal.readySet,
    event: { topic: "queue.graph", kind: "remove" },
    degraded: removal.degraded,
  };
};

/** The `queue dep remove` payload (GH-292 Appendix C): mutation keys plus two. */
const dependencyRemovalData = (
  removal: QueueRuntimeDependencyRemoval,
): QueueDependencyRemovalData => {
  if (!removal.ok) throw new Error("dependency-removal failure is not data");
  return {
    ref: removal.ref,
    entry: {
      ref: removal.ref,
      ...(removal.entry.repository === undefined ? {} : { repository: removal.entry.repository }),
      state: removal.entryState,
      rankClass: removal.entry.rankClass,
      priority: removal.entry.priority,
      weightClass: removal.weightClass,
      weightClassSource: removal.weightClassSource,
      deps: removal.edges,
      blocking: removal.blocking,
    },
    edges: removal.edges,
    result: removal.result,
    readySet: removal.readySet,
    event: { topic: "queue.graph", kind: "dependency-edge" },
    degraded: removal.degraded,
  };
};

/** The `queue reconcile` payload (GH-292 Appendix C): exactly the nine keys. */
const reconcileData = (swept: QueueRuntimeReconcile): QueueReconcileData => {
  if (!swept.ok) throw new Error("reconcile failure is not data");
  return {
    result: swept.value.result,
    checked: swept.value.checked,
    removed: swept.value.removed,
    retained: swept.value.retained,
    unobserved: swept.value.unobserved,
    readySet: swept.readySet,
    truncated: swept.value.truncated,
    remainder: swept.value.remainder,
    degraded: swept.degraded,
  };
};

/** Failures print `result=refused` before the classified refusal. */
const humanFailure = (): string => "result=refused\n";

/**
 * The full `queue` command definition. `ready` is delegated to the delivered
 * definition unchanged; the additive subcommands share the declared grammar and
 * bounded untrusted-input validation before any read.
 */
export const createQueueCommandDefinition = (runtime: QueueCommandRuntime): CommandDefinition => ({
  flags: [
    "--next",
    "--priority",
    "--dep",
    "--holder",
    "--park",
    "--until",
    "--reason",
    "--ref",
    "--watch",
  ],
  ...(runtime.watch === undefined
    ? {}
    : {
        stream: (invocation: { readonly flags: Readonly<Record<string, string | true>> }) =>
          invocation.flags["--watch"] !== undefined ? runtime.watch!() : (async function* () {})(),
      }),
  requiresValue: [
    "--next",
    "--priority",
    "--dep",
    "--holder",
    "--park",
    "--until",
    "--reason",
    "--ref",
  ],
  positionals: { max: QUEUE_READY_MAX_POSITIONALS },
  humanText: (data: unknown): string => renderQueueHuman(data as never),
  humanFailureText: (): string => humanFailure(),
  handler: async (invocation) => {
    if (invocation.flags["--watch"] !== undefined) {
      if (runtime.watch === undefined) return watchRefusal();
      return { data: { watch: true, topic: "queue" } };
    }
    const [subcommand, first, second, ...extra] = invocation.positionals;
    // `--ref` belongs to `queue reconcile` only (TC-QLC-074); every other verb
    // refuses it before any read.
    if (invocation.flags["--ref"] !== undefined && subcommand !== "reconcile") {
      return fullGrammarRejection("ref-unsupported");
    }
    if (subcommand === "ready") {
      if (runtime.readyDefinition === undefined) {
        return fullGrammarRejection("ready-unavailable");
      }
      if (Object.keys(invocation.flags).length > 0) return invocationRefusal("ready-flags");
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
      const priority = priorityValue === undefined ? undefined : parsePriority(priorityValue);
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
      if (ref === undefined || second === undefined || extra.length > 0) {
        return fullGrammarRejection("prioritize-grammar");
      }
      const priority = parsePriority(second);
      if (priority === undefined) return fullGrammarRejection("priority");
      const mutation = runtime.prioritize({ ref, priority });
      if (!mutation.ok) return runtimeFailure(mutation);
      return { data: mutationData(mutation) };
    }
    if (subcommand === "dep") {
      // The explicit grammar (GH-292 F-3): `dep add <ref> <on-ref>` and
      // `dep remove <ref> <on-ref>`; the delivered two-positional add
      // (`dep <ref> <on-ref>`) is preserved byte-for-byte. The verb token is
      // never parsed as a ref: only a canonical ref in the ref slots proceeds.
      const explicit =
        first === "add" || first === "remove" ? (first as "add" | "remove") : undefined;
      const refToken = explicit === undefined ? first : second;
      const onRefToken = explicit === undefined ? second : extra[0];
      const trailing = explicit === undefined ? extra.length : extra.length - 1;
      if (trailing !== 0) return fullGrammarRejection("dep-positionals");
      const depRef = refToken === undefined ? undefined : canonicalQueueRef(refToken);
      const onRef = onRefToken === undefined ? undefined : canonicalQueueRef(onRefToken);
      if (depRef === undefined || onRef === undefined) return fullGrammarRejection("dep-grammar");
      if (explicit === "remove") {
        const removal = runtime.depRemove({ ref: depRef, onRef });
        if (!removal.ok) return runtimeFailure(removal);
        return { data: dependencyRemovalData(removal) };
      }
      const mutation = runtime.dep({ ref: depRef, onRef });
      if (!mutation.ok) return runtimeFailure(mutation);
      return { data: mutationData(mutation) };
    }
    if (subcommand === "remove") {
      if (ref === undefined || second !== undefined) return fullGrammarRejection("remove-grammar");
      const reasonFlag = invocation.flags["--reason"];
      // A missing flag is the queue identity (`queue.reason-missing`, resolved
      // by the core seam); an out-of-vocabulary or valueless flag value is the
      // delivered input identity naming the offending value (TC-QLC-003).
      if (reasonFlag !== undefined) {
        if (typeof reasonFlag !== "string" || reasonFlag === "") {
          return reasonRejection("value-missing");
        }
        if (!isRemovalReason(reasonFlag)) return reasonRejection(reasonFlag);
      }
      // Grammar never invents either identity for the accepted forms; the
      // runtime's core seam owns the pre-append refusals (unobserved ref,
      // live lease) and the missing-flag queue identity.
      const removal = runtime.remove({
        ref,
        ...(typeof reasonFlag === "string" && isRemovalReason(reasonFlag)
          ? { reason: reasonFlag }
          : {}),
      });
      if (!removal.ok) return runtimeFailure(removal);
      return { data: removalData(removal) };
    }
    if (subcommand === "reconcile") {
      if (first !== undefined) return fullGrammarRejection("reconcile-positionals");
      const refFlag = invocation.flags["--ref"];
      const refCanonical = typeof refFlag === "string" ? canonicalQueueRef(refFlag) : undefined;
      if (refFlag !== undefined && refCanonical === undefined) {
        return fullGrammarRejection("ref");
      }
      // The sweep is async: the tracker read port resolves per examined entry.
      const swept = await runtime.reconcile({
        ...(refCanonical === undefined ? {} : { ref: refCanonical }),
      });
      if (!swept.ok) return runtimeFailure(swept);
      return { data: reconcileData(swept) };
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
      // `--reason` belongs to `queue remove` only; on release it is a grammar
      // refusal (TC-QLC-074), never an accepted no-op flag.
      if (invocation.flags["--reason"] !== undefined) {
        return fullGrammarRejection("reason-unsupported");
      }
      const holderFlag = invocation.flags["--holder"];
      const parkFlag = invocation.flags["--park"];
      const untilFlag = invocation.flags["--until"];
      if (parkFlag !== undefined) {
        if (typeof parkFlag !== "string" || !isParkCause(parkFlag)) {
          return fullGrammarRejection("park-cause");
        }
      }
      const until = parseUntil(untilFlag);
      if (untilFlag !== undefined && until === undefined) return invocationRefusal("until");
      if (parkFlag === "provider-window" && until === undefined) {
        return invocationRefusal("until-required");
      }
      if (parkFlag === undefined && until !== undefined) {
        return invocationRefusal("until-without-park");
      }
      if (parkFlag !== undefined && parkFlag !== "provider-window" && until !== undefined) {
        return invocationRefusal("until-unsupported");
      }
      const release = runtime.release({
        ref,
        ...(typeof holderFlag === "string" ? { holder: holderFlag } : {}),
        ...(typeof parkFlag === "string" && isParkCause(parkFlag) ? { parkCause: parkFlag } : {}),
        ...(until === undefined ? {} : { parkUntil: until }),
      });
      if (!release.ok) return runtimeFailure(release);
      return { data: releaseData(release) };
    }
    return fullGrammarRejection("subcommand");
  },
});

/** The accepted mutation/claim/release/removal result vocabularies (structural re-export). */
export const QUEUE_MUTATION_RESULT_VALUES = QUEUE_MUTATION_RESULTS;
export const QUEUE_CLAIM_RESULT_VALUES = QUEUE_CLAIM_RESULTS;
export const QUEUE_RELEASE_RESULT_VALUES = QUEUE_RELEASE_RESULTS;
export const QUEUE_DEPENDENCY_MUTATION_RESULT_VALUES = QUEUE_DEPENDENCY_MUTATION_RESULTS;
export const QUEUE_REMOVAL_RESULT_VALUES = QUEUE_REMOVAL_RESULTS;
export const QUEUE_RECONCILE_RESULT_VALUES = QUEUE_RECONCILE_RESULTS;
export const QUEUE_MAX_NEXT = QUEUE_MAX_NEXT_ACTIONS;
export const QUEUE_MAX_REFERENCE_CHARS = QUEUE_MAX_REF_CHARS;
