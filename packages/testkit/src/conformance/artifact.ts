/**
 * `delivery.conformance.v1` schema constants, serializer, and validator
 * (GH-189 F-8, D-1, D-3, D-9, D-11).
 *
 * The serializer redacts the sanitization shape families and truncates free
 * text. The validator re-scans the serialized artifact and fails by field name.
 */
import type {
  ConformanceArtifact,
  ConformanceFailure,
  ConformanceFailureScalar,
  ConformanceFlowStatus,
  ConformanceProviderStatus,
  ConformanceReport,
  ConformanceSkipKind,
  ConformanceStatus,
  ConformanceStepResult,
  ConformanceStepStatus,
  ConformanceTier,
} from "./types.js";

/** The versioned artifact schema identifier (DM-6). */
export const CONFORMANCE_SCHEMA_ID = "delivery.conformance.v1" as const;

/** The visible truncation marker. */
export const CONFORMANCE_TRUNCATION_MARKER = "…[truncated]" as const;

/** The closed tier set. */
export const CONFORMANCE_TIERS = ["mock", "live"] as const satisfies readonly ConformanceTier[];

/** The closed overall/provider status set (D-3). */
export const CONFORMANCE_STATUSES = [
  "passed",
  "failed",
  "not-configured",
] as const satisfies readonly ConformanceStatus[];

/** Per-provider statuses are the same closed set; there is no provider-level skip. */
export const CONFORMANCE_PROVIDER_STATUSES =
  CONFORMANCE_STATUSES satisfies readonly ConformanceProviderStatus[];

/** The closed step status set. */
export const CONFORMANCE_STEP_STATUSES = [
  "executed",
  "skipped",
  "failed",
] as const satisfies readonly ConformanceStepStatus[];

/** The closed flow summary status set. */
export const CONFORMANCE_FLOW_STATUSES = [
  "passed",
  "failed",
  "skipped",
] as const satisfies readonly ConformanceFlowStatus[];

/** The closed skip-kind set (spec §24 v1.2). */
export const CONFORMANCE_SKIP_KINDS = [
  "declared-gap",
  "capability-absent",
  "live-read-only",
] as const satisfies readonly ConformanceSkipKind[];

/**
 * The finite artifact caps (D-1).
 *
 * Every value is a finite positive integer so bounds cannot be silently
 * disabled. `maxArtifactBytes` is 256 KiB.
 */
export const CONFORMANCE_LIMITS = {
  maxProviders: 16,
  maxFlows: 16,
  maxStepsPerFlow: 64,
  maxTotalSteps: 512,
  maxMissingSettingsPerProvider: 16,
  maxFailureDetailChars: 1024,
  maxArtifactBytes: 262144,
} as const;

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]00:?00)$/;

