/**
 * The `projects list` projections (GH-288 F-3, F-4, F-5, DEC-6, DEC-7, DEC-8).
 *
 * Pure and runtime-neutral: the handover state and the daemon reachability are
 * derived from injected evidence only, the row carries exactly the five
 * contract fields, and the ordering is by project key. No filesystem, git,
 * clock, or process access happens here; the composition supplies the reads.
 *
 * The handover matrix is Appendix B: `engine` only when the folded truth and
 * the derived document agree on `authoritative`, `shell` as the documented safe
 * default for dual-run or absent evidence, and `in-transition` only when the two
 * delivered artifacts disagree. Unreadable state is never a handover value: it
 * is the state-location failure the caller raises instead.
 */
import {
  DAEMON_REACHABILITY_REASONS,
  type DaemonReachability,
  type DaemonReachabilityReason,
  type HandoverState,
  type HostIndexEntry,
  type ProjectGroupEntry,
  type ProjectGroupMemberEntry,
  type ProjectGroupMemberSelected,
  type ProjectMemberHealth,
  type ProjectMemberOutcome,
  type ProjectsListData,
  type ProjectsListEntry,
  type ReposHandoverGate,
  type ReposListData,
  type ReposListEntry,
} from "../contracts/projects.js";
import {
  conditionStatuses,
  type DispatchEvidenceWindow,
  type DispatchGateEvaluation,
} from "../domain/dispatch-gate.js";

/** The folded latest handover evidence for the project, or none. */
export type HandoverEvidence = "authoritative" | "dual-run" | "none";

/**
 * The derived authority document's state: a valid view, an absent document, or
 * a document whose bytes are unparsable or out of shape (DEC-14, DEC-7).
 */
export type AuthorityEvidence =
  | { readonly state: "valid"; readonly authority: "authoritative" | "dual-run" }
  | { readonly state: "absent" }
  | { readonly state: "malformed" };

/**
 * Derive the reported handover state (Appendix B, DEC-7).
 *
 * `engine` requires agreement on `authoritative`. A dual-run folded truth is
 * `shell` unless the shell-visible document still says `authoritative`
 * (a recorded reversal has not propagated). An authoritative folded truth with
 * an absent, dual-run, or malformed document is `in-transition`. With no
 * handover record at all the documented safe default is `shell`.
 */
export const projectHandoverState = (input: {
  readonly operation: HandoverEvidence;
  readonly authority: AuthorityEvidence;
}): HandoverState => {
  if (input.operation === "none") return "shell";
  if (input.operation === "dual-run") {
    return input.authority.state === "valid" && input.authority.authority === "authoritative"
      ? "in-transition"
      : "shell";
  }
  return input.authority.state === "valid" && input.authority.authority === "authoritative"
    ? "engine"
    : "in-transition";
};

/** Whether the build composes a resident-daemon capability at all (F-5). */
export type DaemonMountFact = { readonly mounted: boolean };

/**
 * The closed socket fact a mount capability reports (F-5, Appendix C): the two
 * failure tokens are the declared reason vocabulary, so no translation layer
 * can rename a reason on the way to the row.
 */
export type DaemonSocketFact = "reachable" | "socket-absent" | "socket-unreachable";

export type DaemonMountCapability = {
  readonly probe: (input: {
    readonly socketPath: string;
    readonly timeoutMs: number;
  }) => Promise<DaemonSocketFact>;
};

/**
 * The injected daemon composition fact (GH-288 F-5).
 *
 * `mounted` is declared rather than inferred from the capability's presence, so
 * a build that does not mount the daemon never constructs the probe factory at
 * all — the unmounted reason is reported without touching the socket path.
 */
export type DaemonComposition = {
  readonly mounted: boolean;
  /** Consulted only when `mounted` is true; absent means declared degradation. */
  readonly capability?: () => DaemonMountCapability;
};

