/**
 * Capability-gated conformance runner (GH-189 F-2, F-10).
 *
 * Executes the registry per adapter capability, asserts normalized primitives,
 * records declared-gap skips, and fails closed on undeclared gaps or a
 * supported non-read step without a test-only handler. Time, run id, transport,
 * and credentials are injected; no ambient environment or clock is read.
 */
import type { AdapterOperation } from "@delivery-os/core/contracts";
import { CONFORMANCE_LIMITS } from "./artifact.js";
import { LIVE_READ_OPERATIONS } from "./coverage.js";
import { CONFORMANCE_FLOWS } from "./flows.js";
import type {
  ConformanceAdapterClient,
  ConformanceAdapterReadFailure,
  ConformanceAdapterRegistration,
  ConformanceFailure,
  ConformanceFailureScalar,
  ConformanceFlowResult,
  ConformanceFlowStatus,
  ConformanceProviderResult,
  ConformanceReport,
  ConformanceStepResult,
  MockTenant,
  RunConformanceInput,
} from "./types.js";

const READ_OPERATIONS: ReadonlySet<AdapterOperation> = new Set<AdapterOperation>([
  "read-work-item",
  "read-delivery-request",
  "read-pipeline-run",
]);

const LIVE_READS: ReadonlySet<string> = new Set<string>(LIVE_READ_OPERATIONS);

const DELIVERY_STATES: ReadonlySet<string> = new Set([
  "backlog",
  "ready",
  "in-progress",
  "in-review",
  "done",
  "canceled",
]);

const REVIEW_STATES: ReadonlySet<string> = new Set([
  "draft",
  "open",
  "changes-requested",
  "approved",
  "merged",
  "closed",
]);

const JOB_STATES: ReadonlySet<string> = new Set([
  "queued",
  "running",
  "succeeded",
  "failed",
  "canceled",
  "skipped",
]);

const RELATION_KINDS: ReadonlySet<string> = new Set([
  "parent",
  "child",
  "blocks",
  "blocked-by",
  "relates-to",
]);

const FORBIDDEN_NATIVE_KEYS: ReadonlySet<string> = new Set([
  "number",
  "html_url",
  "user",
  "head",
  "base",
  "_links",
  "fields",
  "customfield",
  "key",
  "self",
  "id",
  "iid",
  "web_url",
  "source_branch",
  "target_branch",
  "check_suite",
  "check_runs",
  "details_url",
  "pull_request",
  "login",
  "name",
]);

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]00:?00)$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const nonEmpty = (value: unknown): boolean => typeof value === "string" && value.trim().length > 0;

type InvariantViolation = {
  readonly assertion: string;
  readonly expected: ConformanceFailureScalar;
  readonly received: ConformanceFailureScalar;
};

const redactText = (value: string): string =>
  value
    .replace(/Authorization"\s*:\s*"Bearer\s+[^\s"]+/gi, 'Authorization": "Bearer [redacted]')
    .replace(/\bBearer\s+[A-Za-z0-9._-]{8,}/g, "Bearer [redacted]")
    .replace(/\bghp_[A-Za-z0-9]{16,}\b/g, "[redacted-token]")
    .replace(/\bglpat-[A-Za-z0-9_-]{16,}\b/g, "[redacted-token]")
    .replace(/\bATATT3?[A-Za-z0-9_-]{10,}\b/g, "[redacted-token]")
    .replace(
      /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
      "[redacted-key]",
    )
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[redacted-email]")
    .replace(/avatars\.githubusercontent\.com|secure\.gravatar\.com/g, "[redacted-avatar]")
    .replace(/raw-provider-payload/g, "[redacted-raw-payload]");

const bounded = (value: string): string => {
  const redacted = redactText(value);
  if (redacted.length <= CONFORMANCE_LIMITS.maxFailureDetailChars) return redacted;
  return `${redacted.slice(0, CONFORMANCE_LIMITS.maxFailureDetailChars)}…[truncated]`;
};

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map((entry) => canonicalize(entry));
  if (isRecord(value)) {
    const ordered: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) ordered[key] = canonicalize(value[key]);
    return ordered;
  }
  return value;
};

