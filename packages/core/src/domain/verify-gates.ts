/**
 * Pure five-gate evaluator, shared open-PR resolution, and deterministic
 * renderers (GH-178 F-1..F-10, DM-2..DM-13).
 *
 * No I/O, clock, randomness, or ambient environment: every fact arrives through
 * `VerifyGatesFacts`. Ordering comes from contract arrays. The lifecycle gate
 * consumes `VerifyLedgerEvaluation`; it never parses a summary and never calls
 * the `classifyVerifyChange` wrapper.
 */
import {
  type BrandIdentity,
  type DeliveryRequest,
  ERROR_TABLE,
  type ErrorTableEntry,
  type OpenPrResolution,
  type PipelineRun,
  STATUS_OWNER_ATTENTION_LABELS,
  VERIFY_GATES_CI_RUN_LIMIT,
  VERIFY_GATES_GATE_ORDER,
  VERIFY_GATES_INTEGRATION_BASE,
  VERIFY_GATES_MAX_CITATION_NAMES,
  VERIFY_GATES_MAX_EXPECTED_JOB_NAME_CHARS,
  VERIFY_GATES_MAX_EXPECTED_JOBS,
  VERIFY_GATES_MAX_NAME_CHARS,
  VERIFY_GATES_MAX_REF_CHARS,
  VERIFY_GATES_MAX_SUMMARY_BYTES,
  VERIFY_GATES_OPEN_PR_LIMIT,
  type VerifyGateCitation,
  type VerifyGateCount,
  type VerifyGateCountName,
  type VerifyGateId,
  type VerifyGateIdentity,
  type VerifyGateNameKind,
  type VerifyGateNameList,
  type VerifyGateReason,
  type VerifyGateRecord,
  type VerifyGateSource,
  type VerifyGateSourceName,
  type VerifyGatesReport,
  type VerifyGatesSummary,
  type VerifyGateVerdict,
  type WorkItem,
} from "#contracts";
import type { VerifyLedgerEvaluation } from "./verify-change.js";

const EMPTY_IDENTITY = (changeRef: string): VerifyGateIdentity => ({ changeRef });

const clamp = (value: string, maximum: number): string =>
  value.length > maximum ? value.slice(0, maximum) : value;

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const uniqueOrdered = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    ordered.push(value);
  }
  return ordered;
};

/** One bounded name list; ordering is supplied by the caller. */
const nameList = (
  kind: VerifyGateNameKind,
  values: readonly string[],
  order: "given" | "lexicographic" = "given",
): VerifyGateNameList => {
  const unique = uniqueOrdered(values);
  const ordered = order === "lexicographic" ? [...unique].sort(compareText) : unique;
  const clamped = ordered
    .slice(0, VERIFY_GATES_MAX_CITATION_NAMES)
    .map((value) => clamp(value, VERIFY_GATES_MAX_NAME_CHARS));
  return { kind, values: clamped, omitted: Math.max(0, ordered.length - clamped.length) };
};

/**
 * Normalize one bounded count. Only a finite, non-negative number may serialize
 * as a count (N-7); anything else collapses to zero instead of leaking `NaN` or
 * an unbounded `Infinity` into a citation.
 */
const boundedCount = (value: number): number =>
  Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;

const count = (name: VerifyGateCountName, value: number): VerifyGateCount => ({
  name,
  value: boundedCount(value),
});

/**
 * Normalize a page-size denominator. A non-finite value can never be compared
 * safely, so it is treated as the at-limit page (unknown, never a vacuous pass).
 */
const boundedPageCount = (value: number, limit: number): number =>
  Number.isFinite(value) && value >= 0 ? Math.trunc(value) : limit;

/** A read result fact shared by the provider-backed gates. */
export type VerifyGatesReadFailureReason =
  | "read-failed"
  | "credential-unavailable"
  | "address-unresolved";

export type VerifyGatesReadFailure = {
  readonly ok: false;
  readonly reason: VerifyGatesReadFailureReason;
  readonly failureCode?: string;
  readonly failureClass?: "provider.payload.invalid";
};

export type VerifyGatesAbsence = {
  readonly ok: false;
  readonly reason: "not-found";
  readonly failureClass?: "provider.not-found";
};

export type VerifyGatesNotAttempted = {
  readonly ok: false;
  readonly reason: "not-attempted" | "unresolved";
};

export type VerifyGatesReadResult<T> =
  | { readonly ok: true; readonly value: T }
  | VerifyGatesReadFailure
  | VerifyGatesAbsence
  | VerifyGatesNotAttempted;

export type VerifyGatesOpenPrPage = {
  readonly items: readonly DeliveryRequest[];
  readonly pageItemCount: number;
};

export type VerifyGatesDetail = {
  readonly request: DeliveryRequest;
};

export type VerifyGatesCheckRunPage = {
  readonly items: readonly PipelineRun[];
  readonly pageItemCount: number;
};

export type VerifyGatesWorkItem = { readonly item: WorkItem };

export type VerifyGatesRepositoryFacts = {
  readonly binding: "resolved" | "address-unresolved" | "remote-unsupported";
  readonly head: {
    readonly branch?: string;
    readonly sha?: string;
    readonly detached: boolean;
  };
};

export type VerifyGatesWorkflowFacts = {
  readonly outcome: "read" | "failed" | "absent";
  readonly names: readonly string[];
};

