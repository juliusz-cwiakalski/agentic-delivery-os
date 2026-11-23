/**
 * The pure dispatch result derivation (GH-239 F-2, F-12; DM-1; DEC-14;
 * Appendix G).
 *
 * Runtime-neutral and I/O-free: it consumes injected reads as data and returns a
 * token, a harness outcome, and the projection class. It never reads the process
 * exit code, never declares an exit literal, and never declares a result token
 * of its own — every token comes from the delivered taxonomy and every failure
 * identity from the declared error table.
 */
import {
  DELIVERY_RESULT_TAXONOMY,
  DELIVERY_RESULT_TOKENS,
  DISPATCH_PUSH_VERDICTS,
  HARNESS_OUTCOMES,
  type DeliveryResultToken,
  type DispatchCorroborationArm,
  type DispatchEnvelopePushBlock,
  type DispatchHandoverState,
  type DispatchPushParityReading,
  type HarnessOutcome,
  type PmNotesCompleteness,
  type ProjectionClass,
} from "#contracts";

/** A local alias: keeps the payload field type recognizable and short. */
type DispatchToken = DeliveryResultToken;

/**
 * Short local aliases: keep this module free of token literals and of long
 * colon-adjacent identifiers. `m` merged, `b` blocked, `po` pr-open, `pou`
 * pr-open-unverified, `f` failed, `mr` max-restarts, `su` state-unverified,
 * `np` noop-lane-permission, `nn` noop-lane-nothing-to-do.
 */
const [m, b, po, pou, f, fin, mr, su, par, np, nn] = DELIVERY_RESULT_TOKENS;
const [, , O_FAILED, O_REFUSED] = HARNESS_OUTCOMES;

/** One injected truth read: the value, or a classified unreadable reason. */
export type DispatchRead<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: DispatchReadFailure; readonly identity?: string };

/** The closed read-failure sources. */
export const DISPATCH_READ_FAILURE_SOURCES = ["ledger", "tracker", "artifact", "state"] as const;

export type DispatchReadFailure = (typeof DISPATCH_READ_FAILURE_SOURCES)[number];

/** The PR fact the artifact read reports; `url` is empty when unresolved. */
export type DispatchPrFact = {
  readonly state: "none" | "open" | "already-merged" | "closed";
  readonly url: string | null;
  readonly mergeReady: boolean;
};

/**
 * The artifact read: branch commits, the independently observed PR fact, and
 * the required pm-notes completeness projection (GH-347 DM-3, TDR-0053).
 *
 * `complete` is a present document whose delivery phase carries a non-null
 * completion; `absent` is no document; `incomplete` is present but incomplete,
 * unparseable, or otherwise not complete. The fallible direction is never
 * `complete`.
 */
export type DispatchArtifactFacts = {
  readonly branchCommits: number;
  readonly pr: DispatchPrFact;
  readonly pmNotes: PmNotesCompleteness;
};

/** The phase-ledger fact, including whether this dispatch advanced it. */
export type DispatchLedgerFacts = {
  readonly completed: number;
  readonly total: number;
  readonly lastCompletedPhase?: string;
  readonly progressed: boolean;
  readonly workRemaining: boolean;
};

/** The tracker fact: a delivery-blocking state is explicit, never inferred. */
export type DispatchTrackerFacts = {
  readonly state: "in-progress" | "delivery-blocked" | "done";
  readonly blocking: boolean;
};

/** The harness fact: the shared classifier's output plus the raw exit status. */
export type DispatchHarnessFacts = {
  readonly outcome: HarnessOutcome;
  readonly token: DispatchToken;
  readonly exitStatus: number | null;
  readonly spawnRefused: boolean;
};

/** The restart-budget fact resolved from the lane policy. */
export type DispatchRestartFacts = {
  readonly count: number;
  readonly bound: number;
};

/** A resume-admission refusal on an existing lane (never a pre-session refusal). */
export type DispatchResumeAdmission = {
  readonly admitted: boolean;
  readonly reason: "uneconomical" | "unreadable-facts";
};