/** The project's state root fact, then the socket fact, in evaluation order. */
export type DaemonProbeFacts =
  | { readonly stateRoot: "absent" }
  | { readonly stateRoot: "present"; readonly socket: DaemonSocketFact };

/**
 * Select the daemon reachability value from the mount fact and the bounded probe
 * facts (F-5, Appendix C). The unmounted build declares the mount state and
 * performs no probe; an absent state root precedes the socket question.
 */
export const selectDaemonReachability = (input: {
  readonly mount: DaemonMountFact;
  readonly probe?: DaemonProbeFacts;
}): DaemonReachability => {
  if (!input.mount.mounted) {
    return { reachable: false, reason: DAEMON_REACHABILITY_REASONS[0] };
  }
  const probe = input.probe;
  if (probe === undefined || probe.stateRoot === "absent") {
    return { reachable: false, reason: DAEMON_REACHABILITY_REASONS[1] };
  }
  if (probe.socket === "socket-absent") {
    return { reachable: false, reason: DAEMON_REACHABILITY_REASONS[2] };
  }
  if (probe.socket === "socket-unreachable") {
    return { reachable: false, reason: DAEMON_REACHABILITY_REASONS[3] };
  }
  return { reachable: true };
};

/** The closed reason for one probe outcome, exposed for the unit assertion. */
export const daemonReasonFor = (facts: DaemonProbeFacts): DaemonReachabilityReason | undefined =>
  facts.stateRoot === "absent"
    ? DAEMON_REACHABILITY_REASONS[1]
    : facts.socket === "socket-absent"
      ? DAEMON_REACHABILITY_REASONS[2]
      : facts.socket === "socket-unreachable"
        ? DAEMON_REACHABILITY_REASONS[3]
        : undefined;

/** Build one row with exactly the five contract fields (AC-F3-1). */
export const projectListEntry = (input: {
  readonly projectKey: string;
  readonly root: string;
  readonly stateLocation: string;
  readonly daemonReachable: DaemonReachability;
  readonly handoverState: HandoverState;
}): ProjectsListEntry => ({
  projectKey: input.projectKey,
  root: input.root,
  stateLocation: input.stateLocation,
  daemonReachable: input.daemonReachable,
  handoverState: input.handoverState,
});

/** Order rows by project key ascending; the index's own order never leaks (F-3). */
export const orderProjectEntries = (
  entries: readonly ProjectsListEntry[],
): readonly ProjectsListEntry[] =>
  [...entries].sort((left, right) =>
    left.projectKey < right.projectKey ? -1 : left.projectKey > right.projectKey ? 1 : 0,
  );

/** Build one flat repo row with exactly the five renamed contract fields (F-7). */
export const repoListEntry = (input: {
  readonly repoKey: string;
  readonly root: string;
  readonly stateLocation: string;
  readonly daemonReachable: DaemonReachability;
  readonly handoverState: HandoverState;
  readonly reversible: boolean;
  readonly handoverGate: ReposHandoverGate;
}): ReposListEntry => ({
  repoKey: input.repoKey,
  root: input.root,
  stateLocation: input.stateLocation,
  daemonReachable: input.daemonReachable,
  handoverState: input.handoverState,
  reversible: input.reversible,
  handoverGate: input.handoverGate,
});

/** Order flat rows by repo key ascending; the index's own order never leaks (F-7). */
export const orderRepoEntries = (entries: readonly ReposListEntry[]): readonly ReposListEntry[] =>
  [...entries].sort((left, right) =>
    left.repoKey < right.repoKey ? -1 : left.repoKey > right.repoKey ? 1 : 0,
  );

/**
 * Project the delivered flat `projects.v1` data onto the renamed `repos.v1`
 * shape (F-7, DM-3; GH-293 DM-4). The mapping is field-for-field: every value
 * is carried unchanged and only the key's name moves, with the two additive
 * fields resolved by the caller's read-time gate projection. The alias never
 * passes through this projection, so the delivered payload stays byte-identical
 * (C-2).
 *
 * The gate projection is optional so the library signature stays additive: a
 * caller that supplies none gets the declared empty-window evaluation, which is
 * the same derivation a `first-use` row reports and needs no store.
 */