/** Everything the pure evaluator consumes (one frozen fact bundle). */
export type VerifyGatesFacts = {
  readonly changeRef: string;
  readonly lifecycle: { readonly evaluation: VerifyLedgerEvaluation };
  readonly repository: VerifyGatesRepositoryFacts;
  readonly workflow: VerifyGatesWorkflowFacts;
  readonly openPullRequests: VerifyGatesReadResult<VerifyGatesOpenPrPage>;
  readonly deliveryRequestDetail: VerifyGatesReadResult<VerifyGatesDetail>;
  readonly checkRuns: VerifyGatesReadResult<VerifyGatesCheckRunPage>;
  readonly workItem: VerifyGatesReadResult<VerifyGatesWorkItem>;
};

export type VerifyGatesEvaluation = {
  readonly overall: VerifyGateVerdict;
  readonly summary: VerifyGatesSummary;
  readonly gates: readonly VerifyGateRecord[];
};

/** A full 40- or 64-hex SHA (case-insensitive). */
export const isFullHexSha = (value: string | undefined): value is string =>
  value !== undefined && /^[0-9a-fA-F]{40}(?:[0-9a-fA-F]{24})?$/.test(value);

const sameSha = (left: string, right: string): boolean =>
  left.toLowerCase() === right.toLowerCase();

/** The one deterministic open-PR resolution rule (DM-13). */
export const resolveOpenPr = (input: {
  readonly branch?: string;
  readonly detached: boolean;
  readonly pageItemCount: number;
  readonly items: readonly DeliveryRequest[];
}): OpenPrResolution => {
  const branch = input.branch;
  if (input.detached || branch === undefined || branch.length === 0) {
    return { outcome: "branch-unresolved", openCount: 0, matchCount: 0 };
  }
  const matches = input.items.filter((item) => item.sourceRef === branch);
  const matchCount = matches.length;
  const pageItemCount = boundedPageCount(input.pageItemCount, VERIFY_GATES_OPEN_PR_LIMIT);
  if (pageItemCount >= VERIFY_GATES_OPEN_PR_LIMIT) {
    return {
      outcome: "ambiguous-open-pr",
      branch,
      openCount: pageItemCount,
      matchCount,
    };
  }
  if (matchCount === 1) {
    const request = matches[0];
    return {
      outcome: "resolved",
      branch,
      openCount: input.items.length,
      matchCount,
      ...(request === undefined ? {} : { deliveryRequest: request }),
    };
  }
  if (matchCount > 1) {
    return {
      outcome: "ambiguous-open-pr",
      branch,
      openCount: input.items.length,
      matchCount,
    };
  }
  return input.items.length === 0
    ? { outcome: "no-open-pr", branch, openCount: 0, matchCount: 0 }
    : { outcome: "branch-mismatch", branch, openCount: input.items.length, matchCount: 0 };
};

const expectedSetValid = (facts: VerifyGatesWorkflowFacts): boolean => {
  if (facts.outcome !== "read") return false;
  if (facts.names.length === 0 || facts.names.length > VERIFY_GATES_MAX_EXPECTED_JOBS) return false;
  const seen = new Set<string>();
  for (const name of facts.names) {
    if (name.length === 0 || name.length > VERIFY_GATES_MAX_EXPECTED_JOB_NAME_CHARS) return false;
    if (seen.has(name)) return false;
    seen.add(name);
  }
  return true;
};

const sourceOf = <T>(
  name: VerifyGateSourceName,
  read: VerifyGatesReadResult<T>,
  empty = false,
): VerifyGateSource => {
  if (read.ok) return { name, outcome: empty ? "observed-empty" : "read" };
  if (read.reason === "not-found") {
    return {
      name,
      outcome: "absent",
      failureClass: read.failureClass ?? "provider.not-found",
    };
  }
  if (read.reason === "not-attempted" || read.reason === "unresolved") {
    return { name, outcome: read.reason };
  }
  return {
    name,
    outcome: "failed",
    ...("failureCode" in read && read.failureCode !== undefined
      ? { failureCode: read.failureCode }
      : {}),
    ...("failureClass" in read && read.failureClass !== undefined
      ? { failureClass: read.failureClass }
      : {}),
  };
};

const notAttempted = (name: VerifyGateSourceName): VerifyGateSource => ({
  name,
  outcome: "not-attempted",
});

const readSource = (name: VerifyGateSourceName, empty = false): VerifyGateSource => ({
  name,
  outcome: empty ? "observed-empty" : "read",
});

const failureReason = (
  read: VerifyGatesReadFailure | VerifyGatesNotAttempted,
): VerifyGateReason => {
  if (read.reason === "credential-unavailable") return "credential-unavailable";
  if (read.reason === "address-unresolved") return "address-unresolved";
  return "read-failed";
};

const citation = (
  sources: readonly VerifyGateSource[],
  identity: VerifyGateIdentity,
  counts: readonly VerifyGateCount[],
  names: readonly VerifyGateNameList[],
  reasons: readonly VerifyGateReason[],
): VerifyGateCitation => ({
  sources,
  identity,
  counts,
  names,
  reasons: reasons.length === 0 ? ["read-failed"] : reasons,
});

const gate = (
  id: VerifyGateId,
  verdict: VerifyGateVerdict,
  reason: VerifyGateReason,
  citationValue: VerifyGateCitation,
): VerifyGateRecord => ({ id, verdict, reason, citation: citationValue });