/** Everything the derivation consumes; all of it is injected data. */
export type DispatchTruthInput = {
  readonly harness: DispatchRead<DispatchHarnessFacts>;
  readonly artifacts: DispatchRead<DispatchArtifactFacts>;
  readonly ledger: DispatchRead<DispatchLedgerFacts>;
  readonly tracker: DispatchRead<DispatchTrackerFacts>;
  readonly restarts: DispatchRestartFacts;
  readonly handoverState: DispatchHandoverState;
  /** A spawn attempt that failed before a session existed. */
  readonly spawnFailure?: boolean;
  readonly resumeAdmission?: DispatchResumeAdmission;
  /**
   * The terminal parity fact the ensure-push capability produced (GH-386 F-1).
   * Present exactly when the composed capability evaluated the precondition;
   * absent keeps the delivered classification for a composition that declared
   * no act (the daemon lane and pre-change compositions).
   */
  readonly pushParity?: DispatchPushParityReading;
};

/**
 * The closed arm ids of the total ladder (GH-347 Appendix F, AC-F8-5).
 *
 * Module-internal by design: it instruments the one derivation for the
 * per-input disjointness assertion and is never a contract, a token, or a
 * projection. Each derivation return names exactly the ONE arm that produced
 * it, so no two arms can claim the same input.
 */
const DISPATCH_RESULT_ARM_IDS = [
  "spawn-failure",
  "resume-uneconomical",
  "resume-unreadable",
  "restart-budget",
  "harness-unreadable",
  "spawn-refused",
  "tracker-done",
  "blocking",
  "open-pr",
  "open-pr-unverified",
  "already-merged",
  "commits-complete",
  "commits-incomplete",
  "nothing-to-do",
  "classifier",
  "undecidable",
] as const;

type DispatchResultArmId = (typeof DISPATCH_RESULT_ARM_IDS)[number];

/** The pure derivation verdict: a token, its outcome, and its projection class. */
export type DispatchDerivation = {
  readonly token: DispatchToken;
  readonly outcome: HarnessOutcome;
  readonly projectionClass: ProjectionClass;
  readonly prUrl: string;
  readonly handoverState: DispatchHandoverState;
  /** The engine-side URL-resolution attribute for a tracker claim. */
  readonly urlResolved: boolean;
  readonly lastMessage: string;
  readonly missingArtifact?: "branch-commit" | "pull-request" | "ledger-progress";
  /**
   * The one closed ladder arm that produced this verdict (AC-F8-5
   * disjointness). Instrumentation for the derivation's own proof; it is not a
   * token, a projection, or a persisted field.
   */
  readonly armId?: string;
  /** The classified error identity for a derived failure, never prose. */
  readonly errorCode?: string;
  readonly readFailure?: DispatchReadFailure;
  /**
   * The closed corroboration arm, decided ONCE here at the two arm-aware
   * branches (GH-347 DEC-6, TDR-0053) and passed unchanged to both evaluation
   * sites. Absent for every other token, whose requirement is token-keyed.
   */
  readonly corroborationArm?: DispatchCorroborationArm;
  /**
   * The terminal parity disclosure (GH-386 DM-1/DM-2), present exactly on the
   * two precondition-evaluating verdicts: the `pr-open` success (`clean` or
   * `pushed`, parity true) and the typed push failure (`failed`, parity false,
   * PR URL retained). It names the envelope block, the reserved evidence
   * reference, and the not-applicable comparison reason.
   */
  readonly push?: DispatchEnvelopePushBlock;
};

const projectionOf = (value: DeliveryResultToken): ProjectionClass => {
  const row = DELIVERY_RESULT_TAXONOMY.find((entry) => entry.token === value);
  if (row === undefined) throw new Error(`delivery-result token has no taxonomy row`);
  return row.projectionClass;
};

/** The closed push-verdict union, destructured once (no literal in this module). */
const [PUSH_VERDICT_CLEAN, PUSH_VERDICT_PUSHED, PUSH_VERDICT_FAILED] = DISPATCH_PUSH_VERDICTS;

