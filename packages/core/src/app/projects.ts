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
  type ProjectsListEntry,
} from "../contracts/projects.js";

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