const FORBIDDEN_SHAPES: readonly { readonly detail: string; readonly pattern: RegExp }[] = [
  { detail: "authorization bearer header", pattern: /Authorization"\s*:\s*"Bearer\s+[^\s"]+/i },
  { detail: "bearer credential", pattern: /\bBearer\s+[A-Za-z0-9._-]{8,}/ },
  { detail: "github token", pattern: /\bghp_[A-Za-z0-9]{16,}\b/ },
  { detail: "gitlab token", pattern: /\bglpat-[A-Za-z0-9_-]{16,}\b/ },
  { detail: "atlassian token", pattern: /\bATATT3?[A-Za-z0-9_-]{10,}\b/ },
  { detail: "PEM private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { detail: "email address", pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
  {
    detail: "avatar URL",
    pattern: /avatars\.githubusercontent\.com|secure\.gravatar\.com/,
  },
  { detail: "raw provider payload marker", pattern: /raw-provider-payload/ },
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isScalar = (value: unknown): value is ConformanceFailureScalar =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean";

const redact = (value: string): string =>
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

const bounded = (value: string, cap: number): string => {
  const redacted = redact(value);
  if (redacted.length <= cap) return redacted;
  return `${redacted.slice(0, cap)}${CONFORMANCE_TRUNCATION_MARKER}`;
};

const sanitizeFailure = (failure: ConformanceFailure): ConformanceFailure => {
  if (!isScalar(failure.expected) || !isScalar(failure.received)) {
    throw new Error("failure expected/received must be scalars");
  }
  return {
    assertion: bounded(failure.assertion, CONFORMANCE_LIMITS.maxFailureDetailChars),
    expected:
      typeof failure.expected === "string"
        ? bounded(failure.expected, CONFORMANCE_LIMITS.maxFailureDetailChars)
        : failure.expected,
    received:
      typeof failure.received === "string"
        ? bounded(failure.received, CONFORMANCE_LIMITS.maxFailureDetailChars)
        : failure.received,
    reference: bounded(failure.reference, CONFORMANCE_LIMITS.maxFailureDetailChars),
    detail: bounded(failure.detail, CONFORMANCE_LIMITS.maxFailureDetailChars),
  };
};

const sanitizeStep = (step: ConformanceStepResult): ConformanceStepResult => ({
  ...step,
  ...(step.failure !== undefined ? { failure: sanitizeFailure(step.failure) } : {}),
});

/** Attach the schema id to a report, producing the persisted artifact shape. */
export const toConformanceArtifact = (report: ConformanceReport): ConformanceArtifact => ({
  schema: CONFORMANCE_SCHEMA_ID,
  ...report,
});

/**
 * Serialize an artifact with bounded, redacted free text.
 *
 * Non-scalar expected/received values are rejected; the encoded size must stay
 * within `maxArtifactBytes`.
 */
export const serializeConformanceArtifact = (artifact: ConformanceArtifact): string => {
  const sanitized: ConformanceArtifact = {
    ...artifact,
    providers: artifact.providers.map((provider) => ({
      ...provider,
      missingSettings: provider.missingSettings.map((name) => bounded(name, 256)),
    })),
    flows: artifact.flows.map((flow) => ({ ...flow, steps: flow.steps.map(sanitizeStep) })),
    steps: artifact.steps.map(sanitizeStep),
  };
  const text = JSON.stringify(sanitized);
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > CONFORMANCE_LIMITS.maxArtifactBytes) {
    throw new Error(
      `serialized artifact exceeds maxArtifactBytes ${CONFORMANCE_LIMITS.maxArtifactBytes} (observed ${bytes})`,
    );
  }
  return text;
};

const required = (
  value: Record<string, unknown>,
  key: string,
  failures: string[],
  label: string,
): void => {
  if (!Object.hasOwn(value, key) || value[key] === undefined) {
    failures.push(`${label}: missing required field ${key}`);
  }
};

const validateFailure = (value: unknown, label: string, failures: string[]): void => {
  if (!isRecord(value)) {
    failures.push(`${label}: failure is not an object`);
    return;
  }
  for (const key of ["assertion", "expected", "received", "reference", "detail"]) {
    required(value, key, failures, label);
  }
  if (!isScalar(value.expected) || !isScalar(value.received)) {
    failures.push(`${label}: expected/received must be scalars`);
  }
  const detail = value.detail;
  if (
    typeof detail === "string" &&
    detail.length > CONFORMANCE_LIMITS.maxFailureDetailChars + CONFORMANCE_TRUNCATION_MARKER.length
  ) {
    failures.push(`${label}: failure detail exceeds maxFailureDetailChars`);
  }
};

const validateStep = (
  value: unknown,
  label: string,
  expected: readonly string[],
  failures: string[],
): void => {
  if (!isRecord(value)) {
    failures.push(`${label}: step is not an object`);
    return;
  }
  for (const key of expected) required(value, key, failures, label);
  const status = value.status;
  if (
    typeof status !== "string" ||
    !(CONFORMANCE_STEP_STATUSES as readonly string[]).includes(status)
  ) {
    failures.push(`${label}: invalid status ${String(status)}`);
  }
  if (status === "skipped") {
    if (
      typeof value.skipKind !== "string" ||
      !(CONFORMANCE_SKIP_KINDS as readonly string[]).includes(value.skipKind)
    ) {
      failures.push(`${label}: skipped step has an invalid skipKind`);
    }
    if (typeof value.skipReason !== "string" || value.skipReason.trim().length === 0) {
      failures.push(`${label}: skipped step has no skipReason`);
    }
  } else if (status === "executed" || status === "failed") {
    if (value.skipKind !== null)
      failures.push(`${label}: non-skipped step must carry skipKind null`);
    if (value.skipReason !== null)
      failures.push(`${label}: non-skipped step must carry skipReason null`);
  }
  if (typeof value.assertionCount !== "number" || value.assertionCount < 0) {
    failures.push(`${label}: assertionCount must be a non-negative number`);
  }
  if (value.failure !== undefined) validateFailure(value.failure, label, failures);
};

const artifactText = (value: unknown): string | undefined => {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
};

/**
 * Validate an untrusted artifact against `delivery.conformance.v1`.
 *
 * Every violation names the field, provider, flow, or step at fault.
 */
export const validateConformanceArtifact = (value: unknown): string[] => {
  const failures: string[] = [];
  if (!isRecord(value)) return ["artifact: root is not an object"];
  if (value.schema !== CONFORMANCE_SCHEMA_ID) {
    failures.push(`artifact: unsupported schema ${String(value.schema)}`);
  }
  for (const key of [
    "runId",
    "tier",
    "generatedAt",
    "status",
    "providers",
    "flows",
    "steps",
    "mutationRequests",
    "createdArtifacts",
    "totals",
  ]) {
    required(value, key, failures, "artifact");
  }
  if (typeof value.runId !== "string" || value.runId.trim().length === 0) {
    failures.push("artifact: runId must be non-empty");
  }
  if (
    typeof value.tier !== "string" ||
    !(CONFORMANCE_TIERS as readonly string[]).includes(value.tier)
  ) {
    failures.push(`artifact: invalid tier ${String(value.tier)}`);
  }
  if (typeof value.generatedAt !== "string" || !ISO_UTC.test(value.generatedAt)) {
    failures.push("artifact: generatedAt must be ISO-8601 UTC");
  }
  if (
    typeof value.status !== "string" ||
    !(CONFORMANCE_STATUSES as readonly string[]).includes(value.status)
  ) {
    failures.push(`artifact: invalid status ${String(value.status)}`);
  }
  if (typeof value.mutationRequests !== "number" || value.mutationRequests < 0) {
    failures.push("artifact: missing or invalid mutationRequests");
  }
  if (typeof value.createdArtifacts !== "number" || value.createdArtifacts < 0) {
    failures.push("artifact: missing or invalid createdArtifacts");
  }
  if (!isRecord(value.totals)) {
    failures.push("artifact: totals must be an object");
  }

  const providers = value.providers;
  if (!Array.isArray(providers)) {
    failures.push("artifact: providers must be an array");
  } else {
    if (providers.length > CONFORMANCE_LIMITS.maxProviders) {
      failures.push(
        `artifact: providers exceeds maxProviders ${CONFORMANCE_LIMITS.maxProviders} (observed ${providers.length})`,
      );
    }
    for (const [index, provider] of providers.entries()) {
      const label = `providers[${index}]`;
      if (!isRecord(provider)) {
        failures.push(`${label}: not an object`);
        continue;
      }
      for (const key of ["provider", "adapterName", "status", "missingSettings", "flows"]) {
        required(provider, key, failures, label);
      }
      if (
        typeof provider.status !== "string" ||
        !(CONFORMANCE_PROVIDER_STATUSES as readonly string[]).includes(provider.status)
      ) {
        failures.push(`${label}: invalid status ${String(provider.status)}`);
      }
      if (!Array.isArray(provider.missingSettings)) {
        failures.push(`${label}: missingSettings must be an array`);
      } else if (
        provider.missingSettings.length > CONFORMANCE_LIMITS.maxMissingSettingsPerProvider
      ) {
        failures.push(
          `${label}: missingSettings exceeds maxMissingSettingsPerProvider ${CONFORMANCE_LIMITS.maxMissingSettingsPerProvider} (observed ${provider.missingSettings.length})`,
        );
      }
      const summaries = provider.flows;
      if (!Array.isArray(summaries)) {
        failures.push(`${label}: flows must be an array`);
        continue;
      }
      for (const [flowIndex, summary] of summaries.entries()) {
        const flowLabel = `${label}.flows[${flowIndex}]`;
        if (!isRecord(summary)) {
          failures.push(`${flowLabel}: not an object`);
          continue;
        }
        if (Object.hasOwn(summary, "steps")) {
          failures.push(`${flowLabel}: provider flow entries must be summaries without steps`);
        }
        for (const key of Object.keys(summary)) {
          if (!["flowId", "name", "status"].includes(key)) {
            failures.push(`${flowLabel}: unexpected summary field ${key}`);
          }
        }
        for (const key of ["flowId", "name", "status"]) required(summary, key, failures, flowLabel);
        if (
          typeof summary.status !== "string" ||
          !(CONFORMANCE_FLOW_STATUSES as readonly string[]).includes(summary.status)
        ) {
          failures.push(`${flowLabel}: invalid status ${String(summary.status)}`);
        }
      }
    }
  }

  const nested = new Map<string, { readonly status: unknown }>();
  const flows = value.flows;
  if (!Array.isArray(flows)) {
    failures.push("artifact: flows must be an array");
  } else {
    if (flows.length > CONFORMANCE_LIMITS.maxFlows) {
      failures.push(
        `artifact: flows exceeds maxFlows ${CONFORMANCE_LIMITS.maxFlows} (observed ${flows.length})`,
      );
    }
    for (const [index, flow] of flows.entries()) {
      const label = `flows[${index}]`;
      if (!isRecord(flow)) {
        failures.push(`${label}: not an object`);
        continue;
      }
      for (const key of ["provider", "flowId", "name", "status", "steps"]) {
        required(flow, key, failures, label);
      }
      if (
        typeof flow.status !== "string" ||
        !(CONFORMANCE_FLOW_STATUSES as readonly string[]).includes(flow.status)
      ) {
        failures.push(`${label}: invalid status ${String(flow.status)}`);
      }
      if (!Array.isArray(flow.steps)) {
        failures.push(`${label}: steps must be an array`);
        continue;
      }
      if (flow.steps.length > CONFORMANCE_LIMITS.maxStepsPerFlow) {
        failures.push(
          `${label}: steps exceeds maxStepsPerFlow ${CONFORMANCE_LIMITS.maxStepsPerFlow} (observed ${flow.steps.length})`,
        );
      }
      for (const [stepIndex, step] of flow.steps.entries()) {
        const stepLabel = `${label}.steps[${stepIndex}]`;
        validateStep(
          step,
          stepLabel,
          ["provider", "flowId", "stepId", "operation", "status"],
          failures,
        );
        if (isRecord(step)) {
          const key = `${String(step.provider)}|${String(step.flowId)}|${String(step.stepId)}`;
          nested.set(key, { status: step.status });
        }
      }
    }
  }

  const steps = value.steps;
  if (!Array.isArray(steps)) {
    failures.push("artifact: steps must be an array");
  } else {
    if (steps.length > CONFORMANCE_LIMITS.maxTotalSteps) {
      failures.push(
        `artifact: steps exceeds maxTotalSteps ${CONFORMANCE_LIMITS.maxTotalSteps} (observed ${steps.length})`,
      );
    }
    for (const [index, step] of steps.entries()) {
      const label = `steps[${index}]`;
      validateStep(
        step,
        label,
        [
          "provider",
          "flowId",
          "stepId",
          "operation",
          "status",
          "skipReason",
          "skipKind",
          "assertionCount",
        ],
        failures,
      );
      if (isRecord(step)) {
        const key = `${String(step.provider)}|${String(step.flowId)}|${String(step.stepId)}`;
        const counterpart = nested.get(key);
        if (counterpart === undefined) {
          failures.push(`${label}: flat step ${key} has no nested counterpart`);
        } else if (counterpart.status !== step.status) {
          failures.push(`${label}: flat step ${key} status differs from the nested step`);
        }
      }
    }
  }

  const text = artifactText(value);
  if (text !== undefined) {
    const bytes = new TextEncoder().encode(text).length;
    if (bytes > CONFORMANCE_LIMITS.maxArtifactBytes) {
      failures.push(
        `artifact: exceeds maxArtifactBytes ${CONFORMANCE_LIMITS.maxArtifactBytes} (observed ${bytes})`,
      );
    }
    for (const shape of FORBIDDEN_SHAPES) {
      if (shape.pattern.test(text)) failures.push(`artifact: contains forbidden ${shape.detail}`);
    }
  }
  return failures;
};