/**
 * The arm-8 (open pull request, URL resolved) parity precondition (GH-386 F-1,
 * DEC-5; OQ-1).
 *
 * `pr-open` derives only from a readable equality with a non-failed act
 * verdict. An unreadable parity read is the delivered undecidable-truth
 * semantics (`state-unverified` at exit 2) and never lands in the push-failure
 * row; a readable inequality and every non-successful act outcome — rejected,
 * failed, timed out, or a spawn-level act failure — classify the one new
 * failure row with the PR URL retained. Absent parity facts keep the delivered
 * classification: a composition that supplies none has declared no act (the
 * daemon lane and pre-change compositions; `pr-open-unverified` never reaches
 * this arm at all — no precondition, no evidence, no envelope block).
 */
const deriveOpenPrWithParity = (input: DispatchTruthInput, url: string): DispatchDerivation => {
  const parity = input.pushParity;
  if (parity === undefined) {
    return base(input, {
      token: po,
      outcome: input.harness.ok ? input.harness.value.outcome : O_FAILED,
      prUrl: url,
      urlResolved: true,
      lastMessage: "the pull request is open and awaits the coordinator's merge decision",
      armId: "open-pr",
    });
  }
  if (!parity.ok) {
    return base(input, {
      token: su,
      outcome: O_FAILED,
      prUrl: url,
      urlResolved: true,
      lastMessage: `push parity read unreadable (${parity.identity ?? "parity-read"})`,
      armId: "open-pr",
      errorCode: "dispatch.state-unverified",
      readFailure: "state",
    });
  }
  const facts = parity.facts;
  if (facts.verdict !== PUSH_VERDICT_FAILED && facts.parity) {
    return base(input, {
      token: po,
      outcome: input.harness.ok ? input.harness.value.outcome : O_FAILED,
      prUrl: url,
      urlResolved: true,
      lastMessage: "the pull request is open and awaits the coordinator's merge decision",
      armId: "open-pr",
      push: {
        verdict: facts.verdict === PUSH_VERDICT_CLEAN ? PUSH_VERDICT_CLEAN : PUSH_VERDICT_PUSHED,
        localHead: facts.localHead,
        remoteHead: facts.remoteHead,
        parity: true,
      },
    });
  }
  return base(input, {
    token: f,
    outcome: O_FAILED,
    prUrl: url,
    urlResolved: true,
    lastMessage: "the ensure-push act could not establish branch parity",
    armId: "open-pr",
    push: {
      verdict: PUSH_VERDICT_FAILED,
      localHead: facts.localHead,
      remoteHead: facts.remoteHead,
      parity: false,
    },
  });
};

const base = (
  input: DispatchTruthInput,
  fields: {
    readonly token: DispatchToken;
    readonly outcome: HarnessOutcome;
    readonly prUrl?: string;
    readonly urlResolved?: boolean;
    readonly lastMessage: string;
    readonly missingArtifact?: DispatchDerivation["missingArtifact"];
    readonly armId: DispatchResultArmId;
    readonly errorCode?: string;
    readonly readFailure?: DispatchReadFailure;
    readonly corroborationArm?: DispatchCorroborationArm;
    readonly push?: DispatchEnvelopePushBlock;
  },
): DispatchDerivation => ({
  token: fields.token,
  outcome: fields.outcome,
  projectionClass: projectionOf(fields.token),
  prUrl: fields.prUrl ?? "",
  handoverState: input.handoverState,
  urlResolved: fields.urlResolved ?? false,
  lastMessage: fields.lastMessage,
  armId: fields.armId,
  ...(fields.missingArtifact === undefined ? {} : { missingArtifact: fields.missingArtifact }),
  ...(fields.errorCode === undefined ? {} : { errorCode: fields.errorCode }),
  ...(fields.readFailure === undefined ? {} : { readFailure: fields.readFailure }),
  ...(fields.corroborationArm === undefined ? {} : { corroborationArm: fields.corroborationArm }),
  ...(fields.push === undefined ? {} : { push: fields.push }),
});

/**
 * Derive the dispatch result, artifact-first (Appendix G, DEC-14).
 *
 * Explicit attempt-stage refusals win first, then a harness spawn refusal
 * (a recorded attempt), then unreadable truth (`state-unverified`, exit 2),
 * then tracker truth, then PR/artifact truth, then lane exhaustion, then an
 * exit-0-with-no-artifact failure, then the shared classifier's outcome.
 */