const stable = (value: unknown): string => JSON.stringify(canonicalize(value));

const summarize = (value: unknown): ConformanceFailureScalar => {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return stable(value).slice(0, 200);
};

const nativeKeyPaths = (value: unknown, path: string, findings: string[]): string[] => {
  if (Array.isArray(value)) {
    for (const [index, entry] of value.entries())
      nativeKeyPaths(entry, `${path}[${index}]`, findings);
    return findings;
  }
  if (!isRecord(value)) return findings;
  for (const [key, entry] of Object.entries(value)) {
    const next = path.length === 0 ? key : `${path}.${key}`;
    if (FORBIDDEN_NATIVE_KEYS.has(key)) findings.push(next);
    nativeKeyPaths(entry, next, findings);
  }
  return findings;
};

/** One attempted provider request, when the injected transport exposes its log. */
type AttemptedRequest = {
  readonly method: string;
  readonly url: string;
};

const requestLog = (transport: unknown): readonly unknown[] | undefined => {
  if (!isRecord(transport)) return undefined;
  const requests = transport.requests;
  if (Array.isArray(requests)) return requests;
  const records = transport.records;
  return Array.isArray(records) ? records : undefined;
};

const requestCount = (transport: unknown): number => requestLog(transport)?.length ?? 0;

const lastRequestSince = (
  transport: unknown,
  previousCount: number,
): AttemptedRequest | undefined => {
  const log = requestLog(transport);
  if (log === undefined || log.length <= previousCount) return undefined;
  const last = log[log.length - 1];
  if (!isRecord(last)) return undefined;
  const method = last.method;
  const url = last.url;
  if (typeof method !== "string" || typeof url !== "string") return undefined;
  return { method, url };
};

const identityViolations = (
  value: Record<string, unknown>,
  tenant: MockTenant,
  step: { readonly operation: AdapterOperation },
): InvariantViolation[] => {
  const violations: InvariantViolation[] = [];
  const identity = value.identity;
  if (!isRecord(identity)) {
    return [{ assertion: "identity", expected: "identity object", received: summarize(identity) }];
  }
  if (identity.systemName !== tenant.instance.instanceName) {
    violations.push({
      assertion: "identity-instance",
      expected: tenant.instance.instanceName,
      received: summarize(identity.systemName),
    });
  }
  if (!nonEmpty(identity.entityId)) {
    violations.push({
      assertion: "identity-entity",
      expected: "non-empty entity id",
      received: summarize(identity.entityId),
    });
  } else {
    const addressing = tenant.addressing;
    const expected =
      step.operation === "read-work-item" && addressing.provider === "github"
        ? String(addressing.issueNumber)
        : step.operation === "read-work-item" && addressing.provider === "jira"
          ? addressing.issueKey
          : step.operation === "read-delivery-request" && addressing.provider === "github"
            ? String(addressing.pullNumber)
            : step.operation === "read-delivery-request" && addressing.provider === "gitlab"
              ? String(addressing.mrIid)
              : undefined;
    if (expected !== undefined && identity.entityId !== expected) {
      violations.push({
        assertion: "identity-entity",
        expected,
        received: summarize(identity.entityId),
      });
    }
    if (step.operation === "read-pipeline-run" && addressing.provider === "github") {
      const prefix = `${addressing.commitSha}:`;
      if (!String(identity.entityId).startsWith(prefix)) {
        violations.push({
          assertion: "identity-entity",
          expected: `${prefix}*`,
          received: summarize(identity.entityId),
        });
      }
    }
  }
  return violations;
};