const lifecycleGate = (facts: VerifyGatesFacts): VerifyGateRecord => {
  const evaluation = facts.lifecycle.evaluation;
  const identity = EMPTY_IDENTITY(facts.changeRef);
  const counts: VerifyGateCount[] = [
    count("required", evaluation.declaration.requiredCount),
    count("completed", evaluation.declaration.completedCount),
    count("missing", evaluation.missingPhases.length),
    count("registryRecords", evaluation.registry.recordCount),
    count("registryTransitions", evaluation.registry.transitionCount),
    count("overlaid", evaluation.registry.overlaidPhases.length),
  ];
  const names = [nameList("missing-phases", evaluation.missingPhases)];
  const missingSource = (): VerifyGateSource => ({
    name: "pm-notes",
    outcome: evaluation.code === "lint.target.missing" ? "absent" : "failed",
    ...(evaluation.code === undefined ? {} : { failureCode: evaluation.code }),
  });

  if (evaluation.outcome === "failed") {
    return gate(
      "lifecycle-finalization",
      "fail",
      "lifecycle-incomplete",
      citation([missingSource(), notAttempted("delivery-registry")], identity, counts, names, [
        "lifecycle-incomplete",
      ]),
    );
  }
  if (evaluation.outcome === "state-unverified") {
    return gate(
      "lifecycle-finalization",
      "unknown",
      "lifecycle-unverifiable",
      citation(
        [
          readSource("pm-notes"),
          {
            name: "delivery-registry",
            outcome: "failed",
            ...(evaluation.code === undefined ? {} : { failureCode: evaluation.code }),
          },
        ],
        identity,
        counts,
        names,
        ["lifecycle-unverifiable"],
      ),
    );
  }
  const pass = evaluation.outcome === "finished";
  return gate(
    "lifecycle-finalization",
    pass ? "pass" : "fail",
    pass ? "lifecycle-complete" : "lifecycle-incomplete",
    citation(
      [
        {
          name: "pm-notes",
          outcome: "read",
          ...(pass || evaluation.code === undefined ? {} : { failureCode: evaluation.code }),
        },
        readSource("delivery-registry"),
      ],
      identity,
      counts,
      names,
      [pass ? "lifecycle-complete" : "lifecycle-incomplete"],
    ),
  );
};

const jobStates = new Map<string, number>([
  ["failed", 0],
  ["canceled", 1],
  ["pending", 2],
  ["skipped", 3],
  ["succeeded", 4],
]);

const normalizedJobState = (run: PipelineRun): string | undefined => run.jobs[0]?.jobState;

const worstState = (current: string | undefined, next: string): string => {
  if (current === undefined) return next;
  const currentRank = jobStates.get(current) ?? 0;
  const nextRank = jobStates.get(next) ?? 0;
  return nextRank < currentRank ? next : current;
};