export const deriveDispatchResult = (input: DispatchTruthInput): DispatchDerivation => {
  if (input.spawnFailure === true) {
    return base(input, {
      token: f,
      outcome: O_FAILED,
      lastMessage: "spawn failed before a session existed",
      armId: "spawn-failure",
      errorCode: "dispatch.session.spawn-failed",
    });
  }

  if (input.resumeAdmission !== undefined && !input.resumeAdmission.admitted) {
    if (input.resumeAdmission.reason === "uneconomical") {
      return base(input, {
        token: f,
        outcome: O_FAILED,
        lastMessage: "resume refused: the prefill re-pay is uneconomical",
        armId: "resume-uneconomical",
        errorCode: "dispatch.resume-uneconomical",
      });
    }
    return base(input, {
      token: su,
      outcome: O_FAILED,
      lastMessage: "resume admission could not read its token or cost facts",
      armId: "resume-unreadable",
      errorCode: "dispatch.state-unverified",
      readFailure: "state",
    });
  }

  // GH-347 AC-F6-4/AC-F6-6, §8.5 "Persisted-bound re-key narrowed": the re-key
  // fires ONLY for the restart-eligible harness-reported timeout (a terminal
  // stall). A clean exit, a premature end, a tool failure, or a non-zero exit at
  // the bound keeps its own classification; the loop remains the producer of
  // `max-restarts` for the stall path (it records directly and never re-derives).
  const restartEligibleTimeout = input.harness.ok && input.harness.value.outcome === "timed-out";
  if (
    input.restarts.bound > 0 &&
    input.restarts.count >= input.restarts.bound &&
    restartEligibleTimeout
  ) {
    return base(input, {
      token: mr,
      outcome: O_FAILED,
      lastMessage: `restart budget exhausted at ${input.restarts.count} of ${input.restarts.bound}`,
      armId: "restart-budget",
      errorCode: "dispatch.restart-budget-exceeded",
    });
  }

  if (!input.harness.ok) {
    return base(input, {
      token: su,
      outcome: O_FAILED,
      lastMessage: `harness read unreadable (${input.harness.identity ?? "harness"})`,
      armId: "harness-unreadable",
      errorCode: "dispatch.state-unverified",
      readFailure: "state",
    });
  }

  if (input.harness.value.spawnRefused) {
    return base(input, {
      token: np,
      outcome: O_REFUSED,
      lastMessage: "the harness refused before a session existed (spawn-refused)",
      armId: "spawn-refused",
    });
  }

  // GH-347 Appendix F — the ONE total order, shared unchanged by the one-shot
  // and daemon paths. The tracker arms precede every artifact read, so an
  // unreadable artifact or ledger never degrades a decisive tracker verdict.
  const harness = input.harness.value;
  if (input.tracker.ok) {
    const tracker = input.tracker.value;
    if (tracker.state === "done") {
      return base(input, {
        token: m,
        outcome: harness.outcome,
        lastMessage: "the tracker work item is done",
        armId: "tracker-done",
        corroborationArm: "tracker-done-merged",
      });
    }
    if (tracker.blocking || tracker.state === "delivery-blocked") {
      return base(input, {
        token: b,
        outcome: harness.outcome,
        lastMessage: "the tracker reports a delivery-blocking state",
        armId: "blocking",
      });
    }
  }

  // Appendix F(C) arms 4-7 are the DECISIVE ARTIFACT arms and apply to EVERY
  // ENDED, non-stall session — never only to a `finished` classifier token
  // (AC-F4-3: "completed session ... the artifact verdict is the result"; §8.5
  // "After a completed session, derivation is artifact-first"). A harness-
  // reported timeout IS a terminal stall (Appendix F(D)) and is the loop's
  // decision, so it never takes an artifact arm.
  const completedSession = harness.token === fin;
  const stalledSession = harness.outcome === "timed-out";

  if (input.artifacts.ok) {
    const artifacts = input.artifacts.value;
    const pr = artifacts.pr;
    if (stalledSession) {
      // A harness-reported timeout belongs to the stall ladder (Appendix F(D)):
      // this ladder yields only the shared classifier's token for it.
      return base(input, {
        token: harness.token,
        outcome: harness.outcome,
        lastMessage: `the shared classifier reported ${harness.outcome}`,
        armId: "classifier",
      });
    }
    if (pr.state === "open") {
      const resolved = pr.url !== null && pr.url.length > 0;
      if (resolved) {
        return deriveOpenPrWithParity(input, pr.url);
      }
      return base(input, {
        token: pou,
        outcome: harness.outcome,
        prUrl: "",
        urlResolved: false,
        lastMessage: "the pull request is open; its URL could not be resolved",
        armId: "open-pr-unverified",
      });
    }
    if (pr.state === "already-merged") {
      return base(input, {
        token: m,
        outcome: harness.outcome,
        prUrl: pr.url ?? "",
        urlResolved: pr.url !== null && pr.url.length > 0,
        lastMessage: "the pull request is already merged (detection only)",
        armId: "already-merged",
      });
    }
    if (artifacts.branchCommits > 0) {
      return artifacts.pmNotes === "complete"
        ? base(input, {
            token: fin,
            outcome: harness.outcome,
            lastMessage: "the branch carries commits and the pm-notes are complete",
            armId: "commits-complete",
          })
        : base(input, {
            token: par,
            outcome: harness.outcome,
            lastMessage: "the branch carries commits but the pm-notes are not complete",
            armId: "commits-incomplete",
          });
    }
    // Arm 8 is the ONE arm whose reading is a tracker judgement about a clean
    // completion, not an artifact verdict: "nothing was attempted" is only
    // observable when the session completed. A non-clean end keeps its own
    // classifier token at arm 9 (Appendix F(C)(9)).
    if (!completedSession) {
      return base(input, {
        token: harness.token,
        outcome: harness.outcome,
        lastMessage: `the shared classifier reported ${harness.outcome}`,
        armId: "classifier",
      });
    }
    // No commits and no pull request: the shell arm needs a READABLE, non-done,
    // non-blocked tracker (already established above). An unreadable tracker
    // never takes the arm.
    if (!input.tracker.ok) {
      return base(input, {
        token: su,
        outcome: O_FAILED,
        lastMessage: `truth read unreadable (${input.tracker.identity ?? input.tracker.reason})`,
        armId: "undecidable",
        errorCode: "dispatch.state-unverified",
        readFailure: input.tracker.reason,
      });
    }
    return base(input, {
      token: nn,
      outcome: harness.outcome,
      lastMessage: "the lane has no remaining work",
      armId: "nothing-to-do",
      corroborationArm: "nothing-to-do",
    });
  }

  // Arm 9 precedes arm 10: a non-clean end with no readable artifact keeps the
  // shared classifier's token (its arm is exhaustive over the session outcome),
  // and only a clean completion whose truth is unreadable is undecidable.
  if (!completedSession) {
    return base(input, {
      token: harness.token,
      outcome: harness.outcome,
      lastMessage: `the shared classifier reported ${harness.outcome}`,
      armId: "classifier",
    });
  }

  // The artifact read is unreadable and no tracker verdict decided the outcome.
  // The disclosed reason follows the delivered unreadable-truth preference
  // (tracker before artifact), so the failure identity named to the operator is
  // the same one that decided undecidability.
  if (!input.tracker.ok) {
    return base(input, {
      token: su,
      outcome: O_FAILED,
      lastMessage: `truth read unreadable (${input.tracker.identity ?? input.tracker.reason})`,
      armId: "undecidable",
      errorCode: "dispatch.state-unverified",
      readFailure: input.tracker.reason,
    });
  }
  return base(input, {
    token: su,
    outcome: O_FAILED,
    lastMessage: `truth read unreadable (${input.artifacts.identity ?? input.artifacts.reason})`,
    armId: "undecidable",
    errorCode: "dispatch.state-unverified",
    readFailure: input.artifacts.reason,
  });
};

