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
  HARNESS_OUTCOMES,
  type DeliveryResultToken,
  type DispatchHandoverState,
  type HarnessOutcome,
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
const [m, b, po, pou, f, , mr, su, , np, nn] = DELIVERY_RESULT_TOKENS;
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

/** The artifact read: branch commits plus the independently observed PR fact. */
export type DispatchArtifactFacts = {
  readonly branchCommits: number;
  readonly pr: DispatchPrFact;
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
};

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
  /** The classified error identity for a derived failure, never prose. */
  readonly errorCode?: string;
  readonly readFailure?: DispatchReadFailure;
};

const projectionOf = (value: DeliveryResultToken): ProjectionClass => {
  const row = DELIVERY_RESULT_TAXONOMY.find((entry) => entry.token === value);
  if (row === undefined) throw new Error(`delivery-result token has no taxonomy row`);
  return row.projectionClass;
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
    readonly errorCode?: string;
    readonly readFailure?: DispatchReadFailure;
  },
): DispatchDerivation => ({
  token: fields.token,
  outcome: fields.outcome,
  projectionClass: projectionOf(fields.token),
  prUrl: fields.prUrl ?? "",
  handoverState: input.handoverState,
  urlResolved: fields.urlResolved ?? false,
  lastMessage: fields.lastMessage,
  ...(fields.missingArtifact === undefined ? {} : { missingArtifact: fields.missingArtifact }),
  ...(fields.errorCode === undefined ? {} : { errorCode: fields.errorCode }),
  ...(fields.readFailure === undefined ? {} : { readFailure: fields.readFailure }),
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
      errorCode: "dispatch.session.spawn-failed",
    });
  }

  if (input.resumeAdmission !== undefined && !input.resumeAdmission.admitted) {
    if (input.resumeAdmission.reason === "uneconomical") {
      return base(input, {
        token: f,
        outcome: O_FAILED,
        lastMessage: "resume refused: the prefill re-pay is uneconomical",
        errorCode: "dispatch.resume-uneconomical",
      });
    }
    return base(input, {
      token: su,
      outcome: O_FAILED,
      lastMessage: "resume admission could not read its token or cost facts",
      errorCode: "dispatch.state-unverified",
      readFailure: "state",
    });
  }

  if (input.restarts.bound > 0 && input.restarts.count >= input.restarts.bound) {
    return base(input, {
      token: mr,
      outcome: O_FAILED,
      lastMessage: `restart budget exhausted at ${input.restarts.count} of ${input.restarts.bound}`,
      errorCode: "dispatch.restart-budget-exceeded",
    });
  }

  if (!input.harness.ok) {
    return base(input, {
      token: su,
      outcome: O_FAILED,
      lastMessage: `harness read unreadable (${input.harness.identity ?? "harness"})`,
      errorCode: "dispatch.state-unverified",
      readFailure: "state",
    });
  }

  if (input.harness.value.spawnRefused) {
    return base(input, {
      token: np,
      outcome: O_REFUSED,
      lastMessage: "the harness refused before a session existed (spawn-refused)",
    });
  }

  for (const read of [input.ledger, input.tracker, input.artifacts] as const) {
    if (!read.ok) {
      return base(input, {
        token: su,
        outcome: O_FAILED,
        lastMessage: `truth read unreadable (${read.identity ?? read.reason})`,
        errorCode: "dispatch.state-unverified",
        readFailure: read.reason,
      });
    }
  }

  // Every read is readable from here; narrow for the rest of the derivation.
  const harness = input.harness.value;
  const ledger = input.ledger.ok ? input.ledger.value : undefined;
  const tracker = input.tracker.ok ? input.tracker.value : undefined;
  const artifacts = input.artifacts.ok ? input.artifacts.value : undefined;
  if (ledger === undefined || tracker === undefined || artifacts === undefined) {
    return base(input, {
      token: su,
      outcome: O_FAILED,
      lastMessage: "truth read unreadable",
      errorCode: "dispatch.state-unverified",
      readFailure: "state",
    });
  }

  if (tracker.blocking || tracker.state === "delivery-blocked") {
    return base(input, {
      token: b,
      outcome: harness.outcome,
      lastMessage: "the tracker reports a delivery-blocking state",
    });
  }

  const pr = artifacts.pr;
  if (pr.state === "already-merged") {
    return base(input, {
      token: m,
      outcome: harness.outcome,
      prUrl: pr.url ?? "",
      urlResolved: pr.url !== null && pr.url.length > 0,
      lastMessage: "the pull request is already merged (detection only)",
    });
  }

  if (pr.state === "open") {
    const resolved = pr.url !== null && pr.url.length > 0;
    return base(input, {
      token: resolved ? po : pou,
      outcome: harness.outcome,
      prUrl: resolved ? (pr.url as string) : "",
      urlResolved: resolved,
      lastMessage: resolved
        ? "the pull request is open and awaits the coordinator's merge decision"
        : "the pull request is open; its URL could not be resolved",
    });
  }

  if (ledger.total > 0 && ledger.completed === ledger.total && !ledger.workRemaining) {
    return base(input, {
      token: nn,
      outcome: harness.outcome,
      lastMessage: "the lane has no remaining work",
    });
  }

  const noArtifact =
    harness.outcome === HARNESS_OUTCOMES[0] &&
    harness.exitStatus === 0 &&
    artifacts.branchCommits === 0 &&
    pr.state === "none" &&
    !ledger.progressed;
  if (noArtifact) {
    return base(input, {
      token: f,
      outcome: O_FAILED,
      lastMessage:
        "the session exited 0 with no branch commit, no pull request, and no ledger progress",
      missingArtifact: "branch-commit",
    });
  }

  return base(input, {
    token: harness.token,
    outcome: harness.outcome,
    lastMessage: `the shared classifier reported ${harness.outcome}`,
  });
};

/** The closed attempt-stage failure identities (Appendix G). */
export const DISPATCH_FAILURE_KINDS = [
  "spawn-failed",
  "state-unreadable",
  "restart-budget-exceeded",
  "resume-uneconomical",
] as const;

export type DispatchFailureKind = (typeof DISPATCH_FAILURE_KINDS)[number];

/** One classified attempt-stage failure (Appendix G). */
export type DispatchFailureClassification = {
  readonly kind: DispatchFailureKind;
  readonly code:
    | "dispatch.session.spawn-failed"
    | "dispatch.state-unverified"
    | "dispatch.restart-budget-exceeded"
    | "dispatch.resume-uneconomical";
  readonly token: DispatchToken;
  readonly outcome: HarnessOutcome;
  readonly projectionClass: ProjectionClass;
  readonly attemptRecords: 1;
  readonly comparisonReason: "dispatch-session-family" | "comparison-source-unavailable";
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