const ciGate = (facts: VerifyGatesFacts): VerifyGateRecord => {
  const identity = EMPTY_IDENTITY(facts.changeRef);
  const list = facts.openPullRequests;
  const detail = facts.deliveryRequestDetail;
  const checkRuns = facts.checkRuns;
  const bindingResolved = facts.repository.binding === "resolved";
  const workflowSource: VerifyGateSource =
    facts.workflow.outcome === "read"
      ? readSource("repository-ci-workflow")
      : {
          name: "repository-ci-workflow",
          outcome: facts.workflow.outcome,
        };

  if (!expectedSetValid(facts.workflow)) {
    return gate(
      "ci-green",
      "fail",
      "ci-expected-jobs-invalid",
      citation(
        [
          workflowSource,
          notAttempted("github-delivery-request-detail"),
          notAttempted("github-check-runs"),
        ],
        identity,
        [],
        [],
        ["ci-expected-jobs-invalid"],
      ),
    );
  }
  const expected = facts.workflow.names;

  if (!bindingResolved) {
    return gate(
      "ci-green",
      "unknown",
      "address-unresolved",
      citation(
        [
          workflowSource,
          notAttempted("github-delivery-request-detail"),
          notAttempted("github-check-runs"),
        ],
        identity,
        [count("expected", expected.length)],
        [],
        ["address-unresolved"],
      ),
    );
  }

  if (!list.ok) {
    if (list.reason === "not-found") {
      return gate(
        "ci-green",
        "fail",
        "head-unresolved",
        citation(
          [
            workflowSource,
            notAttempted("github-delivery-request-detail"),
            notAttempted("github-check-runs"),
          ],
          identity,
          [count("expected", expected.length)],
          [],
          ["head-unresolved"],
        ),
      );
    }
    if (list.reason === "not-attempted" || list.reason === "unresolved") {
      return gate(
        "ci-green",
        "fail",
        "head-unresolved",
        citation(
          [
            workflowSource,
            notAttempted("github-delivery-request-detail"),
            notAttempted("github-check-runs"),
          ],
          identity,
          [count("expected", expected.length)],
          [],
          ["head-unresolved"],
        ),
      );
    }
    return gate(
      "ci-green",
      "unknown",
      failureReason(list),
      citation(
        [
          workflowSource,
          notAttempted("github-delivery-request-detail"),
          notAttempted("github-check-runs"),
        ],
        identity,
        [],
        [],
        [failureReason(list)],
      ),
    );
  }

  const resolution = resolveOpenPr({
    detached: facts.repository.head.detached,
    ...(facts.repository.head.branch === undefined ? {} : { branch: facts.repository.head.branch }),
    pageItemCount: list.value.pageItemCount,
    items: list.value.items,
  });
  if (resolution.outcome !== "resolved") {
    return gate(
      "ci-green",
      "fail",
      "head-unresolved",
      citation(
        [
          workflowSource,
          notAttempted("github-delivery-request-detail"),
          notAttempted("github-check-runs"),
        ],
        identity,
        [count("expected", expected.length)],
        [],
        ["head-unresolved"],
      ),
    );
  }

  if (!detail.ok) {
    if (detail.reason === "not-found") {
      return gate(
        "ci-green",
        "fail",
        "head-unresolved",
        citation(
          [
            workflowSource,
            sourceOf("github-delivery-request-detail", detail),
            notAttempted("github-check-runs"),
          ],
          {
            ...identity,
            ...(resolution.deliveryRequest === undefined
              ? {}
              : { deliveryRequest: resolution.deliveryRequest.identity.entityId }),
          },
          [count("expected", expected.length)],
          [],
          ["head-unresolved"],
        ),
      );
    }
    return gate(
      "ci-green",
      "unknown",
      failureReason(detail),
      citation(
        [
          workflowSource,
          sourceOf("github-delivery-request-detail", detail),
          notAttempted("github-check-runs"),
        ],
        identity,
        [],
        [],
        [failureReason(detail)],
      ),
    );
  }

  const request = detail.value.request;
  const detailIdentity: VerifyGateIdentity = {
    ...identity,
    deliveryRequest: request.identity.entityId,
    ...(request.sourceHeadSha === undefined ? {} : { headSha: request.sourceHeadSha }),
  };
  if (!isFullHexSha(request.sourceHeadSha)) {
    return gate(
      "ci-green",
      "fail",
      "head-unresolved",
      citation(
        [
          workflowSource,
          readSource("github-delivery-request-detail"),
          notAttempted("github-check-runs"),
        ],
        detailIdentity,
        [count("expected", expected.length)],
        [],
        ["head-unresolved"],
      ),
    );
  }

  if (!checkRuns.ok) {
    if (checkRuns.reason === "not-found") {
      return gate(
        "ci-green",
        "unknown",
        "read-failed",
        citation(
          [
            workflowSource,
            readSource("github-delivery-request-detail"),
            {
              name: "github-check-runs",
              outcome: "absent",
              failureClass: checkRuns.failureClass ?? "provider.not-found",
            },
          ],
          detailIdentity,
          [],
          [],
          ["read-failed"],
        ),
      );
    }
    return gate(
      "ci-green",
      "unknown",
      failureReason(checkRuns),
      citation(
        [
          workflowSource,
          readSource("github-delivery-request-detail"),
          sourceOf("github-check-runs", checkRuns),
        ],
        detailIdentity,
        [],
        [],
        [failureReason(checkRuns)],
      ),
    );
  }

  const runs = checkRuns.value.items;
  const runsCount = boundedPageCount(checkRuns.value.pageItemCount, VERIFY_GATES_CI_RUN_LIMIT);
  const counts = new Map<string, number>([
    ["failed", 0],
    ["canceled", 0],
    ["pending", 0],
    ["skipped", 0],
    ["succeeded", 0],
  ]);
  const effective = new Map<string, string>();
  let unrecognized = false;
  for (const run of runs) {
    const state = normalizedJobState(run);
    if (state === undefined) {
      unrecognized = true;
      continue;
    }
    const bucket = state === "running" || state === "queued" ? "pending" : state;
    if (counts.has(bucket)) {
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    } else {
      unrecognized = true;
    }
    effective.set(run.pipelineName, worstState(effective.get(run.pipelineName), bucket));
  }
  const succeeded = counts.get("succeeded") ?? 0;
  const failed = counts.get("failed") ?? 0;
  const pending = counts.get("pending") ?? 0;
  const skipped = counts.get("skipped") ?? 0;
  const canceled = counts.get("canceled") ?? 0;
  const missingNames = expected.filter((name) => !effective.has(name));
  const failedNames = [...effective.entries()]
    .filter(([, state]) => state === "failed")
    .map(([name]) => name);
  const pendingNames = [...effective.entries()]
    .filter(([, state]) => state === "pending" || state === "canceled")
    .map(([name]) => name);
  const skippedExpected = expected.filter((name) => effective.get(name) === "skipped");
  const succeededExpected = expected.filter((name) => effective.get(name) === "succeeded");
  const ciCounts: VerifyGateCount[] = [
    count("expected", expected.length),
    count("runs", runsCount),
    count("succeeded", succeeded),
    count("failed", failed),
    count("pending", pending),
    count("skipped", skipped),
    count("canceled", canceled),
    count("missing", missingNames.length),
  ];
  const ciNames: VerifyGateNameList[] = [
    nameList("missing-jobs", missingNames),
    nameList("failed-jobs", failedNames, "lexicographic"),
    nameList("pending-jobs", pendingNames, "lexicographic"),
  ];
  const sources: VerifyGateSource[] = [
    workflowSource,
    readSource("github-delivery-request-detail"),
    readSource("github-check-runs"),
  ];

  if (runsCount >= VERIFY_GATES_CI_RUN_LIMIT) {
    return gate(
      "ci-green",
      "unknown",
      "ci-truncated",
      citation(sources, detailIdentity, ciCounts, ciNames, ["ci-truncated"]),
    );
  }
  if (runsCount === 0) {
    return gate(
      "ci-green",
      "fail",
      "ci-no-runs",
      citation(sources, detailIdentity, ciCounts, ciNames, ["ci-no-runs"]),
    );
  }
  if (failed > 0 || unrecognized) {
    return gate(
      "ci-green",
      "fail",
      "ci-failed",
      citation(sources, detailIdentity, ciCounts, ciNames, ["ci-failed"]),
    );
  }
  if (canceled > 0) {
    return gate(
      "ci-green",
      "fail",
      "ci-canceled",
      citation(sources, detailIdentity, ciCounts, ciNames, ["ci-canceled"]),
    );
  }
  if (pending > 0) {
    return gate(
      "ci-green",
      "fail",
      "ci-pending",
      citation(sources, detailIdentity, ciCounts, ciNames, ["ci-pending"]),
    );
  }
  if (
    missingNames.length === 0 &&
    succeededExpected.length === 0 &&
    skippedExpected.length === expected.length
  ) {
    return gate(
      "ci-green",
      "fail",
      "ci-all-skipped",
      citation(sources, detailIdentity, ciCounts, ciNames, ["ci-all-skipped"]),
    );
  }
  if (missingNames.length > 0) {
    return gate(
      "ci-green",
      "fail",
      "ci-missing-jobs",
      citation(sources, detailIdentity, ciCounts, ciNames, ["ci-missing-jobs"]),
    );
  }
  if (succeededExpected.length === 0) {
    return gate(
      "ci-green",
      "fail",
      "ci-all-skipped",
      citation(sources, detailIdentity, ciCounts, ciNames, ["ci-all-skipped"]),
    );
  }
  return gate(
    "ci-green",
    "pass",
    "ci-green",
    citation(sources, detailIdentity, ciCounts, ciNames, ["ci-green"]),
  );
};