/** The closed attempt-stage failure identities (Appendix G). */
export const DISPATCH_FAILURE_KINDS = [
  "spawn-failed",
  "state-unreadable",
  "restart-budget-exceeded",
  "resume-uneconomical",
  "lifecycle-push-failure",
] as const;

export type DispatchFailureKind = (typeof DISPATCH_FAILURE_KINDS)[number];

/** One classified attempt-stage failure (Appendix G). */
export type DispatchFailureClassification = {
  readonly kind: DispatchFailureKind;
  /**
   * The envelope error identity the row carries. Every delivered row names a
   * registry-synced identity; the lifecycle push failure is the one
   * identity-less row — its envelope is the delivered data-bearing shape with
   * no top-level `error` (GH-386 F-3/DM-3: no error identity is added).
   */
  readonly code:
    | "dispatch.session.spawn-failed"
    | "dispatch.state-unverified"
    | "dispatch.restart-budget-exceeded"
    | "dispatch.resume-uneconomical"
    | null;
  readonly token: DispatchToken;
  readonly outcome: HarnessOutcome;
  readonly projectionClass: ProjectionClass;
  readonly attemptRecords: 1;
  readonly comparisonReason:
    | "dispatch-session-family"
    | "comparison-source-unavailable"
    | "push-parity-unmet";
};

