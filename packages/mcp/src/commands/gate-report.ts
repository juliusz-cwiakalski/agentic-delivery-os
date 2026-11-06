/**
 * The `gate-report` tool engine half (F-4, AC-F4-1, AC-F5-1).
 *
 * Mirrors the CLI `verify gates` handler exactly: build the same fact bundle
 * from the injected reads, feed it to the pure evaluator, and return the
 * `delivery.verify-gates.v1` report or the identical classified failure. The
 * first unknown gate keeps its classified identity; no fabricated pass verdict
 * is ever emitted.
 */
import {
  classifyVerifyDocument,
  EvaluateVerifyChange,
  evaluateVerifyGates,
  isFullHexSha,
  renderVerifyGatesFailureSummary,
  resolveOpenPr,
  type VerifyGatesCheckRunPage,
  type VerifyGatesDetail,
  type VerifyGatesFacts,
  type VerifyGatesOpenPrPage,
  type VerifyGatesReadResult,
  type VerifyGatesRepositoryFacts,
  type VerifyGatesWorkflowFacts,
  type VerifyGatesWorkItem,
  verifyGatesUnknownIdentity,
} from "@delivery-os/core";
import {
  type PhaseTransitionRecord,
  type PmNotesParseFailure,
  type StateFailure,
  VERIFY_GATES_CI_RUN_LIMIT,
  VERIFY_GATES_OPEN_PR_LIMIT,
  VERIFY_GATES_SCHEMA_VERSION,
  type VerifyGatesReport,
} from "@delivery-os/core/contracts";
import { failureFromValue, type McpToolResult } from "../output/payload.js";

/** A pm-notes target read at the edge: values, absence, or a safe parse failure. */
export type GateReportPmNotesRead =
  | { readonly ok: true; readonly file: string; readonly text: string; readonly value: unknown }
  | { readonly ok: false; readonly reason: "missing" }
  | {
      readonly ok: false;
      readonly reason: "malformed";
      readonly file: string;
      readonly parseFailure: PmNotesParseFailure;
    };

/** A presence-tolerant verified registry read: evidence, or a state failure. */
export type GateReportRegistryRead =
  | {
      readonly ok: true;
      readonly present: boolean;
      readonly verifiedEmpty: boolean;
      readonly transitions: readonly PhaseTransitionRecord[];
      readonly recordCount: number;
    }
  | { readonly ok: false; readonly error: StateFailure };

/** Every gates read, injected; all I/O stays at the edge. */
export type GateReportToolRuntime = {
  readonly readLifecycle: (changeRef: string) => {
    readonly document: GateReportPmNotesRead;
    readonly registry: GateReportRegistryRead;
  };
  readonly readRepository: () => VerifyGatesRepositoryFacts;
  readonly readWorkflow: () => VerifyGatesWorkflowFacts;
  readonly readOpenPullRequests: (
    limit: number,
  ) => Promise<VerifyGatesReadResult<VerifyGatesOpenPrPage>>;
  readonly readDeliveryRequestDetail: (
    pullNumber: string,
  ) => Promise<VerifyGatesReadResult<VerifyGatesDetail>>;
  readonly readCheckRuns: (
    sha: string,
    limit: number,
  ) => Promise<VerifyGatesReadResult<VerifyGatesCheckRunPage>>;
  readonly readWorkItem: (changeRef: string) => Promise<VerifyGatesReadResult<VerifyGatesWorkItem>>;
};

const GRAMMAR_SUMMARY = "result=failed; variant=unknown; missing=-";

const lifecycleEvaluation = (
  runtime: GateReportToolRuntime,
  changeRef: string,
): VerifyGatesFacts["lifecycle"]["evaluation"] => {
  const read = runtime.readLifecycle(changeRef);
  const document = read.document.ok
    ? classifyVerifyDocument({ ok: true, value: read.document.value })
    : read.document.reason === "missing"
      ? {
          ok: false as const,
          kind: "lint" as const,
          code: "lint.target.missing",
          summary: GRAMMAR_SUMMARY,
        }
      : classifyVerifyDocument({
          ok: false,
          parseFailure: read.document.parseFailure,
        });
  return EvaluateVerifyChange({
    changeRef,
    document,
    registry: read.registry,
  });
};

const notAttempted = <T>(
  reason: "address-unresolved" | "not-attempted",
): VerifyGatesReadResult<T> =>
  reason === "not-attempted"
    ? { ok: false, reason: "not-attempted" }
    : { ok: false, reason: "address-unresolved" };

