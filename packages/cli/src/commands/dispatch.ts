/**
 * The `dispatch` command family (GH-239 F-1, F-5, F-6; GH-289 F-1, F-9;
 * DM-5, DM-6).
 *
 * Grammar runs before any runtime call. The handler owns the `attempts`
 * subfamily's tail grammar — canonical reference shape, canonical decimal limit
 * bounded to 1..100, an unknown option, and an unexpected positional — so each
 * refusal is `input.value.rejected` before any runtime call and therefore
 * before any store read. Because the definition opts the family out of the
 * shared parser's unknown-flag branch, a handler guard keeps the four delivered
 * forms' unknown-flag refusal at `fallback.invocation`. The handler returns data
 * or a classified failure and never chooses an exit literal.
 */

import type { DispatchHandoverData, DispatchRunResult } from "@delivery-os/core";
import {
  ATTEMPTS_LIMIT_PATTERN,
  ATTEMPTS_MAX_LIMIT,
  ATTEMPTS_MIN_LIMIT,
  type CommandFailureHarnessDetail,
  DELIVERY_RESULT_TAXONOMY,
  type DeliveryResultToken,
  type DispatchAttemptsData,
  type DispatchDeliveringData,
  type DispatchEnvelopeData,
  type DispatchResolveData,
  type DispatchStatusData,
  type DispatchSummaryData,
  type ProjectionClass,
} from "@delivery-os/core/contracts";
import type { CommandDefinition, CommandInvocation } from "../index.js";
import {
  renderDispatchAttemptsText,
  renderDispatchDeliveringText,
  renderDispatchHandoverText,
  renderDispatchResolveText,
  renderDispatchStatusText,
  renderDispatchSummaryText,
  renderDispatchText,
  renderDispatchVerboseText,
} from "../output/dispatch-text.js";

/** The one-shot run surface; the edge wires the real ports behind it. */
export type DispatchRunRuntime = {
  readonly run: (input: {
    readonly ref: string;
    readonly harness?: string;
    readonly resumePrompt?: string;
  }) => Promise<DispatchRunResult>;
};

/** A classified command-level failure. */
export type DispatchRuntimeFailure = {
  readonly kind: string;
  readonly code: string;
  readonly summary?: string;
  /** The live lease's holder on a `queue.single-flight` refusal (TDR-0027). */
  readonly holder?: string;
  /** The eligibility list on a `provider.profile.unavailable` nomination refusal (GH-294). */
  readonly eligibility?: readonly string[];
  /** The narrow trusted-refusal marker; set only for `config.credential.missing`. */
  readonly trustedRefusal?: true;
  /**
   * The four pre-session harness facts (TDR-0041); populated only on the four
   * harness refusals and never on the reused `provider.profile.invalid`
   * unassigned-agent refusal, whose facts ride the bounded summary.
   */
  readonly harness?: CommandFailureHarnessDetail;
};

/**
 * Project a runtime failure to the returned failure shape. The single-flight
 * holder is a record-shaped envelope-root `detail` member (TDR-0027), not an
 * error-object field; the nomination refusal's eligibility list rides the same
 * record-shaped detail (GH-294, exit 2 renders the list). Every other failure
 * is returned as classified.
 */
const runtimeFailureOf = (
  error: DispatchRuntimeFailure,
): { readonly error: DispatchRuntimeFailure | Record<string, unknown> } => {
  if (error.harness !== undefined) {
    return {
      error: {
        kind: error.kind,
        code: error.code,
        ...(error.summary === undefined ? {} : { summary: error.summary }),
        detail: { harness: { ...error.harness } },
      },
    };
  }
  if (error.holder !== undefined) {
    return {
      error: {
        kind: error.kind,
        code: error.code,
        ...(error.summary === undefined ? {} : { summary: error.summary }),
        detail: { holder: error.holder },
      },
    };
  }
  if (error.eligibility !== undefined) {
    return {
      error: {
        kind: error.kind,
        code: error.code,
        ...(error.summary === undefined ? {} : { summary: error.summary }),
        detail: { eligibility: [...error.eligibility] },
      },
    };
  }
  return { error };
};

