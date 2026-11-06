/**
 * The `verify-artifact` tool engine half (F-3, AC-F3-1, AC-F5-1).
 *
 * Mirrors the CLI `verify change` handler exactly: read the pm-notes target,
 * classify the document (terminal findings stop before any registry read),
 * apply the presence-tolerant registry overlay, and return the success data or
 * the identical classified failure. No write and no exit decision happens here.
 */

import type { VerifyChangeSuccessData } from "@delivery-os/core";
import { classifyVerifyChange, classifyVerifyDocument } from "@delivery-os/core";
import type {
  PhaseTransitionRecord,
  PmNotesParseFailure,
  StateFailure,
} from "@delivery-os/core/contracts";
import { failureFromValue, type McpToolResult } from "../output/payload.js";

/** A pm-notes target read at the edge: values, absence, or a safe parse failure. */
export type VerifyPmNotesRead =
  | { readonly ok: true; readonly file: string; readonly text: string; readonly value: unknown }
  | { readonly ok: false; readonly reason: "missing" }
  | {
      readonly ok: false;
      readonly reason: "malformed";
      readonly file: string;
      readonly parseFailure: PmNotesParseFailure;
    };

/** A presence-tolerant verified registry read: evidence, or a state failure. */
export type VerifyRegistryRead =
  | {
      readonly ok: true;
      readonly present: boolean;
      readonly verifiedEmpty: boolean;
      readonly transitions: readonly PhaseTransitionRecord[];
      readonly recordCount: number;
    }
  | { readonly ok: false; readonly error: StateFailure };

/** Everything the verify-artifact tool reads; all I/O is injected. */
export type VerifyArtifactToolRuntime = {
  readonly readPmNotes: (changeRef: string) => VerifyPmNotesRead;
  readonly readRegistry: (changeRef: string) => VerifyRegistryRead;
};

/** The CLI grammar-rejection summary analogue (mirror parity). */
const GRAMMAR_REJECTION_SUMMARY = "result=failed; variant=unknown; missing=-";

const failure = (kind: "input" | "lint" | "verify" | "state", code: string, summary: string) =>
  failureFromValue({ kind, code, summary });

/**
 * Run one `verify-artifact` tool call for `changeRef`.
 *
 * Grammar is validated once at the toolset boundary before this handler runs,
 * so a whitespace-only ref reaches the engine exactly as it does through the
 * CLI (the engine resolves it to a classified failure).
 */
export const runVerifyArtifactTool = (
  runtime: VerifyArtifactToolRuntime,
  changeRef: string,
): McpToolResult<VerifyChangeSuccessData> => {
  const read = runtime.readPmNotes(changeRef);
  if (!read.ok && read.reason === "missing") {
    return failure("lint", "lint.target.missing", GRAMMAR_REJECTION_SUMMARY);
  }
  const documentInput = read.ok
    ? { ok: true as const, value: read.value }
    : { ok: false as const, parseFailure: read.parseFailure };
  const document = classifyVerifyDocument(documentInput);
  if (!document.ok) return failure(document.kind, document.code, document.summary);

  const registry = runtime.readRegistry(changeRef);
  const verdict = classifyVerifyChange({ changeRef, document, registry });
  if (!verdict.ok) return failure(verdict.kind, verdict.code, verdict.summary);
  return { ok: true, data: verdict.data };
};
