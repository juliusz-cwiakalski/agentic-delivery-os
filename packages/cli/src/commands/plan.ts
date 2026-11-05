/**
 * The `plan` command family (GH-226 F-8, F-9, F-10; DEC-1).
 *
 * `plan validate <ref>`, `plan diff <ref> [--against <base>]`, and
 * `plan overlap <refA> <refB>`. Handlers take injected runtimes, return data or
 * a classified failure, never write streams, and never choose an exit literal;
 * the definition supplies the verdict-to-exit projection.
 */
import {
  computePlanDiff,
  computePlanOverlap,
  planDocumentFromValidateData,
  validatePlan,
} from "@delivery-os/core";
import {
  PLAN_DEFAULT_DIFF_BASE,
  type PlanArtifactRead,
  type PlanDiffData,
  type PlanDiffPort,
  type PlanOverlapData,
  type PlanReadPort,
  type PlanValidateData,
  type PlanYamlParser,
} from "@delivery-os/core/contracts";
import type { CommandDefinition, CommandInvocation } from "../index.js";
import {
  serializePlanDiffText,
  serializePlanOverlapText,
  serializePlanValidateText,
} from "../output/plan-text.js";

/** Everything the plan family reads; all I/O is injected. */
export type PlanCommandRuntime = {
  readonly readPlan: PlanReadPort;
  readonly readDiff: PlanDiffPort;
  readonly parseYaml: PlanYamlParser;
};

type HandlerResult = { readonly data: unknown } | { readonly error: Record<string, unknown> };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isValidateData = (value: unknown): value is PlanValidateData =>
  isRecord(value) && typeof value.readyForDevelopment === "boolean" && Array.isArray(value.errors);

const isOverlapData = (value: unknown): value is PlanOverlapData =>
  isRecord(value) && Array.isArray(value.overlappingPaths) && typeof value.verdict === "string";

const isDiffData = (value: unknown): value is PlanDiffData =>
  isRecord(value) && Array.isArray(value.entries) && typeof value.against === "string";

const usage = (summary: string): HandlerResult => ({
  error: { kind: "input", code: "input.value.rejected", summary },
});

const planFailure = (code: string, summary: string): HandlerResult => ({
  error: { kind: "plan", code, summary },
});

const validated = (
  ref: string,
  read: PlanArtifactRead,
  runtime: PlanCommandRuntime,
): { readonly data: PlanValidateData } | { readonly error: Record<string, unknown> } => {
  const data = validatePlan({ workItemRef: ref, read, parseYaml: runtime.parseYaml });
  if (data.verdict !== "valid") {
    const code = data.errors[0]?.code ?? "plan.schema.invalid";
    const first = data.errors[0];
    return {
      error: {
        kind: "plan",
        code,
        summary:
          first === undefined
            ? `plan ${artifactRef(read)} does not validate`
            : `plan ${artifactRef(read)} does not validate: ${first.field}`,
      },
    };
  }
  return { data };
};

const artifactRef = (read: PlanArtifactRead): string =>
  read.ok ? read.artifact.path : (read.path ?? `chg-${read.workItemRef}-plan.yaml`);

const validateHandler = (
  runtime: PlanCommandRuntime,
  positionals: readonly string[],
): HandlerResult => {
  if (positionals.length !== 2) return usage("usage: plan validate <ref>");
  const ref = positionals[1];
  if (ref === undefined) return usage("usage: plan validate <ref>");
  const read = runtime.readPlan(ref);
  return {
    data: validatePlan({ workItemRef: ref, read, parseYaml: runtime.parseYaml }),
  };
};

const overlapHandler = (
  runtime: PlanCommandRuntime,
  positionals: readonly string[],
): HandlerResult => {
  if (positionals.length !== 3) return usage("usage: plan overlap <refA> <refB>");
  const refA = positionals[1];
  const refB = positionals[2];
  if (refA === undefined || refB === undefined) return usage("usage: plan overlap <refA> <refB>");
  const readA = runtime.readPlan(refA);
  const readB = runtime.readPlan(refB);
  const validatedA = validated(refA, readA, runtime);
  if ("error" in validatedA) return validatedA;
  const validatedB = validated(refB, readB, runtime);
  if ("error" in validatedB) return validatedB;
  const planA = planDocumentFromValidateData(validatedA.data);
  const planB = planDocumentFromValidateData(validatedB.data);
  if (planA === undefined || planB === undefined) {
    return planFailure("plan.schema.invalid", "a plan did not validate");
  }
  return { data: computePlanOverlap({ refA, planA, refB, planB }) };
};

const diffHandler = (
  runtime: PlanCommandRuntime,
  invocation: CommandInvocation,
): HandlerResult => {
  const { positionals, flags } = invocation;
  if (positionals.length !== 2) return usage("usage: plan diff <ref> [--against <base>]");
  const ref = positionals[1];
  if (ref === undefined) return usage("usage: plan diff <ref> [--against <base>]");
  const against = typeof flags["--against"] === "string" ? flags["--against"] : PLAN_DEFAULT_DIFF_BASE;
  const read = runtime.readPlan(ref);
  const verdict = validatePlan({ workItemRef: ref, read, parseYaml: runtime.parseYaml });
  const document = planDocumentFromValidateData(verdict);
  if (document === undefined) {
    const code = verdict.errors[0]?.code ?? "plan.schema.invalid";
    return planFailure(code, `plan ${artifactRef(read)} does not validate`);
  }
  const diff = runtime.readDiff(ref, against);
  if (!diff.ok) {
    return {
      error: {
        kind: "input",
        code: "input.value.rejected",
        summary: `repository diff for ${ref} could not be read`,
      },
    };
  }
  return {
    data: computePlanDiff({
      workItemRef: ref,
      document,
      actualPaths: diff.paths,
      against,
    }),
  };
};

/** Build the plan command definition over injected readers. */
export const createPlanCommandDefinition = (runtime: PlanCommandRuntime): CommandDefinition => ({
  flags: ["--against"],
  requiresValue: ["--against"],
  positionals: { max: 3 },
  humanSuccess: true,
  exitProjection: (data) => {
    if (isValidateData(data)) {
      return data.verdict === "valid" && data.readyForDevelopment ? "success" : "user-validation";
    }
    if (isOverlapData(data)) {
      return data.verdict === "parallel" ? "success" : "user-validation";
    }
    if (isDiffData(data)) {
      return data.verdict === "within" ? "success" : "user-validation";
    }
    return "success";
  },
  humanText: (data) => {
    if (isValidateData(data)) return serializePlanValidateText(data);
    if (isOverlapData(data)) return serializePlanOverlapText(data);
    if (isDiffData(data)) return serializePlanDiffText(data);
    return undefined;
  },
  handler: (invocation) => {
    const subcommand = invocation.positionals[0];
    if (subcommand === "validate") return validateHandler(runtime, invocation.positionals);
    if (subcommand === "overlap") return overlapHandler(runtime, invocation.positionals);
    if (subcommand === "diff") return diffHandler(runtime, invocation);
    return usage("usage: plan validate|diff|overlap ...");
  },
});
