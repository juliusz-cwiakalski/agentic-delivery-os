/**
 * `verify gates` handler (GH-178 F-1..F-10).
 *
 * The handler orchestrates already-injected reads, feeds one frozen fact bundle
 * to the pure evaluator, and returns data or one classified error. It never
 * writes a stream or chooses an exit code; grammar validation happens before any
 * call. `verify change` remains on its own untouched handler path.
 */
import {
  classifyVerifyDocument,
  EvaluateVerifyChange,
  evaluateVerifyGates,
  isFullHexSha,
  renderVerifyGatesFailureSummary,
  resolveOpenPr,
  verifyGatesUnknownIdentity,
  type VerifyGatesCheckRunPage,
  type VerifyGatesDetail,
  type VerifyGatesFacts,
  type VerifyGatesOpenPrPage,
  type VerifyGatesReadResult,
  type VerifyGatesRepositoryFacts,
  type VerifyGatesWorkItem,
  type VerifyGatesWorkflowFacts,
} from "@delivery-os/core";
import {
  type PhaseTransitionRecord,
  type PmNotesParseFailure,
  type StateFailure,
  VERIFY_GATES_CI_RUN_LIMIT,
  VERIFY_GATES_OPEN_PR_LIMIT,
  VERIFY_GATES_SCHEMA_VERSION,
} from "@delivery-os/core/contracts";
import type { CommandHandler } from "../index.js";

/** A pm-notes target read at the edge: values, absence, or a safe parse failure. */
export type VerifyGatesPmNotesRead =
  | { readonly ok: true; readonly file: string; readonly text: string; readonly value: unknown }
  | { readonly ok: false; readonly reason: "missing" }
  | {
      readonly ok: false;
      readonly reason: "malformed";
      readonly file: string;
      readonly parseFailure: PmNotesParseFailure;
    };

/** A presence-tolerant verified registry read: evidence, or a state failure. */
export type VerifyGatesRegistryRead =
  | {
      readonly ok: true;
      readonly present: boolean;
      readonly verifiedEmpty: boolean;
      readonly transitions: readonly PhaseTransitionRecord[];
      readonly recordCount: number;
    }
  | { readonly ok: false; readonly error: StateFailure };

/** Every gates read, injected; all I/O and provider access stays at the edge. */
export type VerifyGatesCommandRuntime = {
  readonly readLifecycle: (changeRef: string) => {
    readonly document: VerifyGatesPmNotesRead;
    readonly registry: VerifyGatesRegistryRead;
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

type VerifyGatesFailure = { readonly ok: false; readonly error: Record<string, unknown> };
type VerifyGatesSuccess = { readonly ok: true; readonly data: Record<string, unknown> };

const GRAMMAR_SUMMARY = "result=failed; variant=unknown; missing=-";

const failure = (kind: string, code: string, summary?: string): VerifyGatesFailure => ({
  ok: false,
  error: {
    kind,
    code,
    ...(summary === undefined ? {} : { summary }),
  },
});

const notAttempted = <T>(
  reason: "address-unresolved" | "not-attempted",
): VerifyGatesReadResult<T> =>
  reason === "not-attempted"
    ? { ok: false, reason: "not-attempted" }
    : { ok: false, reason: "address-unresolved" };

const lifecycleEvaluation = (
  runtime: VerifyGatesCommandRuntime,
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

const readProviderFacts = async (
  runtime: VerifyGatesCommandRuntime,
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

/** Build the gates handler over the injected read seam. */
export const createVerifyGatesHandler = (runtime: VerifyGatesCommandRuntime): CommandHandler => {
  return async (invocation) => {
    const ref = invocation.positionals[1];
    if (
      invocation.positionals.length !== 2 ||
      invocation.positionals[0] !== "gates" ||
      ref === undefined ||
      ref.length === 0
    ) {
      return failure("input", "input.value.rejected", GRAMMAR_SUMMARY);
    }
    const repository = runtime.readRepository();
    const evaluation = lifecycleEvaluation(runtime, ref);
    const workflow = runtime.readWorkflow();
    const provider = await readProviderFacts(runtime, ref, repository);
    const facts: VerifyGatesFacts = {
      changeRef: ref,
      lifecycle: { evaluation },
      repository,
      workflow,
      ...provider,
    };
    const evaluated = evaluateVerifyGates(facts);
    if (evaluated.overall === "pass") {
      const data: Record<string, unknown> = {
        schemaVersion: VERIFY_GATES_SCHEMA_VERSION,
        changeRef: ref,
        target: "gates",
        overall: "pass",
        summary: evaluated.summary,
        gates: evaluated.gates,
      };
      return { ok: true, data } satisfies VerifyGatesSuccess;
    }
    const summary = renderVerifyGatesFailureSummary(evaluated);
    if (evaluated.overall === "fail") {
      return failure("verify", "verify.gates.failed", summary);
    }
    const identity = verifyGatesUnknownIdentity(evaluated);
    return identity === undefined
      ? failure("verify", "verify.gates.unavailable", summary)
      : failure(identity.domainKind, identity.code, summary);
  };
};