const workItemViolations = (
  value: Record<string, unknown>,
  tenant: MockTenant,
  step: { readonly operation: AdapterOperation },
): InvariantViolation[] => {
  const violations = identityViolations(value, tenant, step);
  if (!nonEmpty(value.title)) {
    violations.push({
      assertion: "title",
      expected: "non-empty title",
      received: summarize(value.title),
    });
  }
  const status = value.status;
  if (!isRecord(status) || !nonEmpty(status.nativeStatus)) {
    violations.push({
      assertion: "status",
      expected: "non-empty native status",
      received: summarize(status),
    });
  } else if (!DELIVERY_STATES.has(String(status.deliveryState))) {
    violations.push({
      assertion: "delivery-state",
      expected: "closed delivery state",
      received: summarize(status.deliveryState),
    });
  }
  if (!Array.isArray(value.labels) || !value.labels.every((label) => typeof label === "string")) {
    violations.push({
      assertion: "labels",
      expected: "string array",
      received: summarize(value.labels),
    });
  }
  const relations = value.relations;
  if (!Array.isArray(relations)) {
    violations.push({ assertion: "relations", expected: "array", received: summarize(relations) });
  } else {
    for (const relation of relations) {
      if (!isRecord(relation) || !RELATION_KINDS.has(String(relation.relationKind))) {
        violations.push({
          assertion: "relation-kind",
          expected: "closed relation kind",
          received: summarize(relation),
        });
      } else if (
        !isRecord(relation.target) ||
        !nonEmpty(relation.target.systemName) ||
        !nonEmpty(relation.target.entityId)
      ) {
        violations.push({
          assertion: "relation-target",
          expected: "qualified identity",
          received: summarize(relation.target),
        });
      }
    }
  }
  if (value.assignee !== undefined && !nonEmpty(value.assignee)) {
    violations.push({
      assertion: "assignee",
      expected: "non-empty string",
      received: summarize(value.assignee),
    });
  }
  if (value.updatedAt !== undefined && !ISO_UTC.test(String(value.updatedAt))) {
    violations.push({
      assertion: "updated-at",
      expected: "ISO-8601 UTC",
      received: summarize(value.updatedAt),
    });
  }
  if (value.comments !== undefined) {
    if (!Array.isArray(value.comments)) {
      violations.push({
        assertion: "comments",
        expected: "array",
        received: summarize(value.comments),
      });
    } else {
      for (const comment of value.comments) {
        if (
          !isRecord(comment) ||
          !nonEmpty(comment.commentId) ||
          !nonEmpty(comment.authorAccount) ||
          !nonEmpty(comment.body)
        ) {
          violations.push({
            assertion: "comment-provenance",
            expected: "comment id, author and body",
            received: summarize(comment),
          });
        }
      }
    }
  }
  return violations;
};

const deliveryRequestViolations = (
  value: Record<string, unknown>,
  tenant: MockTenant,
  step: { readonly operation: AdapterOperation },
): InvariantViolation[] => {
  const violations = identityViolations(value, tenant, step);
  if (!nonEmpty(value.sourceRef) || !nonEmpty(value.targetRef)) {
    violations.push({
      assertion: "refs",
      expected: "source and target refs",
      received: summarize(value),
    });
  }
  if (!REVIEW_STATES.has(String(value.reviewState))) {
    violations.push({
      assertion: "review-state",
      expected: "closed review state",
      received: summarize(value.reviewState),
    });
  }
  if (!Array.isArray(value.threads)) {
    violations.push({
      assertion: "threads",
      expected: "array",
      received: summarize(value.threads),
    });
  } else {
    for (const thread of value.threads) {
      if (
        !isRecord(thread) ||
        !nonEmpty(thread.threadId) ||
        typeof thread.resolved !== "boolean" ||
        typeof thread.commentCount !== "number" ||
        thread.commentCount < 0
      ) {
        violations.push({
          assertion: "thread",
          expected: "thread id, resolved flag and count",
          received: summarize(thread),
        });
      }
    }
  }
  return violations;
};