const repositoryHeadSource = (facts: VerifyGatesFacts): VerifyGateSource => {
  if (facts.repository.head.detached) return { name: "repository-head", outcome: "unresolved" };
  if (isFullHexSha(facts.repository.head.sha)) return readSource("repository-head");
  return { name: "repository-head", outcome: "unresolved" };
};

const parityGate = (facts: VerifyGatesFacts): VerifyGateRecord => {
  const identity: VerifyGateIdentity = {
    ...EMPTY_IDENTITY(facts.changeRef),
    ...(facts.repository.head.branch === undefined ? {} : { branch: facts.repository.head.branch }),
    ...(facts.repository.head.sha === undefined ? {} : { localSha: facts.repository.head.sha }),
  };
  const list = facts.openPullRequests;
  const detail = facts.deliveryRequestDetail;
  const headSource = repositoryHeadSource(facts);
  const bindingResolved = facts.repository.binding === "resolved";

  if (!bindingResolved) {
    return gate(
      "push-parity",
      "unknown",
      "address-unresolved",
      citation(
        [
          headSource,
          notAttempted("github-delivery-request-list"),
          notAttempted("github-delivery-request-detail"),
        ],
        identity,
        [count("compared", 0), count("matched", 0)],
        [],
        ["address-unresolved"],
      ),
    );
  }
  if (facts.repository.head.detached) {
    return gate(
      "push-parity",
      "fail",
      "branch-unresolved",
      citation(
        [
          headSource,
          notAttempted("github-delivery-request-list"),
          notAttempted("github-delivery-request-detail"),
        ],
        identity,
        [count("compared", 0), count("matched", 0)],
        [],
        ["branch-unresolved"],
      ),
    );
  }
  if (!list.ok) {
    if (list.reason === "not-found") {
      return gate(
        "push-parity",
        "fail",
        "no-open-pr",
        citation(
          [
            headSource,
            sourceOf("github-delivery-request-list", list),
            notAttempted("github-delivery-request-detail"),
          ],
          identity,
          [count("compared", 0), count("matched", 0)],
          [],
          ["no-open-pr"],
        ),
      );
    }
    const reason = failureReason(list);
    return gate(
      "push-parity",
      "unknown",
      reason,
      citation(
        [
          headSource,
          sourceOf("github-delivery-request-list", list),
          notAttempted("github-delivery-request-detail"),
        ],
        identity,
        [],
        [],
        [reason],
      ),
    );
  }
  const resolution = resolveOpenPr({
    detached: facts.repository.head.detached,
    ...(facts.repository.head.branch === undefined ? {} : { branch: facts.repository.head.branch }),
    pageItemCount: list.value.pageItemCount,
    items: list.value.items,
  });
  if (resolution.outcome !== "resolved") {
    return gate(
      "push-parity",
      "fail",
      resolution.outcome,
      citation(
        [
          headSource,
          sourceOf("github-delivery-request-list", list, list.value.items.length === 0),
          notAttempted("github-delivery-request-detail"),
        ],
        identity,
        [count("compared", 0), count("matched", 0)],
        [],
        [resolution.outcome],
      ),
    );
  }
  if (!detail.ok) {
    if (detail.reason === "not-found") {
      return gate(
        "push-parity",
        "fail",
        "head-unresolved",
        citation(
          [
            headSource,
            readSource("github-delivery-request-list"),
            sourceOf("github-delivery-request-detail", detail),
          ],
          {
            ...identity,
            ...(resolution.deliveryRequest === undefined
              ? {}
              : {
                  deliveryRequest: resolution.deliveryRequest.identity.entityId,
                  baseRef: resolution.deliveryRequest.targetRef,
                }),
          },
          [count("compared", 0), count("matched", 0)],
          [],
          ["head-unresolved"],
        ),
      );
    }
    const reason = failureReason(detail);
    return gate(
      "push-parity",
      "unknown",
      reason,
      citation(
        [
          headSource,
          readSource("github-delivery-request-list"),
          sourceOf("github-delivery-request-detail", detail),
        ],
        identity,
        [],
        [],
        [reason],
      ),
    );
  }
  const request = detail.value.request;
  const remote = request.sourceHeadSha;
  const detailIdentity: VerifyGateIdentity = {
    ...identity,
    deliveryRequest: request.identity.entityId,
    baseRef: request.targetRef,
    ...(remote === undefined ? {} : { headSha: remote }),
  };
  if (!isFullHexSha(facts.repository.head.sha) || !isFullHexSha(remote)) {
    return gate(
      "push-parity",
      "fail",
      "head-unresolved",
      citation(
        [
          headSource,
          readSource("github-delivery-request-list"),
          readSource("github-delivery-request-detail"),
        ],
        detailIdentity,
        [count("compared", 0), count("matched", 0)],
        [],
        ["head-unresolved"],
      ),
    );
  }
  const matched = sameSha(facts.repository.head.sha, remote);
  return gate(
    "push-parity",
    matched ? "pass" : "fail",
    matched ? "parity-matched" : "parity-mismatched",
    citation(
      [
        headSource,
        readSource("github-delivery-request-list"),
        readSource("github-delivery-request-detail"),
      ],
      detailIdentity,
      [count("compared", 1), count("matched", matched ? 1 : 0)],
      [],
      [matched ? "parity-matched" : "parity-mismatched"],
    ),
  );
};