const readProviderFacts = async (
  runtime: GateReportToolRuntime,
  changeRef: string,
  repository: VerifyGatesRepositoryFacts,
): Promise<{
  readonly openPullRequests: VerifyGatesReadResult<VerifyGatesOpenPrPage>;
  readonly deliveryRequestDetail: VerifyGatesReadResult<VerifyGatesDetail>;
  readonly checkRuns: VerifyGatesReadResult<VerifyGatesCheckRunPage>;
  readonly workItem: VerifyGatesReadResult<VerifyGatesWorkItem>;
}> => {
  if (repository.binding !== "resolved") {
    return {
      openPullRequests: notAttempted<VerifyGatesOpenPrPage>("address-unresolved"),
      deliveryRequestDetail: notAttempted<VerifyGatesDetail>("address-unresolved"),
      checkRuns: notAttempted<VerifyGatesCheckRunPage>("address-unresolved"),
      workItem: notAttempted<VerifyGatesWorkItem>("address-unresolved"),
    };
  }
  if (repository.head.detached || repository.head.branch === undefined) {
    return {
      openPullRequests: notAttempted<VerifyGatesOpenPrPage>("not-attempted"),
      deliveryRequestDetail: notAttempted<VerifyGatesDetail>("not-attempted"),
      checkRuns: notAttempted<VerifyGatesCheckRunPage>("not-attempted"),
      workItem: await runtime.readWorkItem(changeRef),
    };
  }
  const openPullRequests = await runtime.readOpenPullRequests(VERIFY_GATES_OPEN_PR_LIMIT);
  if (!openPullRequests.ok) {
    return {
      openPullRequests,
      deliveryRequestDetail: notAttempted<VerifyGatesDetail>("not-attempted"),
      checkRuns: notAttempted<VerifyGatesCheckRunPage>("not-attempted"),
      workItem: await runtime.readWorkItem(changeRef),
    };
  }
  const resolution = resolveOpenPr({
    branch: repository.head.branch,
    detached: false,
    pageItemCount: openPullRequests.value.pageItemCount,
    items: openPullRequests.value.items,
  });
  if (resolution.outcome !== "resolved" || resolution.deliveryRequest === undefined) {
    return {
      openPullRequests,
      deliveryRequestDetail: notAttempted<VerifyGatesDetail>("not-attempted"),
      checkRuns: notAttempted<VerifyGatesCheckRunPage>("not-attempted"),
      workItem: await runtime.readWorkItem(changeRef),
    };
  }
  const deliveryRequestDetail = await runtime.readDeliveryRequestDetail(
    resolution.deliveryRequest.identity.entityId,
  );
  if (
    !deliveryRequestDetail.ok ||
    !isFullHexSha(deliveryRequestDetail.value.request.sourceHeadSha)
  ) {
    return {
      openPullRequests,
      deliveryRequestDetail,
      checkRuns: notAttempted<VerifyGatesCheckRunPage>("not-attempted"),
      workItem: await runtime.readWorkItem(changeRef),
    };
  }
  const checkRuns = await runtime.readCheckRuns(
    deliveryRequestDetail.value.request.sourceHeadSha,
    VERIFY_GATES_CI_RUN_LIMIT,
  );
  return {
    openPullRequests,
    deliveryRequestDetail,
    checkRuns,
    workItem: await runtime.readWorkItem(changeRef),
  };
};

/** Run one `gate-report` tool call for `changeRef`. */
export const runGateReportTool = async (
  runtime: GateReportToolRuntime,
  changeRef: string,
): Promise<McpToolResult<VerifyGatesReport>> => {
  const repository = runtime.readRepository();
  const evaluation = lifecycleEvaluation(runtime, changeRef);
  const workflow = runtime.readWorkflow();
  const provider = await readProviderFacts(runtime, changeRef, repository);
  const facts: VerifyGatesFacts = {
    changeRef,
    lifecycle: { evaluation },
    repository,
    workflow,
    ...provider,
  };
  const evaluated = evaluateVerifyGates(facts);
  if (evaluated.overall === "pass") {
    const data: VerifyGatesReport = {
      schemaVersion: VERIFY_GATES_SCHEMA_VERSION,
      changeRef,
      target: "gates",
      overall: "pass",
      summary: evaluated.summary,
      gates: evaluated.gates,
    };
    return { ok: true, data };
  }
  const summary = renderVerifyGatesFailureSummary(evaluated);
  if (evaluated.overall === "fail") {
    return failureFromValue({ kind: "verify", code: "verify.gates.failed", summary });
  }
  const identity = verifyGatesUnknownIdentity(evaluated);
  return identity === undefined
    ? failureFromValue({ kind: "verify", code: "verify.gates.unavailable", summary })
    : failureFromValue({ kind: identity.domainKind, code: identity.code, summary });
};