/** The summary surface; phase 6 composes it. */
export type DispatchSummaryRuntime = {
  readonly summarize: (
    repo: string,
  ) => Promise<
    | { readonly ok: true; readonly data: DispatchSummaryData }
    | { readonly ok: false; readonly error: DispatchRuntimeFailure }
  >;
};

/** The divergence-resolution surface; phase 6 composes it. */
export type DispatchResolveRuntime = {
  readonly resolve: (input: {
    readonly divergenceId: string;
    readonly note: string;
  }) => Promise<
    | { readonly ok: true; readonly data: DispatchResolveData }
    | { readonly ok: false; readonly error: DispatchRuntimeFailure }
  >;
};

/** The handover/reversal surface; phase 6 composes it. */
export type DispatchHandoverRuntime = {
  readonly handover: (input: {
    readonly repo: string;
    readonly revert: boolean;
  }) => Promise<
    | { readonly ok: true; readonly data: DispatchHandoverData }
    | { readonly ok: false; readonly error: DispatchRuntimeFailure }
  >;
};

/** The attempt-history read surface (GH-289 F-1); production composes it. */
export type DispatchAttemptsRuntime = {
  readonly read: (input: {
    readonly ref?: string;
    readonly limit?: number;
  }) => Promise<
    | { readonly ok: true; readonly data: DispatchAttemptsData }
    | { readonly ok: false; readonly error: DispatchRuntimeFailure }
  >;
};

/** The per-ref lane-view read surface (GH-354 API-1); composition supplies it. */
export type DispatchStatusRuntime = {
  readonly read: (input: {
    readonly ref: string;
  }) => Promise<
    | { readonly ok: true; readonly data: DispatchStatusData }
    | { readonly ok: false; readonly error: DispatchRuntimeFailure }
  >;
};

/** The delivering-fold read surface (GH-354 API-3); both admissible forms. */
export type DispatchDeliveringRuntime = {
  readonly read: (input: {
    readonly ref?: string;
  }) => Promise<
    | { readonly ok: true; readonly data: DispatchDeliveringData }
    | { readonly ok: false; readonly error: DispatchRuntimeFailure }
  >;
};

/** Everything the dispatch command family can be composed with. */
export type DispatchCommandRuntime = {
  readonly run: DispatchRunRuntime;
  readonly summary?: DispatchSummaryRuntime;
  readonly resolve?: DispatchResolveRuntime;
  readonly handover?: DispatchHandoverRuntime;
  readonly attempts?: DispatchAttemptsRuntime;
  readonly status?: DispatchStatusRuntime;
  readonly delivering?: DispatchDeliveringRuntime;
  /**
   * The registered credential set the composition root already holds (the same
   * value `blockers` and `steer` receive); the message composition redacts with
   * it BEFORE bounding (GH-354 AC-F4-7, NFR-11).
   */
  readonly secrets?: readonly string[];
};

const REF_PATTERN = /^[A-Z]+-\d+$/;
const LIMIT_PATTERN = new RegExp(`^${ATTEMPTS_LIMIT_PATTERN}$`);

const failure = (code: string, summary?: string) => ({
  ok: false as const,
  error: { kind: "input", code, ...(summary === undefined ? {} : { summary }) },
});

const fallbackInvocation = (summary: string) => ({
  ok: false as const,
  error: { kind: "fallback", code: "fallback.invocation", summary },
});

/** A local short alias: keeps the parameter type recognizable. */
type DispatchToken = DeliveryResultToken;

const projectionOf = (value: DispatchToken): ProjectionClass => {
  const row = DELIVERY_RESULT_TAXONOMY.find((entry) => entry.token === value);
  if (row === undefined) throw new Error("delivery-result token is not in the taxonomy");
  return row.projectionClass;
};

const isResolveData = (data: unknown): data is DispatchResolveData =>
  typeof data === "object" &&
  data !== null &&
  (data as { readonly mode?: unknown }).mode === "local-evidence" &&
  typeof (data as { readonly divergenceId?: unknown }).divergenceId === "string";