const squashSignals = (request: DeliveryRequest): VerifyGateNameList =>
  nameList("squash-signals", [
    `draft=${request.reviewState === "draft" ? "true" : "false"}`,
    `mergeable=${request.mergeableState ?? "unknown"}`,
  ]);

const surfaceCount = (
  name: VerifyGateCountName,
  value: number | undefined,
): VerifyGateCount | undefined =>
  value !== undefined && Number.isFinite(value) && value >= 0 ? count(name, value) : undefined;

const squashGate = (facts: VerifyGatesFacts): VerifyGateRecord => {
  const identity: VerifyGateIdentity = {
    ...EMPTY_IDENTITY(facts.changeRef),
    ...(facts.repository.head.branch === undefined ? {} : { branch: facts.repository.head.branch }),
  };
  const list = facts.openPullRequests;
  const detail = facts.deliveryRequestDetail;
  const bindingResolved = facts.repository.binding === "resolved";
  const emptyNoDetail = (
    verdict: VerifyGateVerdict,
    reason: VerifyGateReason,
    sources: readonly VerifyGateSource[],
  ): VerifyGateRecord =>
    gate("squash-preflight", verdict, reason, citation(sources, identity, [], [], [reason]));

  if (!bindingResolved) {
    return emptyNoDetail("unknown", "address-unresolved", [
      notAttempted("github-delivery-request-list"),
      notAttempted("github-delivery-request-detail"),
    ]);
  }
  if (facts.repository.head.detached) {
    return emptyNoDetail("fail", "branch-unresolved", [
      notAttempted("github-delivery-request-list"),
      notAttempted("github-delivery-request-detail"),
    ]);
  }
  if (!list.ok) {
    if (list.reason === "not-found") {
      return emptyNoDetail("fail", "no-open-pr", [
        sourceOf("github-delivery-request-list", list),
        notAttempted("github-delivery-request-detail"),
      ]);
    }
    const reason = failureReason(list);
    return emptyNoDetail("unknown", reason, [
      sourceOf("github-delivery-request-list", list),
      notAttempted("github-delivery-request-detail"),
    ]);
  }
  const resolution = resolveOpenPr({
    detached: facts.repository.head.detached,
    ...(facts.repository.head.branch === undefined ? {} : { branch: facts.repository.head.branch }),
    pageItemCount: list.value.pageItemCount,
    items: list.value.items,
  });
  if (resolution.outcome !== "resolved") {
    return emptyNoDetail("fail", resolution.outcome, [
      sourceOf("github-delivery-request-list", list, list.value.items.length === 0),
      notAttempted("github-delivery-request-detail"),
    ]);
  }
  const listIdentity: VerifyGateIdentity = {
    ...identity,
    ...(resolution.deliveryRequest === undefined
      ? {}
      : { deliveryRequest: resolution.deliveryRequest.identity.entityId }),
  };
  if (!detail.ok) {
    if (detail.reason === "not-found") {
      return gate(
        "squash-preflight",
        "fail",
        "head-unresolved",
        citation(
          [
            readSource("github-delivery-request-list"),
            sourceOf("github-delivery-request-detail", detail),
          ],
          listIdentity,
          [],
          [],
          ["head-unresolved"],
        ),
      );
    }
    const reason = failureReason(detail);
    return gate(
      "squash-preflight",
      "unknown",
      reason,
      citation(
        [
          readSource("github-delivery-request-list"),
          sourceOf("github-delivery-request-detail", detail),
        ],
        listIdentity,
        [],
        [],
        [reason],
      ),
    );
  }
  const request = detail.value.request;
  const fullIdentity: VerifyGateIdentity = {
    ...listIdentity,
    deliveryRequest: request.identity.entityId,
    baseRef: request.targetRef,
    ...(request.sourceHeadSha === undefined ? {} : { headSha: request.sourceHeadSha }),
  };
  const commits = surfaceCount("commits", request.commitCount);
  const changedFiles = surfaceCount("changedFiles", request.changedFileCount);
  const counts = [commits, changedFiles].filter(
    (entry): entry is VerifyGateCount => entry !== undefined,
  );
  const names = [squashSignals(request)];
  const sources = [
    readSource("github-delivery-request-list"),
    readSource("github-delivery-request-detail"),
  ];
  const verdictFor = (reason: VerifyGateReason): VerifyGateRecord =>
    gate(
      "squash-preflight",
      reason === "squash-ready" ? "pass" : "fail",
      reason,
      citation(sources, fullIdentity, counts, names, [reason]),
    );

  if (request.reviewState === "merged" || request.reviewState === "closed") {
    return verdictFor("squash-not-open");
  }
  if (request.reviewState === "draft") return verdictFor("squash-draft");
  if (request.targetRef !== VERIFY_GATES_INTEGRATION_BASE) {
    return verdictFor("squash-target-mismatch");
  }
  if (request.mergeableState === "conflicting") return verdictFor("squash-conflicting");
  if (request.mergeableState === "not-mergeable") return verdictFor("squash-not-mergeable");
  if (request.mergeableState !== "mergeable") return verdictFor("squash-mergeability-unknown");
  if (commits === undefined || changedFiles === undefined) {
    return verdictFor("squash-surface-unknown");
  }
  if (commits.value <= 0) return verdictFor("squash-no-commits");
  if (changedFiles.value <= 0) return verdictFor("squash-no-changes");
  return verdictFor("squash-ready");
};