const pipelineViolations = (
  value: unknown,
  tenant: MockTenant,
  step: { readonly operation: AdapterOperation },
): InvariantViolation[] => {
  if (!Array.isArray(value)) {
    return [{ assertion: "pipeline-set", expected: "array", received: summarize(value) }];
  }
  const violations: InvariantViolation[] = [];
  for (const run of value) {
    if (!isRecord(run)) {
      violations.push({ assertion: "pipeline-run", expected: "object", received: summarize(run) });
      continue;
    }
    violations.push(...identityViolations(run, tenant, step));
    if (!nonEmpty(run.pipelineName)) {
      violations.push({
        assertion: "pipeline-name",
        expected: "non-empty",
        received: summarize(run.pipelineName),
      });
    }
    if (!Array.isArray(run.jobs)) {
      violations.push({ assertion: "jobs", expected: "array", received: summarize(run.jobs) });
    } else {
      for (const job of run.jobs) {
        if (!isRecord(job) || !nonEmpty(job.jobName) || !JOB_STATES.has(String(job.jobState))) {
          violations.push({
            assertion: "job-state",
            expected: "closed job state",
            received: summarize(job),
          });
        }
      }
    }
    if (!Array.isArray(run.traceEvidence)) {
      violations.push({
        assertion: "trace-evidence",
        expected: "array",
        received: summarize(run.traceEvidence),
      });
    } else {
      for (const evidence of run.traceEvidence) {
        if (
          !isRecord(evidence) ||
          !nonEmpty(evidence.evidenceName) ||
          !nonEmpty(evidence.location)
        ) {
          violations.push({
            assertion: "trace-evidence",
            expected: "evidence name and location",
            received: summarize(evidence),
          });
        }
      }
    }
  }
  return violations;
};

const invariantViolations = (
  value: unknown,
  tenant: MockTenant,
  step: { readonly assertionFamily: string; readonly operation: AdapterOperation },
): InvariantViolation[] => {
  const violations: InvariantViolation[] = [];
  if (!isRecord(value) && !Array.isArray(value)) {
    return [{ assertion: "primitive", expected: "object or array", received: summarize(value) }];
  }
  const native = nativeKeyPaths(value, "", []);
  for (const path of native) {
    violations.push({
      assertion: "primitive-purity",
      expected: "no provider-native key",
      received: path,
    });
  }
  if (step.assertionFamily === "pipeline-run") {
    return [...violations, ...pipelineViolations(value, tenant, step)];
  }
  if (!isRecord(value)) {
    return [
      ...violations,
      { assertion: "primitive", expected: "object", received: summarize(value) },
    ];
  }
  if (step.assertionFamily === "delivery-request") {
    return [...violations, ...deliveryRequestViolations(value, tenant, step)];
  }
  return [...violations, ...workItemViolations(value, tenant, step)];
};

const failClosed = (
  message: string,
  provider: string,
  flowId: string,
  stepId: string,
  operation: string,
): never => {
  throw new Error(
    `${message}: provider ${provider}, flow ${flowId}, step ${stepId}, operation ${operation}`,
  );
};

const failureFor = (
  assertion: string,
  expected: ConformanceFailureScalar,
  received: ConformanceFailureScalar,
  reference: string,
  detail: string,
): ConformanceFailure => ({
  assertion: bounded(assertion),
  expected: typeof expected === "string" ? bounded(expected) : expected,
  received: typeof received === "string" ? bounded(received) : received,
  reference: bounded(reference),
  detail: bounded(detail),
});

const readValue = async (
  client: ConformanceAdapterClient,
  operation: AdapterOperation,
  provider: string,
  flowId: string,
  stepId: string,
): Promise<{ readonly ok: true; readonly value: unknown } | ConformanceAdapterReadFailure> => {
  if (operation === "read-work-item") {
    if (!client.readWorkItem)
      return failClosed("no read-work-item client", provider, flowId, stepId, operation);
    return client.readWorkItem();
  }
  if (operation === "read-delivery-request") {
    if (!client.readDeliveryRequest)
      return failClosed("no read-delivery-request client", provider, flowId, stepId, operation);
    return client.readDeliveryRequest();
  }
  if (!client.readPipelineRun)
    return failClosed("no read-pipeline-run client", provider, flowId, stepId, operation);
  return client.readPipelineRun();
};

const gapFor = (
  registration: ConformanceAdapterRegistration,
  operation: AdapterOperation,
): { readonly reason: string } | undefined =>
  registration.contract.capabilities.declaredGaps.find((gap) => gap.operation === operation);

