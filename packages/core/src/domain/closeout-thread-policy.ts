/**
 * The human-vs-non-human review-thread policy (GH-240 F-6, DEC-9).
 *
 * Non-human threads resolve; human threads stay unresolved as identity-only
 * residue; unknown authorship is human (fail-closed). No body, title, or
 * subject is ever carried.
 */
import {
  CAPSULE_MAX_HUMAN_THREADS,
  CAPSULE_MAX_RESIDUE_ITEMS,
  type CloseoutResidueItem,
  type CloseoutThreadAuthorFact,
  type CloseoutThreadPolicyResult,
} from "#contracts";

/** Resolve only non-human threads; every other thread is identity-only residue. */
export const evaluateThreadPolicy = (input: {
  readonly threads?: readonly CloseoutThreadAuthorFact[];
}): CloseoutThreadPolicyResult => {
  if (input.threads === undefined) return { resolved: [], residue: [], omitted: 0 };
  const bounded = input.threads.slice(0, CAPSULE_MAX_HUMAN_THREADS);
  const resolved: string[] = [];
  const residue: CloseoutResidueItem[] = [];
  let omitted = input.threads.length - bounded.length;
  for (const thread of bounded) {
    if (thread.authorKind === "non-human") {
      resolved.push(thread.threadId);
      continue;
    }
    if (residue.length >= CAPSULE_MAX_RESIDUE_ITEMS) {
      omitted += 1;
      continue;
    }
    residue.push({
      item: `${thread.threadId} by ${thread.authorPrincipal}`,
      kind: "unresolved-human-thread",
      location: `thread:${thread.threadId}`,
    });
  }
  return { resolved, residue, omitted };
};