const isSummaryData = (data: unknown): data is DispatchSummaryData =>
  typeof data === "object" &&
  data !== null &&
  (data as { readonly repository?: unknown }).repository !== undefined &&
  (data as { readonly verdict?: unknown }).verdict !== undefined &&
  typeof (data as { readonly eligibility?: unknown }).eligibility === "boolean" &&
  (data as { readonly coverage?: unknown }).coverage !== undefined;

/** An attempts payload is discriminated by its single declared array key. */
const isAttemptsData = (data: unknown): data is DispatchAttemptsData =>
  typeof data === "object" &&
  data !== null &&
  Array.isArray((data as { readonly attempts?: unknown }).attempts) &&
  typeof (data as { readonly hasMore?: unknown }).hasMore === "boolean" &&
  (data as { readonly refSource?: unknown }).refSource !== undefined;

/** The `query` discriminator of an operator payload, when there is one. */
const queryOf = (data: unknown): string | undefined => {
  if (typeof data !== "object" || data === null) return undefined;
  const query = (data as { readonly query?: unknown }).query;
  return typeof query === "string" ? query : undefined;
};

const isStatusData = (data: unknown): data is DispatchStatusData => queryOf(data) === "status";

const isDeliveringData = (data: unknown): data is DispatchDeliveringData =>
  queryOf(data) === "is-delivering";

/** The parsed `attempts` request, or the grammar's refusal summary. */
type AttemptsRequest =
  | { readonly ok: true; readonly ref?: string; readonly limit?: number }
  | { readonly ok: false; readonly summary: string };

const parseAttemptsRequest = (tokens: readonly string[]): AttemptsRequest => {
  let ref: string | undefined;
  let limit: number | undefined;
  for (let index = 2; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined) continue;
    if (!token.startsWith("--")) {
      return {
        ok: false,
        summary: `unexpected argument "${token}"; dispatch attempts accepts --ref <ref> and --limit <n>`,
      };
    }
    if (token !== "--ref" && token !== "--limit") {
      return {
        ok: false,
        summary: `unknown option "${token}"; dispatch attempts accepts --ref <ref> and --limit <n>`,
      };
    }
    const value = tokens[index + 1];
    if (value === undefined || value.startsWith("--")) {
      return { ok: false, summary: `missing value for "${token}"` };
    }
    index += 1;
    if (token === "--ref") {
      if (!REF_PATTERN.test(value)) {
        return {
          ok: false,
          summary: `"${value}" is not a canonical work item reference (expected letters-dash-digits, e.g. GH-289)`,
        };
      }
      ref = value;
      continue;
    }
    const parsed = LIMIT_PATTERN.test(value) ? Number(value) : Number.NaN;
    if (!Number.isInteger(parsed) || parsed < ATTEMPTS_MIN_LIMIT || parsed > ATTEMPTS_MAX_LIMIT) {
      return {
        ok: false,
        summary: `"${value}" is not a canonical decimal limit in ${ATTEMPTS_MIN_LIMIT}..${ATTEMPTS_MAX_LIMIT} (no sign, whitespace, or leading zero)`,
      };
    }
    limit = parsed;
  }
  return {
    ok: true,
    ...(ref === undefined ? {} : { ref }),
    ...(limit === undefined ? {} : { limit }),
  };
};

/** The declared flag vocabulary of the four delivered forms, and of `attempts`. */
const DELIVERED_FLAGS = ["--revert"] as const;
const DELIVERED_VALUE_FLAGS = ["--harness", "--resume-prompt", "--repo", "--note"] as const;

/**
 * The operator forms, and the per-form flag vocabulary.
 *
 * The shared parser opts the whole family out of the unknown-flag branch, so the
 * handler owns the identity. A flag declared for one form is NOT admitted on
 * another: `--tail` belongs to `log` only, and the delivered forms keep the
 * definition-wide vocabulary they already had.
 */
const OPERATOR_FORMS = ["status", "log", "is-delivering", "last-message"] as const;
type OperatorForm = (typeof OPERATOR_FORMS)[number];

const OPERATOR_FLAGS: Readonly<Record<OperatorForm, readonly string[]>> = {
  status: [],
  log: ["--tail"],
  "is-delivering": [],
  "last-message": [],
};

