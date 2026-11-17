/**
 * The `metrics [--ref <ref>] [--from <iso>] [--through <iso>] [--json]` command
 * definition (GH-299 F-1, DM-1, DM-8; DEC-12).
 *
 * Grammar only: the handler owns the value validation before any read — a
 * malformed ref, a lone or malformed window bound, or a missing value is
 * `input.value.rejected`; an undeclared flag or an unexpected positional is the
 * shared parser's `fallback.invocation`. The handler performs no stream write
 * and chooses no exit code. `--json` is a global flag the handler never
 * inspects. The family declares exactly one report invocation and no verbs.
 */
import { renderMetricsHuman } from "@delivery-os/core";
import {
  type BrandIdentity,
  METRICS_FLAGS,
  METRICS_REF_FLAG,
  METRICS_WINDOW_FROM_FLAG,
  METRICS_WINDOW_THROUGH_FLAG,
  METRICS_WORK_ITEM_REF_PATTERN,
  type MetricsCommandRuntime,
  type MetricsReport,
  type MetricsReportRequest,
} from "@delivery-os/core/contracts";
import type { CommandDefinition } from "../index.js";

export type { MetricsCommandRuntime } from "@delivery-os/core/contracts";

const REF_PATTERN = new RegExp(METRICS_WORK_ITEM_REF_PATTERN);

const reject = (detail: string): { readonly error: unknown } => ({
  error: { kind: "input", code: "input.value.rejected", summary: `metrics: ${detail}` },
});

/** Build the metrics command definition over the injected runtime. */
export const createMetricsCommandDefinition = (
  runtime: MetricsCommandRuntime,
): CommandDefinition => ({
  flags: [...METRICS_FLAGS],
  // The handler owns value consumption so a missing value is the value
  // identity and an unexpected token is the grammar identity.
  positionals: { max: 8 },
  humanText: (data: unknown, brand: BrandIdentity): string | undefined =>
    renderMetricsHuman(data as MetricsReport, brand),
  handler: async (invocation) => {
    const tokens = invocation.argv;
    const request: { ref?: string; from?: string; through?: string } = {};
    for (let index = 1; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (token === undefined) continue;
      if (
        token !== METRICS_REF_FLAG &&
        token !== METRICS_WINDOW_FROM_FLAG &&
        token !== METRICS_WINDOW_THROUGH_FLAG
      ) {
        return {
          error: {
            kind: "fallback",
            code: "fallback.invocation",
            summary: `metrics: unexpected positional "${token}"`,
          },
        };
      }
      const value = tokens[index + 1];
      if (value === undefined || value.startsWith("--")) {
        return reject(`missing value for "${token}"`);
      }
      index += 1;
      if (token === METRICS_REF_FLAG) {
        if (!REF_PATTERN.test(value)) {
          return reject(`invalid ref "${value}"; expected the canonical uppercase shape`);
        }
        request.ref = value;
        continue;
      }
      if (token === METRICS_WINDOW_FROM_FLAG) {
        request.from = value;
        continue;
      }
      request.through = value;
    }
    if ((request.from === undefined) !== (request.through === undefined)) {
      return reject("--from and --through are jointly required or jointly omitted");
    }
    let resolvedRef = request.ref;
    if (resolvedRef === undefined) {
      const active = runtime.resolveActiveRef();
      if (active.ref === null) {
        return reject("no active change context; pass --ref <ref>");
      }
      resolvedRef = active.ref;
    }
    const reportRequest: MetricsReportRequest = {
      ref: resolvedRef,
      ...(request.from === undefined ? {} : { from: request.from }),
      ...(request.through === undefined ? {} : { through: request.through }),
    };
    const outcome = runtime.report(reportRequest);
    if (!outcome.ok) return { error: outcome.error };
    return { data: outcome.data };
  },
});
