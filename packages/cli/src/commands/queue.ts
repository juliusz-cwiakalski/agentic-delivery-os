/**
 * The read-only `queue ready` command definition (GH-176 F-1, F-2, D4).
 *
 * `queue` is the command and `ready` is its subcommand positional. The handler
 * owns no stream writes and chooses no exit code. Grammar (including the
 * canonical-ref length and duplicate checks) runs before any source read; only
 * a clean grammar calls the shared {@link collectStatusFacts} composition once.
 *
 * The `queue` family is the M0 ready-set; lanes and dispatch arrive in M2-S1.
 */
import { evaluateQueueReady, renderQueueReadyHuman } from "@delivery-os/core";
import {
  type BrandIdentity,
  QUEUE_READY_MAX_CANDIDATES,
  QUEUE_READY_MAX_POSITIONALS,
  QUEUE_READY_MAX_WORK_ITEM_REF_CHARS,
  QUEUE_READY_WORK_ITEM_REF_PATTERN,
  type QueueReadyPayload,
} from "@delivery-os/core/contracts";
import type { CommandDefinition } from "../index.js";
import { collectStatusFacts, type StatusCommandRuntime } from "./status.js";

/** The queue command reuses the delivered status reader set verbatim. */
export type QueueReadyCommandRuntime = StatusCommandRuntime;

const REF_PARTS = /^([A-Za-z][A-Za-z0-9]*)-([0-9]+)$/;
const REF_SHAPE = new RegExp(QUEUE_READY_WORK_ITEM_REF_PATTERN);

const grammarRejection = (): { readonly error: Record<string, string> } => ({
  error: {
    kind: "input",
    code: "input.value.rejected",
    summary: "result=failed; reason=grammar",
  },
});

/** Uppercase the ASCII prefix and preserve the digits exactly as supplied. */
const canonicalize = (ref: string): string => {
  const match = REF_PARTS.exec(ref);
  if (match === null) return ref;
  const prefix = match[1] ?? "";
  const digits = match[2] ?? "";
  return `${prefix.toUpperCase()}-${digits}`;
};

type GrammarResult =
  | { readonly ok: true; readonly candidates: readonly string[] }
  | { readonly ok: false };

/** Validate and canonicalize the positional grammar without any source read. */
const parseGrammar = (positionals: readonly string[]): GrammarResult => {
  if (positionals[0] !== "ready") return { ok: false };
  const refs = positionals.slice(1);
  if (refs.length < 1 || refs.length > QUEUE_READY_MAX_CANDIDATES) return { ok: false };
  for (const ref of refs) {
    if (!REF_SHAPE.test(ref)) return { ok: false };
  }
  const canonical = refs.map(canonicalize);
  for (const ref of canonical) {
    if (ref.length > QUEUE_READY_MAX_WORK_ITEM_REF_CHARS) return { ok: false };
  }
  if (new Set(canonical).size !== canonical.length) return { ok: false };
  return { ok: true, candidates: canonical };
};

/** Build the `queue ready` command definition over injected readers. */
export const createQueueReadyCommandDefinition = (
  runtime: QueueReadyCommandRuntime,
): CommandDefinition => ({
  flags: [],
  positionals: { max: QUEUE_READY_MAX_POSITIONALS },
  humanText: (data: unknown, brand: BrandIdentity): string =>
    renderQueueReadyHuman(data as QueueReadyPayload, brand),
  handler: async (invocation) => {
    const grammar = parseGrammar(invocation.positionals);
    if (!grammar.ok) return grammarRejection();
    const facts = await collectStatusFacts(runtime);
    return { data: evaluateQueueReady({ ...facts, candidates: grammar.candidates }) };
  },
});