const isOperatorForm = (value: string | undefined): value is OperatorForm =>
  value !== undefined && (OPERATOR_FORMS as readonly string[]).includes(value);

/** The canonical reference shape every operator form shares (API-5). */
const isCanonicalRef = (value: string | undefined): value is string =>
  value !== undefined && REF_PATTERN.test(value);

/** The parsed operator request, or the grammar's refusal summary. */
type OperatorRequest =
  | { readonly ok: true; readonly ref: string | undefined }
  | { readonly ok: false; readonly summary: string };

/**
 * The operator family's grammar: the canonical `[A-Z]+-\d+` reference, the
 * ref-less `is-delivering` form, and no third positional. Every refusal is
 * decided here, before any runtime call (API-5, AC-F5-2).
 */
const parseOperatorRequest = (
  form: OperatorForm,
  positionals: readonly string[],
): OperatorRequest => {
  const [, ref, extra] = positionals;
  if (extra !== undefined) {
    return {
      ok: false,
      summary: `unexpected argument "${extra}"; dispatch ${form} takes at most one work item reference`,
    };
  }
  if (form === "is-delivering" && ref === undefined) return { ok: true, ref: undefined };
  if (ref === undefined) {
    return { ok: false, summary: `missing work item reference for "dispatch ${form}"` };
  }
  if (!isCanonicalRef(ref)) {
    return {
      ok: false,
      summary: `"${ref}" is not a canonical work item reference (expected letters-dash-digits, e.g. GH-354)`,
    };
  }
  return { ok: true, ref };
};

