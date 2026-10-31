/**
 * `verify` command — read-only ledger verification and exit taxonomy (GH-177 C-1).
 *
 * Grammar is validated before any read: the handler accepts exactly
 * `["change", <ref>]` and rejects anything else with `input.value.rejected`.
 * It then reads the pm-notes target, classifies the document (terminal findings
 * stop with no registry read), applies the presence-tolerant registry overlay,
 * and returns data or a classified error. It never writes a stream, never
 * chooses an exit code, and never mutates a target.
 */
import { classifyVerifyChange, classifyVerifyDocument } from "@delivery-os/core";
import type {
  PhaseTransitionRecord,
  PmNotesParseFailure,
  StateFailure,
} from "@delivery-os/core/contracts";
import type { CommandDefinition } from "../index.js";

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

/** Everything the verify surface reads; all I/O and state access is injected. */
export type VerifyCommandRuntime = {
  readonly readPmNotes: (changeRef: string) => VerifyPmNotesRead;
  readonly readRegistry: (changeRef: string) => VerifyRegistryRead;
};

type VerifyFailure = { readonly ok: false; readonly error: Record<string, unknown> };
type VerifySuccess = { readonly ok: true; readonly data: Record<string, unknown> };

const GRAMMAR_SUMMARY = "result=failed; variant=unknown; missing=-";

const failure = (
  kind: "input" | "lint" | "verify" | "state",
  code: string,
  summary: string,
): VerifyFailure => ({ ok: false, error: { kind, code, summary } });

/** Grammar runs before any runtime call (D4, AC-V14). */
const grammarRef = (positionals: readonly string[]): string | VerifyFailure => {
  if (positionals.length !== 2 || positionals[0] !== "change") {
    return failure("input", "input.value.rejected", GRAMMAR_SUMMARY);
  }
  const changeRef = positionals[1];
  if (changeRef === undefined || changeRef.length === 0) {
    return failure("input", "input.value.rejected", GRAMMAR_SUMMARY);
  }
  return changeRef;
};

const handlerFor =
  (runtime: VerifyCommandRuntime) =>
  ({ positionals }: { readonly positionals: readonly string[] }): VerifySuccess | VerifyFailure => {
    const grammar = grammarRef(positionals);
    if (typeof grammar !== "string") return grammar;
    const changeRef = grammar;

    const read = runtime.readPmNotes(changeRef);
    if (!read.ok && read.reason === "missing") {
      return failure("lint", "lint.target.missing", GRAMMAR_SUMMARY);
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

/**
 * Build the verify command definition. `positionals.max` is two so a third
 * positional is rejected by the parser (`fallback.invocation`) before the
 * handler; there are no command-specific flags.
 */
export const createVerifyCommandDefinition = (
  runtime: VerifyCommandRuntime,
): CommandDefinition => ({
  flags: [],
  positionals: { max: 2 },
  humanSuccess: true,
  handler: (invocation) => {
    const result = handlerFor(runtime)(invocation);
    return result.ok ? { data: result.data } : { error: result.error };
  },
});