export const reposListDataOf = (
  data: ProjectsListData,
  gateOf: (entry: ProjectsListEntry) => {
    readonly reversible: boolean;
    readonly handoverGate: ReposHandoverGate;
  } = () => ({ reversible: false, handoverGate: emptyHandoverGate() }),
): ReposListData => ({
  repos: orderRepoEntries(
    data.projects.map((entry) =>
      repoListEntry({
        repoKey: entry.projectKey,
        root: entry.root,
        stateLocation: entry.stateLocation,
        daemonReachable: entry.daemonReachable,
        handoverState: entry.handoverState,
        ...gateOf(entry),
      }),
    ),
  ),
  hostIndexRevision: data.hostIndexRevision,
});

/**
 * The declared empty-window evaluation a `first-use` row reports (GH-293 F-3,
 * AC-F3-6, OQ-TP-4).
 *
 * No store is opened: truth is met, corroboration is met vacuously, coverage and
 * floor are open, both counters are zero, and reversibility is `false` because
 * the fold of no records is `dual-run`.
 */
export const emptyHandoverGate = (): ReposHandoverGate => ({
  verdict: "ineligible",
  conditions: [
    { condition: "truth", status: "met" },
    { condition: "coverage", status: "open" },
    { condition: "floor", status: "open" },
    { condition: "corroboration", status: "met" },
  ],
  countedDeliveries: 0,
  cleanDispatches: 0,
});

/**
 * Project one folded window and its evaluation onto the row's gate block
 * (GH-293 F-3, DM-4, DM-7).
 *
 * The block carries no window-start, repository, or scope field: the row's own
 * identity is the binding, and the fold's declared `production` scope is a
 * declaration rather than a payload member. `truncation` is appended last and
 * appears exactly when the bounded read omitted records, which is also the only
 * way the verdict reads `unverifiable`.
 */
export const reposHandoverGateOf = (input: {
  readonly window: DispatchEvidenceWindow;
  readonly evaluation: DispatchGateEvaluation;
}): ReposHandoverGate => ({
  verdict: input.evaluation.verdict,
  conditions: conditionStatuses(input.evaluation),
  countedDeliveries: input.window.countedInWindow.length,
  cleanDispatches: input.window.cleanDispatches,
  ...(input.window.truncated === undefined ? {} : { truncation: input.window.truncated }),
});

/** The state-location classification the row read applies (DEC-8, AC-F3-5). */
export const classifyProjectStateLocation = (input: {
  readonly exists: boolean;
  readonly directory: boolean;
  readonly readable: boolean;
}): "first-use" | "ready" | "state-unavailable" => {
  if (!input.exists) return "first-use";
  if (!input.directory || !input.readable) return "state-unavailable";
  return "ready";
};

/**
 * Derive one group member's health from its aggregation outcome (GH-309 OQ-3).
 *
 * The three non-`observed` outcomes map to the same-named health values; the
 * `observed` outcome splits — `healthy` for a clean read, `degraded` when the
 * read succeeded but reports a degradation (an unreachable daemon with a closed
 * reason). Exactly one health is produced for every outcome.
 */
export const projectMemberHealth = (input: {
  readonly outcome: ProjectMemberOutcome;
  readonly daemonReachable: DaemonReachability;
}): ProjectMemberHealth => {
  if (input.outcome === "not-yet-supported") return "not-yet-supported";
  if (input.outcome === "state-unavailable") return "state-unavailable";
  if (input.outcome === "unregistered") return "unregistered";
  return input.daemonReachable.reachable ? "healthy" : "degraded";
};

