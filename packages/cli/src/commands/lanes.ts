/**
 * The `lanes list` / `lanes show <ref>` command (GH-237 F-10, F-11, DEC-7,
 * AC-F11-1, AC-F11-2, NFR-12).
 *
 * The handler owns no stream writes and chooses no exit code. `--watch` is not
 * in the accepted grammar, so an invocation carrying it is refused through the
 * delivered `fallback.invocation` containment at exit 1 and no stream is
 * representable. An unreadable queue store projects
 * `status.collector.lanes.unavailable` at exit 2, never a zero-lane view.
 */

import { canonicalQueueRef, renderLanesHuman, selectLane } from "@delivery-os/core";
import {
  QUEUE_LANES_SCHEMA_VERSION,
  QUEUE_MAX_REF_CHARS,
  type QueueLanesData,
} from "@delivery-os/core/contracts";
import type { CommandDefinition } from "../index.js";

/** One lane read: the bounded payload or a classified collector failure. */
export type LanesRuntimeRead =
  | { readonly ok: true; readonly data: QueueLanesData }
  | { readonly ok: false; readonly code: string; readonly summary?: string };

/** Everything the lanes handler reads, injected at the edge. */
export type LanesCommandRuntime = {
  readonly readLanes: () => LanesRuntimeRead;
  /** The additive live watch stream (GH-238 F-13); absent stays truthful. */
  readonly watch?: () => AsyncIterable<string>;
};

type Failure = {
  readonly error: {
    readonly kind: string;
    readonly code: string;
    readonly summary?: string;
    readonly remediationHint?: string;
  };
};

const failure = (kind: string, code: string, summary?: string): Failure => ({
  error: { kind, code, ...(summary === undefined ? {} : { summary }) },
});

const watchRefusal = (): Failure => ({
  error: {
    kind: "fallback",
    code: "fallback.invocation",
    summary: "result=refused; reason=watch-unsupported",
    remediationHint:
      "Live --watch streaming is provided by the resident daemon (M1-S18), which is not part of this one-shot release; rerun without --watch.",
  },
});

type Grammar =
  | { readonly ok: true; readonly mode: "list" }
  | { readonly ok: true; readonly mode: "show"; readonly ref: string }
  | { readonly ok: false };

const parseGrammar = (positionals: readonly string[]): Grammar => {
  const [subcommand, ref, ...extra] = positionals;
  if (extra.length > 0) return { ok: false };
  if (subcommand === "list") {
    return ref === undefined ? { ok: true, mode: "list" } : { ok: false };
  }
  if (subcommand === "show") {
    if (ref === undefined || ref.length > QUEUE_MAX_REF_CHARS) return { ok: false };
    const canonical = canonicalQueueRef(ref);
    return canonical === undefined ? { ok: false } : { ok: true, mode: "show", ref: canonical };
  }
  return { ok: false };
};

const oneLaneData = (data: QueueLanesData, ref: string): QueueLanesData => {
  const lane = selectLane(data, ref);
  return {
    ...data,
    lanes: lane === undefined ? [] : [lane],
    counts: {
      lanes: lane === undefined ? 0 : 1,
      delivering: lane?.state === "delivering" ? 1 : 0,
      idle: lane?.state === "idle-with-reason" ? 1 : 0,
      parked: lane?.state === "parked" ? 1 : 0,
      failed: lane?.state === "failed" ? 1 : 0,
    },
  };
};

/** Build the `lanes` command definition over an injected lane read. */
export const createLanesCommandDefinition = (runtime: LanesCommandRuntime): CommandDefinition => ({
  flags: ["--watch"],
  ...(runtime.watch === undefined
    ? {}
    : {
        stream: (invocation: { readonly flags: Readonly<Record<string, string | true>> }) =>
          invocation.flags["--watch"] !== undefined ? runtime.watch!() : (async function* () {})(),
      }),
  positionals: { max: 2 },
  humanText: (data: unknown): string => renderLanesHuman(data as QueueLanesData),
  handler: (invocation) => {
    if (invocation.flags["--watch"] !== undefined) {
      if (runtime.watch === undefined) return watchRefusal();
      const read = runtime.readLanes();
      if (!read.ok) return failure("status", read.code, read.summary);
      return { data: { watch: true, topic: "lanes" } };
    }
    const grammar = parseGrammar(invocation.positionals);
    if (!grammar.ok) {
      return failure("input", "input.value.rejected", "result=refused; reason=grammar");
    }
    const read = runtime.readLanes();
    if (!read.ok) return failure("status", read.code, read.summary);
    if (read.data.schemaVersion !== QUEUE_LANES_SCHEMA_VERSION) {
      return failure(
        "status",
        "status.collector.lanes.unavailable",
        "lane payload version mismatch",
      );
    }
    if (grammar.mode === "list") return { data: read.data };
    const selected = oneLaneData(read.data, grammar.ref);
    if (selected.lanes.length === 0) {
      return failure("queue", "queue.entry.unobserved", `lane ${grammar.ref} is not observed`);
    }
    return { data: selected };
  },
});