/**
 * Classify an attempt-stage dispatch failure (Appendix G).
 *
 * A spawn failure, a spawn refusal, a restart-budget refusal, and a
 * resume-economics refusal each append exactly one attempt record; the three
 * pre-session refusals (unknown harness, rejected input, conflicting lease) are
 * never classified here and produce no token.
 */
export const classifyDispatchFailure = (input: {
  readonly kind: DispatchFailureKind;
  readonly readFailure?: DispatchReadFailure;
}): DispatchFailureClassification => {
  switch (input.kind) {
    case "spawn-failed":
      return {
        kind: input.kind,
        code: "dispatch.session.spawn-failed",
        token: f,
        outcome: O_FAILED,
        projectionClass: projectionOf(f),
        attemptRecords: 1,
        comparisonReason: "comparison-source-unavailable",
      };
    case "state-unreadable":
      return {
        kind: input.kind,
        code: "dispatch.state-unverified",
        token: su,
        outcome: O_FAILED,
        projectionClass: projectionOf(su),
        attemptRecords: 1,
        comparisonReason: "comparison-source-unavailable",
      };
    case "restart-budget-exceeded":
      return {
        kind: input.kind,
        code: "dispatch.restart-budget-exceeded",
        token: mr,
        outcome: O_FAILED,
        projectionClass: projectionOf(mr),
        attemptRecords: 1,
        comparisonReason: "dispatch-session-family",
      };
    case "resume-uneconomical":
      return {
        kind: input.kind,
        code: "dispatch.resume-uneconomical",
        token: f,
        outcome: O_FAILED,
        projectionClass: projectionOf(f),
        attemptRecords: 1,
        comparisonReason: "comparison-source-unavailable",
      };
    case "lifecycle-push-failure":
      // GH-386 Appendix B, verbatim: the one new row — failed / failed / exit 1
      // (the delivered user-validation projection) / exactly one attempt record
      // / comparison not applicable, token null, reason push-parity-unmet. No
      // error identity, no token, no domain kind, and no error-table row.
      return {
        kind: input.kind,
        code: null,
        token: f,
        outcome: O_FAILED,
        projectionClass: projectionOf(f),
        attemptRecords: 1,
        comparisonReason: "push-parity-unmet",
      };
  }
};

/** The recorded harness spawn refusal (not an error identity, never pre-session). */
export type DispatchSpawnRefusal = {
  readonly token: DispatchToken;
  readonly outcome: HarnessOutcome;
  readonly projectionClass: ProjectionClass;
  readonly attemptRecords: 1;
  readonly comparisonReason: "dispatch-session-family";
};

export const classifySpawnRefusal = (): DispatchSpawnRefusal => ({
  token: np,
  outcome: O_REFUSED,
  projectionClass: projectionOf(np),
  attemptRecords: 1,
  comparisonReason: "dispatch-session-family",
});