const ownerGate = (facts: VerifyGatesFacts): VerifyGateRecord => {
  const workItem = facts.workItem;
  const identity: VerifyGateIdentity = {
    changeRef: facts.changeRef,
    workItem: facts.changeRef,
  };
  if (facts.repository.binding !== "resolved") {
    return gate(
      "owner-gate",
      "unknown",
      "address-unresolved",
      citation([notAttempted("github-work-item")], identity, [], [], ["address-unresolved"]),
    );
  }
  if (!workItem.ok) {
    if (workItem.reason === "not-found") {
      return gate(
        "owner-gate",
        "fail",
        "ticket-unresolved",
        citation([sourceOf("github-work-item", workItem)], identity, [], [], ["ticket-unresolved"]),
      );
    }
    if (workItem.reason === "unresolved") {
      return gate(
        "owner-gate",
        "fail",
        "ticket-unresolved",
        citation(
          [{ name: "github-work-item", outcome: "unresolved" }],
          identity,
          [],
          [],
          ["ticket-unresolved"],
        ),
      );
    }
    const reason = failureReason(workItem);
    return gate(
      "owner-gate",
      "unknown",
      reason,
      citation([sourceOf("github-work-item", workItem)], identity, [], [], [reason]),
    );
  }
  const labels = workItem.value.item.labels;
  const ownerLabels = STATUS_OWNER_ATTENTION_LABELS.filter((owner) =>
    labels.some((label) => label.toLowerCase() === owner.toLowerCase()),
  );
  const counts = [count("labels", labels.length), count("ownerLabels", ownerLabels.length)];
  const names = [nameList("owner-labels", ownerLabels)];
  const present = ownerLabels.length > 0;
  return gate(
    "owner-gate",
    present ? "fail" : "pass",
    present ? "owner-gate-present" : "owner-gate-absent",
    citation([readSource("github-work-item")], identity, counts, names, [
      present ? "owner-gate-present" : "owner-gate-absent",
    ]),
  );
};

const summarize = (gates: readonly VerifyGateRecord[]): VerifyGatesSummary => ({
  gates: 5,
  passed: gates.filter((entry) => entry.verdict === "pass").length,
  failed: gates.filter((entry) => entry.verdict === "fail").length,
  unknown: gates.filter((entry) => entry.verdict === "unknown").length,
});

const overallOf = (gates: readonly VerifyGateRecord[]): VerifyGateVerdict => {
  if (gates.every((entry) => entry.verdict === "pass")) return "pass";
  if (gates.some((entry) => entry.verdict === "fail")) return "fail";
  return "unknown";
};

/** Evaluate exactly five gates in the fixed contract order, with no short-circuit. */
export const evaluateVerifyGates = (facts: VerifyGatesFacts): VerifyGatesEvaluation => {
  const records: Record<VerifyGateId, VerifyGateRecord> = {
    "lifecycle-finalization": lifecycleGate(facts),
    "ci-green": ciGate(facts),
    "push-parity": parityGate(facts),
    "owner-gate": ownerGate(facts),
    "squash-preflight": squashGate(facts),
  };
  const gates = VERIFY_GATES_GATE_ORDER.map((id) => records[id]);
  return { overall: overallOf(gates), summary: summarize(gates), gates };
};

const referenceFor = (gateId: VerifyGateId, citationValue: VerifyGateCitation): string => {
  const identity = citationValue.identity;
  const raw =
    gateId === "lifecycle-finalization" || gateId === "owner-gate"
      ? identity.changeRef
      : gateId === "ci-green"
        ? (identity.headSha ?? identity.changeRef)
        : gateId === "push-parity"
          ? (identity.deliveryRequest ?? identity.branch ?? identity.localSha ?? identity.changeRef)
          : (identity.deliveryRequest ?? identity.branch ?? identity.changeRef);
  return clamp(raw.length === 0 ? "-" : raw, VERIFY_GATES_MAX_REF_CHARS);
};

const countsSegment = (citationValue: VerifyGateCitation): string => {
  if (citationValue.counts.length === 0) return "-";
  return citationValue.counts.map((entry) => `${entry.name}=${entry.value}`).join(",");
};

const namesSegment = (citationValue: VerifyGateCitation, valueBudget?: number): string => {
  const rendered = citationValue.names
    .filter((entry) => entry.values.length > 0)
    .map((entry) => {
      const values = valueBudget === undefined ? entry.values : entry.values.slice(0, valueBudget);
      const omitted = entry.omitted + (entry.values.length - values.length);
      return `${entry.kind}=${JSON.stringify(values)}${omitted > 0 ? `+${omitted}` : ""}`;
    });
  return rendered.length === 0 ? "-" : rendered.join(" ");
};

