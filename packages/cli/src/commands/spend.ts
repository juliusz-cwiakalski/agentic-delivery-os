/**
 * The `spend [--ref <ref>] [--phase <phase>] [--amplification] [--json]`
 * command definition (GH-236 F-6, PIN-11; DEC-6, DEC-9).
 *
 * The handler owns the value grammar before any read: a malformed ref shape, an
 * out-of-vocabulary phase, a missing value, or an unexpected positional is
 * `input.value.rejected`; an undeclared flag is the shared parser's
 * `fallback.invocation`. The handler performs no stream write and chooses no
 * exit code. `--json` is a global flag the handler never inspects.
 */
import { renderSpendHuman } from "@delivery-os/core";
import {
  type BrandIdentity,
  CANONICAL_PHASE_IDS,
  type PmNotesPhaseId,
  SPEND_FLAGS,
  SPEND_HUMAN_AMPLIFICATION_FLAG,
  SPEND_WORK_ITEM_REF_PATTERN,
  type SpendCommandRuntime,
  type SpendReport,
  type SpendSelection,
} from "@delivery-os/core/contracts";
import type { CommandDefinition } from "../index.js";

export type { SpendCommandRuntime } from "@delivery-os/core/contracts";

const REF_PATTERN = new RegExp(SPEND_WORK_ITEM_REF_PATTERN);
const CANONICAL = new Set<string>(CANONICAL_PHASE_IDS);

/** The human-emphasis hint channel: keyed on the returned data object only. */
const HUMAN_AMPLIFICATION: unique symbol = Symbol("spend human amplification hint");
type HumanAnnotatedReport = SpendReport & { readonly [HUMAN_AMPLIFICATION]?: boolean };

const isCanonicalPhase = (value: string): value is PmNotesPhaseId => CANONICAL.has(value);

const reject = (detail: string): { readonly error: unknown } => ({
  error: { kind: "input", code: "input.value.rejected", summary: `spend: ${detail}` },
});

/** The selection summary the classified absence names. */
const selectionText = (selection: SpendSelection): string =>
  selection.phase === undefined
    ? `ref ${selection.workItemRef}`
    : `ref ${selection.workItemRef}, phase ${selection.phase}`;

const renderFailure = (error: unknown, brand: BrandIdentity): string | undefined => {
  if (typeof error !== "object" || error === null) return undefined;
  const value = error as {
    readonly kind?: unknown;
    readonly code?: unknown;
    readonly summary?: unknown;
    readonly location?: { readonly path?: unknown; readonly record?: unknown };
  };
  if (value.kind === "state" && typeof value.code === "string") {
    const path = typeof value.location?.path === "string" ? value.location.path : "state store";
    const position =
      typeof value.location?.record === "number" ? ` record ${String(value.location.record)}` : "";
    return `${brand.binaryName}: ${value.code} at ${path}${position}\n`;
  }
  if (value.kind === "spend" && typeof value.code === "string") {
    const summary = typeof value.summary === "string" ? value.summary : undefined;
    return summary === undefined ? undefined : `${summary}\n`;
  }
  return undefined;
};

/** Build the spend command definition over the injected runtime. */
export const createSpendCommandDefinition = (runtime: SpendCommandRuntime): CommandDefinition => ({
  flags: [...SPEND_FLAGS],
  positionals: { max: 8 },
  humanText: (data: unknown, brand: BrandIdentity): string | undefined => {
    const report = data as HumanAnnotatedReport;
    return renderSpendHuman(report, {
      brand,
      amplification: report[HUMAN_AMPLIFICATION] === true,
    });
  },
  humanFailureText: (error: unknown, brand: BrandIdentity): string | undefined =>
    renderFailure(error, brand),
  handler: async (invocation) => {
    const tokens = invocation.argv;
    let ref: string | undefined;
    let phase: PmNotesPhaseId | undefined;
    let amplification = false;
    for (let index = 1; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (token === undefined) continue;
      if (token === SPEND_HUMAN_AMPLIFICATION_FLAG) {
        amplification = true;
        continue;
      }
      if (token !== "--ref" && token !== "--phase") {
        return reject(`unexpected positional "${token}"`);
      }
      const value = tokens[index + 1];
      if (value === undefined || value.startsWith("--")) {
        return reject(`missing value for "${token}"`);
      }
      index += 1;
      if (token === "--ref") {
        if (!REF_PATTERN.test(value)) {
          return reject(`invalid ref "${value}"; expected the canonical uppercase shape`);
        }
        ref = value;
        continue;
      }
      if (!isCanonicalPhase(value)) {
        return reject(
          `unknown phase "${value}"; declared phases: ${CANONICAL_PHASE_IDS.join(", ")}`,
        );
      }
      phase = value;
    }
    let resolvedRef = ref;
    if (resolvedRef === undefined) {
      const active = runtime.resolveActiveRef();
      if (active.ref === null) {
        return reject("no active change context; pass --ref <ref>");
      }
      resolvedRef = active.ref;
    }
    const selection: SpendSelection =
      phase === undefined ? { workItemRef: resolvedRef } : { workItemRef: resolvedRef, phase };
    const outcome = runtime.report(selection);
    if (!outcome.ok) {
      const error = outcome.error;
      if (error.kind === "spend") {
        return {
          error: {
            kind: "spend",
            code: error.code,
            summary: `spend: no captured harness telemetry for ${selectionText(selection)}`,
          },
        };
      }
      return { error };
    }
    const data: HumanAnnotatedReport = {
      ...outcome.data,
      [HUMAN_AMPLIFICATION]: amplification,
    };
    return outcome.warnings === undefined ? { data } : { data, warnings: outcome.warnings };
  },
});
