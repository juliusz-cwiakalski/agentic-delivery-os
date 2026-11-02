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
import {
  classifyVerifyChange,
  classifyVerifyDocument,
  renderVerifyGatesHuman,
} from "@delivery-os/core";
import type {
  PhaseTransitionRecord,
  PmNotesParseFailure,
  StateFailure,
  VerifyGatesReport,
} from "@delivery-os/core/contracts";
import type { CommandDefinition, CommandHandler } from "../index.js";
import { createVerifyGatesHandler, type VerifyGatesCommandRuntime } from "./verify-gates.js";

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
  /** The gates reads; absent means the `gates` subcommand is not composed. */
  readonly gates?: VerifyGatesCommandRuntime;
};

type VerifyFailure = { readonly ok: false; readonly error: Record<string, unknown> };
type VerifySuccess = { readonly ok: true; readonly data: Record<string, unknown> };

const GRAMMAR_SUMMARY = "result=failed; variant=unknown; missing=-";

const failure = (
  kind: "input" | "lint" | "verify" | "state",
  code: string,
  summary: string,
): VerifyFailure => ({ ok: false, error: { kind, code, summary } });

type VerifySubcommand = "change" | "gates";

type ParsedVerifyGrammar = {
  readonly subcommand: VerifySubcommand;
  readonly changeRef: string;
};

/** Grammar runs before any runtime call (D4, AC-V14, GH-178 AC-F1-1). */
const parseGrammar = (positionals: readonly string[]): ParsedVerifyGrammar | VerifyFailure => {
  const subcommand = positionals[0];
  const changeRef = positionals[1];
  if (
    positionals.length !== 2 ||
    (subcommand !== "change" && subcommand !== "gates") ||
    changeRef === undefined ||
    changeRef.length === 0
  ) {
    return failure("input", "input.value.rejected", GRAMMAR_SUMMARY);
  }
  return { subcommand, changeRef };
};

const changeHandler =
  (runtime: VerifyCommandRuntime) =>
  (changeRef: string): VerifySuccess | VerifyFailure => {
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

const gatesHandlerFor = (runtime: VerifyCommandRuntime): CommandHandler | undefined =>
  runtime.gates === undefined ? undefined : createVerifyGatesHandler(runtime.gates);

const isGatesReport = (data: unknown): data is VerifyGatesReport =>
  typeof data === "object" &&
  data !== null &&
  !Array.isArray(data) &&
  (data as { readonly target?: unknown }).target === "gates";

/**
 * Build the one verify command definition. `positionals.max` is two so a third
 * positional is rejected by the parser (`fallback.invocation`) before the
 * handler; there are no command-specific flags. The first positional dispatches
 * `change` or `gates` after grammar validation.
 */
export const createVerifyCommandDefinition = (runtime: VerifyCommandRuntime): CommandDefinition => {
  const gatesHandler = gatesHandlerFor(runtime);
  return {
    flags: [],
    positionals: { max: 2 },
    humanSuccess: true,
    humanText: (data, brand) =>
      isGatesReport(data) ? renderVerifyGatesHuman(data, brand) : undefined,
    handler: (invocation) => {
      const grammar = parseGrammar(invocation.positionals);
      if ("ok" in grammar && grammar.ok === false) {
        return { error: grammar.error };
      }
      if (!("changeRef" in grammar)) return grammar;
      if (grammar.subcommand === "gates") {
        return gatesHandler === undefined
          ? { error: failure("input", "input.value.rejected", GRAMMAR_SUMMARY).error }
          : gatesHandler(invocation);
      }
      const result = changeHandler(runtime)(grammar.changeRef);
      return result.ok ? { data: result.data } : { error: result.error };
    },
  };
};