const flowStatusFor = (steps: readonly ConformanceStepResult[]): ConformanceFlowStatus => {
  if (steps.some((step) => step.status === "failed")) return "failed";
  if (steps.some((step) => step.status === "executed")) return "passed";
  return "skipped";
};

const totalsFor = (report: {
  readonly providers: readonly ConformanceProviderResult[];
  readonly flows: readonly ConformanceFlowResult[];
  readonly steps: readonly ConformanceStepResult[];
}): {
  providers: number;
  flows: number;
  steps: number;
  executed: number;
  skipped: number;
  failed: number;
} => ({
  providers: report.providers.length,
  flows: report.flows.length,
  steps: report.steps.length,
  executed: report.steps.filter((step) => step.status === "executed").length,
  skipped: report.steps.filter((step) => step.status === "skipped").length,
  failed: report.steps.filter((step) => step.status === "failed").length,
});

/**
 * Execute the flow registry against every supplied adapter.
 *
 * `adapters` is the sole participant list; production callers pass the shipped
 * registry, while controls inject test-only registrations. A supported non-read
 * step without a handler and an unsupported operation without a declared gap
 * fail closed by name.
 */
export const runConformance = async (input: RunConformanceInput): Promise<ConformanceReport> => {
  const providers: ConformanceProviderResult[] = [];
  const flows: ConformanceFlowResult[] = [];
  const steps: ConformanceStepResult[] = [];

  for (const registration of input.adapters) {
    const provider = registration.provider;
    const tenant = input.tenants[provider];
    if (tenant === undefined) {
      throw new Error(`no mock tenant for provider ${provider}`);
    }
    const transport = input.transportFactory(provider);
    const client = registration.buildClient({
      tenant,
      instance: tenant.instance,
      credentials: input.credentials,
      transport,
    });
    const capabilities = registration.contract.capabilities;
    const providerFlowSummaries: { flowId: string; name: string; status: ConformanceFlowStatus }[] =
      [];

    for (const flow of CONFORMANCE_FLOWS) {
      const flowSteps: ConformanceStepResult[] = [];
      for (const step of flow.steps) {
        const base = {
          provider,
          flowId: flow.flowId,
          stepId: step.stepId,
          operation: step.operation,
        };
        const supported = capabilities.supportedOperations.includes(step.operation);
        if (!supported) {
          const gap = gapFor(registration, step.operation);
          if (gap === undefined) {
            return failClosed(
              "undeclared unsupported operation",
              provider,
              flow.flowId,
              step.stepId,
              step.operation,
            );
          }
          flowSteps.push({
            ...base,
            status: "skipped",
            skipReason: gap.reason,
            skipKind: "declared-gap",
            assertionCount: 0,
          });
          continue;
        }

        if (input.tier === "live" && !LIVE_READS.has(step.operation)) {
          flowSteps.push({
            ...base,
            status: "skipped",
            skipReason: "live-read-only",
            skipKind: "live-read-only",
            assertionCount: 0,
          });
          continue;
        }

        if (READ_OPERATIONS.has(step.operation)) {
          const requestsBefore = requestCount(transport);
          const result = await readValue(
            client,
            step.operation,
            provider,
            flow.flowId,
            step.stepId,
          );
          if (!result.ok) {
            const detail = "detail" in result ? result.detail : result.code;
            const attempted = lastRequestSince(transport, requestsBefore);
            const descriptor =
              attempted === undefined ? undefined : `${attempted.method} ${attempted.url}`;
            flowSteps.push({
              ...base,
              status: "failed",
              skipReason: null,
              skipKind: null,
              assertionCount: 0,
              failure: failureFor(
                "provider-read",
                "successful read",
                "classified failure",
                descriptor ?? `tenant:${provider}:${step.stepId}`,
                descriptor === undefined ? detail : `${detail} (request ${descriptor})`,
              ),
            });
            continue;
          }
          const violations = invariantViolations(result.value, tenant, step);
          if (violations.length > 0) {
            const first = violations[0];
            if (first === undefined) {
              flowSteps.push({
                ...base,
                status: "failed",
                skipReason: null,
                skipKind: null,
                assertionCount: 0,
                failure: failureFor(
                  "primitive",
                  "valid primitive",
                  "invalid primitive",
                  `tenant:${provider}:${step.stepId}`,
                  "primitive assertion failed",
                ),
              });
              continue;
            }
            flowSteps.push({
              ...base,
              status: "failed",
              skipReason: null,
              skipKind: null,
              assertionCount: 0,
              failure: failureFor(
                first.assertion,
                first.expected,
                first.received,
                `tenant:${provider}:${step.stepId}`,
                violations.map((entry) => `${entry.assertion} failed`).join("; "),
              ),
            });
            continue;
          }
          if (input.tier === "mock") {
            const expected = tenant.expected[step.stepId];
            if (expected === undefined) {
              flowSteps.push({
                ...base,
                status: "failed",
                skipReason: null,
                skipKind: null,
                assertionCount: 0,
                failure: failureFor(
                  "expected-projection",
                  "declared projection",
                  "missing expected projection",
                  `tenant:${provider}:${step.stepId}`,
                  `tenant has no expected projection for ${step.stepId}`,
                ),
              });
              continue;
            }
            if (stable(expected) !== stable(result.value)) {
              flowSteps.push({
                ...base,
                status: "failed",
                skipReason: null,
                skipKind: null,
                assertionCount: 0,
                failure: failureFor(
                  "expected-projection",
                  summarize(expected),
                  summarize(result.value),
                  `tenant:${provider}:${step.stepId}`,
                  `normalized projection differs from the declared expectation`,
                ),
              });
              continue;
            }
          }
          flowSteps.push({
            ...base,
            status: "executed",
            skipReason: null,
            skipKind: null,
            assertionCount: 1,
          });
          continue;
        }

        if (step.requiresCarrier === true) {
          const carriersDeclared =
            capabilities.writableCarriers.length > 0 && capabilities.readableCarriers.length > 0;
          if (!carriersDeclared) {
            flowSteps.push({
              ...base,
              status: "skipped",
              skipReason: "no-declared-carrier",
              skipKind: "capability-absent",
              assertionCount: 0,
            });
            continue;
          }
        }

        const handler = registration.writeHandler;
        if (handler === undefined) {
          return failClosed(
            "supported non-read conformance step has no handler",
            provider,
            flow.flowId,
            step.stepId,
            step.operation,
          );
        }
        const outcome = await handler({
          provider,
          flowId: flow.flowId,
          stepId: step.stepId,
          operation: step.operation,
          tenant,
        });
        if (!outcome.ok) {
          flowSteps.push({
            ...base,
            status: "failed",
            skipReason: null,
            skipKind: null,
            assertionCount: 0,
            failure: failureFor(
              "control-write",
              "successful control write",
              "control write failure",
              `tenant:${provider}:${step.stepId}`,
              outcome.detail,
            ),
          });
          continue;
        }
        flowSteps.push({
          ...base,
          status: "executed",
          skipReason: null,
          skipKind: null,
          assertionCount: outcome.assertionCount,
        });
      }
      const flowStatus = flowStatusFor(flowSteps);
      flows.push({
        provider,
        flowId: flow.flowId,
        name: flow.name,
        status: flowStatus,
        steps: flowSteps,
      });
      steps.push(...flowSteps);
      providerFlowSummaries.push({ flowId: flow.flowId, name: flow.name, status: flowStatus });
    }

    providers.push({
      provider,
      adapterName: registration.contract.adapterName,
      status: providerFlowSummaries.some((summary) => summary.status === "failed")
        ? "failed"
        : "passed",
      missingSettings: [],
      flows: providerFlowSummaries,
    });
  }

  const status = providers.some((provider) => provider.status === "failed") ? "failed" : "passed";
  return {
    runId: input.runId,
    tier: input.tier,
    generatedAt: input.nowIso,
    status,
    providers,
    flows,
    steps,
    mutationRequests: 0,
    createdArtifacts: 0,
    totals: totalsFor({ providers, flows, steps }),
  };
};