/** Build the one dispatch command definition over the injected runtime. */
export const createDispatchCommandDefinition = (
  runtime: DispatchCommandRuntime,
): CommandDefinition => {
  const definition: CommandDefinition = {
    flags: [...DELIVERED_FLAGS],
    requiresValue: [...DELIVERED_VALUE_FLAGS],
    positionals: { max: 3 },
    acceptsAnyFlag: true,
    humanSuccess: true,
    exitProjection: (data) => {
      if (isSummaryData(data)) return "success";
      if (queryOf(data) === "status") return "success";
      if (isDeliveringData(data)) return data.delivering ? "success" : "user-validation";
      const handover = data as {
        readonly verdict?: unknown;
        readonly recorded?: unknown;
      };
      if (
        handover.verdict !== undefined &&
        handover.verdict !== "eligible" &&
        handover.recorded !== true
      ) {
        return "user-validation";
      }
      const result = (data as { readonly result?: DeliveryResultToken }).result;
      return result === undefined ? "success" : projectionOf(result);
    },
    humanText: (data, _brand, context) => {
      if (isAttemptsData(data)) return renderDispatchAttemptsText(data);
      if (isStatusData(data)) return renderDispatchStatusText(data);
      if (isDeliveringData(data)) return renderDispatchDeliveringText(data);
      if (isSummaryData(data)) return renderDispatchSummaryText(data);
      if (isResolveData(data)) return renderDispatchResolveText(data);
      const envelope = data as Partial<DispatchEnvelopeData>;
      if (envelope.result !== undefined && envelope.lastMessage !== undefined) {
        return context?.verbose === true
          ? renderDispatchVerboseText(envelope as DispatchEnvelopeData)
          : renderDispatchText(envelope as DispatchEnvelopeData);
      }
      const handover = data as { readonly operation?: unknown; readonly recorded?: unknown };
      if (handover.operation === "authoritative" || handover.operation === "dual-run") {
        return renderDispatchHandoverText({
          repository: String((data as { readonly repository?: unknown }).repository ?? ""),
          operation: handover.operation,
          recorded: handover.recorded === true,
          noop: (data as { readonly noop?: unknown }).noop === true,
        });
      }
      return undefined;
    },
    handler: async ({ positionals, flags, argv }: CommandInvocation) => {
      const [first, second, third] = positionals;
      const isAttempts = first === "attempts";

      // The definition accepts any flag so the attempts grammar (not the parser)
      // answers its refusals. Every other form therefore needs this guard to keep
      // the delivered `fallback.invocation` identity for an undeclared flag. The
      // allowed set derives from this definition, so a flag added to the
      // vocabulary can never be refused here by drift.
      if (!isAttempts) {
        const operator = isOperatorForm(first);
        const delivered = new Set(
          operator
            ? [...OPERATOR_FLAGS[first as OperatorForm]]
            : [...(definition.flags ?? []), ...(definition.requiresValue ?? [])],
        );
        const undeclared = argv.find((token) => token.startsWith("--") && !delivered.has(token));
        if (undeclared !== undefined) {
          return fallbackInvocation(`unknown flag "${undeclared}"`);
        }
      }

      if (isOperatorForm(first)) {
        const request = parseOperatorRequest(first, positionals);
        if (!request.ok) return failure("input.value.rejected", request.summary);

        if (first === "status") {
          if (runtime.status === undefined || request.ref === undefined) {
            return failure("input.value.rejected");
          }
          const result = await runtime.status.read({ ref: request.ref });
          return result.ok ? { data: result.data } : { error: result.error };
        }

        // `is-delivering` keeps both admissible forms: per-ref and repository-wide.
        if (first === "is-delivering") {
          if (runtime.delivering === undefined) return failure("input.value.rejected");
          const result =
            request.ref === undefined
              ? await runtime.delivering.read({})
              : await runtime.delivering.read({ ref: request.ref });
          return result.ok ? { data: result.data } : { error: result.error };
        }

        // A query surface this composition does not supply refuses rather than
        // answering an empty success (DEC-7, AC-F5-3).
        return failure("input.value.rejected");
      }

      if (isAttempts) {
        if (runtime.attempts === undefined) return failure("input.value.rejected");
        const request = parseAttemptsRequest(argv);
        if (!request.ok) return failure("input.value.rejected", request.summary);
        const result = await runtime.attempts.read({
          ...(request.ref === undefined ? {} : { ref: request.ref }),
          ...(request.limit === undefined ? {} : { limit: request.limit }),
        });
        return result.ok ? { data: result.data } : { error: result.error };
      }

      const repoFlag = typeof flags["--repo"] === "string" ? flags["--repo"] : undefined;
      const noteFlag = typeof flags["--note"] === "string" ? flags["--note"] : undefined;

      if (first === "dual-run") {
        if (second === "summary") {
          if (runtime.summary === undefined) return failure("input.value.rejected");
          if (repoFlag === undefined || repoFlag.length === 0) {
            return failure("input.value.rejected");
          }
          const result = await runtime.summary.summarize(repoFlag);
          return result.ok ? { data: result.data } : { error: result.error };
        }
        if (second === "resolve") {
          if (runtime.resolve === undefined) return failure("input.value.rejected");
          if (third === undefined || third.length === 0 || noteFlag === undefined) {
            return failure("input.value.rejected");
          }
          const result = await runtime.resolve.resolve({ divergenceId: third, note: noteFlag });
          return result.ok ? { data: result.data } : { error: result.error };
        }
        return failure("input.value.rejected");
      }

      if (first === "handover") {
        if (runtime.handover === undefined) return failure("input.value.rejected");
        const repo = second ?? repoFlag;
        if (repo === undefined || repo.length === 0) return failure("input.value.rejected");
        const result = await runtime.handover.handover({
          repo,
          revert: flags["--revert"] === true,
        });
        return result.ok ? { data: result.data } : { error: result.error };
      }

      if (first === undefined || second !== undefined || !REF_PATTERN.test(first)) {
        return failure("input.value.rejected");
      }
      const harness = typeof flags["--harness"] === "string" ? flags["--harness"] : undefined;
      const resumePrompt =
        typeof flags["--resume-prompt"] === "string" ? flags["--resume-prompt"] : undefined;
      const result = await runtime.run.run({
        ref: first,
        ...(harness === undefined ? {} : { harness }),
        ...(resumePrompt === undefined ? {} : { resumePrompt }),
      });
      return result.ok ? { data: result.data } : runtimeFailureOf(result.error);
    },
  };
  return definition;
};