/** Build one group member entry with exactly the DM-2 fields (declared order preserved). */
export const projectGroupMemberEntry = (input: {
  readonly repoKey: string;
  readonly root: string;
  readonly trackerKind: string;
  readonly state: HandoverState;
  readonly health: ProjectMemberHealth;
  readonly daemonReachable: DaemonReachability;
}): ProjectGroupMemberEntry => ({
  repoKey: input.repoKey,
  root: input.root,
  trackerKind: input.trackerKind,
  state: input.state,
  health: input.health,
  daemonReachable: input.daemonReachable,
});

/** Build one group entry with exactly the DM-2 fields; workspaceRoot is optional. */
export const projectGroupEntry = (input: {
  readonly groupKey: string;
  readonly name: string;
  readonly workspaceRoot?: string;
  readonly members: readonly ProjectGroupMemberEntry[];
}): ProjectGroupEntry => ({
  groupKey: input.groupKey,
  name: input.name,
  ...(input.workspaceRoot === undefined ? {} : { workspaceRoot: input.workspaceRoot }),
  members: input.members,
});

/** One clone the workspace scan located for a declared member selector. */
export type WorkspaceLocatedMember = {
  readonly root: string;
  readonly repoKey?: string;
};

/**
 * One declared member's resolution: a located checkout with its durable key and
 * root, or an unlocated declaration that stays classified rather than vanishing
 * (GH-309 F-4, DM-2, OQ-3). A root-selected member contributes its declared root
 * even when no key can be read; a key-selected member has no root until a clone
 * or index entry locates it.
 */
export type ProjectGroupMemberResolution =
  | {
      readonly state: "located";
      readonly repoKey: string;
      readonly root: string;
    }
  | {
      readonly state: "unlocated";
      readonly repoKey?: string;
      readonly root: string;
    };

const normalizeMemberRoot = (path: string): string => path.replace(/[\\/]+$/u, "");

/**
 * Resolve one declared member from configuration only (GH-309 F-3, F-4, NFR-4).
 *
 * Resolution never invents a member: the host index and the declared-only
 * workspace scan are consulted for the selector the configuration names. The
 * same rule applies with and without a workspace root, so member resolution is
 * 1:1 across the two cases; the workspace is a convenience that can locate a
 * declared key-selected clone, never a source of membership.
 */
export const resolveProjectGroupMember = (input: {
  readonly member: ProjectGroupMemberSelected;
  readonly index: readonly HostIndexEntry[];
  readonly workspace: readonly WorkspaceLocatedMember[];
  readonly markerRepoKey?: string;
}): ProjectGroupMemberResolution => {
  if (input.member.kind === "root") {
    const declaredRoot = input.member.root;
    const indexEntry = input.index.find(
      (entry) => normalizeMemberRoot(entry.root) === normalizeMemberRoot(declaredRoot),
    );
    if (indexEntry !== undefined) {
      return { state: "located", repoKey: indexEntry.projectKey, root: indexEntry.root };
    }
    const located = input.workspace.find(
      (candidate) =>
        candidate.repoKey !== undefined &&
        normalizeMemberRoot(candidate.root) === normalizeMemberRoot(declaredRoot),
    );
    if (located?.repoKey !== undefined) {
      return { state: "located", repoKey: located.repoKey, root: located.root };
    }
    if (input.markerRepoKey !== undefined) {
      return { state: "located", repoKey: input.markerRepoKey, root: declaredRoot };
    }
    return { state: "unlocated", root: declaredRoot };
  }
  const declaredKey = input.member.repoKey;
  const indexEntry = input.index.find((entry) => entry.projectKey === declaredKey);
  if (indexEntry !== undefined) {
    return { state: "located", repoKey: declaredKey, root: indexEntry.root };
  }
  const located = input.workspace.find((candidate) => candidate.repoKey === declaredKey);
  if (located !== undefined) {
    return { state: "located", repoKey: declaredKey, root: located.root };
  }
  return { state: "unlocated", repoKey: declaredKey, root: "" };
};