const gateSummaryLine = (entry: VerifyGateRecord, valueBudget?: number): string => {
  const sources = entry.citation.sources
    .map((source) => `${source.name}:${source.outcome}`)
    .join("+");
  return `${entry.id} ${entry.verdict} reason=${entry.reason} source=${sources} ref=${referenceFor(entry.id, entry.citation)} counts=${countsSegment(entry.citation)} names=${namesSegment(entry.citation, valueBudget)}`;
};

/** Render the bounded deterministic failure summary (Appendix D). */
export const renderVerifyGatesFailureSummary = (evaluation: VerifyGatesEvaluation): string => {
  const result = evaluation.overall === "fail" ? "fail" : "unknown";
  const header = `result=${result}; gates=${evaluation.summary.passed}/5 passed, ${evaluation.summary.failed} failed, ${evaluation.summary.unknown} unknown`;
  const render = (valueBudget?: number): string =>
    [header, ...evaluation.gates.map((entry) => gateSummaryLine(entry, valueBudget))].join("\n");
  const full = render();
  if (full.length <= VERIFY_GATES_MAX_SUMMARY_BYTES) return full;
  // The full block exceeds the byte bound. Shrink the name lists (never drop a
  // gate line or a `counts=`/`names=` segment) until the six lines fit (N-5).
  for (let budget = VERIFY_GATES_MAX_CITATION_NAMES - 1; budget >= 0; budget -= 1) {
    const candidate = render(budget);
    if (candidate.length <= VERIFY_GATES_MAX_SUMMARY_BYTES) return candidate;
    if (budget === 0) return candidate;
  }
  return full;
};

const shortSha = (value: string | undefined): string =>
  value === undefined ? "-" : value.slice(0, 7);

const humanLineFor = (entry: VerifyGateRecord): string => {
  const citationValue = entry.citation;
  const names = (kind: VerifyGateNameKind): string => {
    const list = citationValue.names.find((candidate) => candidate.kind === kind);
    return list === undefined || list.values.length === 0 ? "-" : list.values.join(",");
  };
  const countValue = (name: VerifyGateCountName): number | undefined =>
    citationValue.counts.find((candidate) => candidate.name === name)?.value;
  switch (entry.id) {
    case "lifecycle-finalization":
      return `${entry.id}  ${entry.verdict}  [pm-notes+delivery-registry]  variant=${citationValue.identity.changeRef === "" ? "unknown" : citationValue.counts.find((candidate) => candidate.name === "required")?.value === 6 ? "lite" : "full"} required=${countValue("required") ?? 0} completed=${countValue("completed") ?? 0} missing=${names("missing-phases")}`;
    case "ci-green":
      return `${entry.id}  ${entry.verdict}  [repository-ci-workflow+github-delivery-request-detail+github-check-runs]  sha=${shortSha(citationValue.identity.headSha)} expected=${countValue("expected") ?? 0} runs=${countValue("runs") ?? 0} failed=${countValue("failed") ?? 0} missing=${names("missing-jobs")}`;
    case "push-parity":
      return `${entry.id}  ${entry.verdict}  [repository-head+github-delivery-request-list+github-delivery-request-detail]  branch=${citationValue.identity.branch ?? "-"} local=${shortSha(citationValue.identity.localSha)} remote=${shortSha(citationValue.identity.headSha)}`;
    case "owner-gate":
      return `${entry.id}  ${entry.verdict}  [github-work-item]  work-item=${citationValue.identity.workItem ?? citationValue.identity.changeRef} owner-labels=${names("owner-labels")}`;
    case "squash-preflight": {
      const signals = citationValue.names.find((candidate) => candidate.kind === "squash-signals");
      const draft = signals?.values.some((value) => value === "draft=true") === true;
      const mergeable =
        signals?.values
          .find((value) => value.startsWith("mergeable="))
          ?.slice("mergeable=".length) ?? "unknown";
      return `${entry.id}  ${entry.verdict}  [github-delivery-request-list+github-delivery-request-detail]  pr=${citationValue.identity.deliveryRequest ?? "-"} base=${citationValue.identity.baseRef ?? "-"} draft=${draft ? "yes" : "no"} mergeable=${mergeable} commits=${countValue("commits") ?? "-"} files=${countValue("changedFiles") ?? "-"}`;
    }
  }
};

/** Render exactly six deterministic human success lines (Appendix E). */
export const renderVerifyGatesHuman = (report: VerifyGatesReport, brand: BrandIdentity): string => {
  const header = `${brand.binaryName} verify gates ${report.changeRef}  pass  5/5`;
  return `${[header, ...report.gates.map((entry) => humanLineFor(entry))].join("\n")}\n`;
};

/** Find the first unknown gate's error-table identity, if any. */
export const verifyGatesUnknownIdentity = (
  evaluation: VerifyGatesEvaluation,
): ErrorTableEntry | undefined => {
  for (const entry of evaluation.gates) {
    if (entry.verdict !== "unknown") continue;
    for (const source of entry.citation.sources) {
      if (source.failureCode === undefined) continue;
      const row = (ERROR_TABLE as readonly ErrorTableEntry[]).find(
        (candidate) => candidate.code === source.failureCode,
      );
      if (row !== undefined) return row;
    }
  }
  return undefined;
};
