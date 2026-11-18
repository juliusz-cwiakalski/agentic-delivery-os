/**
 * The detection-only merged-diff owed-flip sweep (GH-240 F-5, DEC-8, NFR-3).
 *
 * One bounded added-line read over the recorded squash SHA and its parent. It
 * never edits source, removes a marker, commits, pushes, or reads history; its
 * only products are resolved owed-flip evidence and ambiguous-hit residue.
 */
import { sha256Hex } from "./sha256.js";
import {
  CAPSULE_DIFF_ACTIONS,
  CAPSULE_DIFF_MARKER_KINDS,
  CAPSULE_MARKER_ACTION_BY_KIND,
  CAPSULE_MAX_DIFF_BYTES,
  CAPSULE_MAX_DIFF_FILES,
  CAPSULE_MAX_DIFF_HITS,
  CLOSEOUT_DIFF_MARKERS,
  type CloseoutDiffHit,
  type CloseoutDiffRead,
  type CloseoutDiffSweepResult,
} from "#contracts";

const REF_PATTERN = /\b[A-Z][A-Z0-9]*-\d+\b/g;

type DiffMarker = (typeof CLOSEOUT_DIFF_MARKERS)[number];

const markersForLine = (line: string): readonly DiffMarker[] =>
  CLOSEOUT_DIFF_MARKERS.filter((marker) => new RegExp(marker.pattern, "i").test(line));

const DECLARED_ACTION = /\b(remove-guard|retire-flag|rename-class|close-todo)\b/;
// Any explicit non-empty token is a declaration; whether it is one of the
// four pinned tokens is validated by the classifier (F-23).
const EXPLICIT_ACTION = /@action:\s*([A-Za-z0-9][A-Za-z0-9_-]*)\b/;

type ActionReading = {
  readonly token?: string;
  readonly explicit: boolean;
};

/**
 * Read a declared action only from the four pinned tokens, in the marker's
 * declared segment, or from an explicit `@action:<token>` context. Ordinary
 * hyphenated prose never suppresses resolution (GH-240 F-16).
 */
const actionIn = (line: string, marker: DiffMarker): ActionReading => {
  const explicit = line.match(EXPLICIT_ACTION)?.[1];
  if (explicit !== undefined) return { token: explicit, explicit: true };
  const match = line.match(new RegExp(marker.pattern, "i"));
  const segment = match?.index === undefined ? line : line.slice(match.index);
  const declared = segment.match(DECLARED_ACTION)?.[1];
  return declared === undefined ? { explicit: false } : { token: declared, explicit: false };
};

const referencesIn = (line: string): readonly string[] => line.match(REF_PATTERN) ?? [];

const classify = (
  line: string,
  marker: DiffMarker,
  workItemRef: string,
): { readonly resolved: boolean; readonly action: string; readonly reason?: string } => {
  const expected = CAPSULE_MARKER_ACTION_BY_KIND[marker.kind];
  const reading = actionIn(line, marker);
  const token = reading.token;
  const action = token ?? marker.action;
  const declaredValid =
    (CAPSULE_DIFF_ACTIONS as readonly string[]).includes(marker.action) &&
    marker.action === expected;
  const references = referencesIn(line);
  if (!declaredValid) {
    return { resolved: false, action, reason: "kind-mismatch" };
  }
  if (references.length === 0 || !references.includes(workItemRef)) {
    return { resolved: false, action, reason: "unattributed" };
  }
  if (
    reading.explicit &&
    token !== undefined &&
    !(CAPSULE_DIFF_ACTIONS as readonly string[]).includes(token)
  ) {
    return { resolved: false, action, reason: "out-of-vocabulary-action" };
  }
  if (token !== undefined && token !== marker.action) {
    return { resolved: false, action, reason: "kind-mismatch" };
  }
  return { resolved: true, action: marker.action };
};

/** Evaluate one bounded diff read; `undefined` is the declared gap (F-5). */
export const evaluateDiffSweep = (input: {
  readonly diff?: CloseoutDiffRead;
  readonly workItemRef: string;
}): CloseoutDiffSweepResult => {
  if (input.diff === undefined) {
    return {
      status: "unavailable",
      reason: "merged-diff-unavailable",
      hits: [],
      bytes: 0,
      files: 0,
      truncated: false,
      omitted: 0,
    };
  }
  const encoded = new TextEncoder().encode(input.diff.text);
  const text = new TextDecoder().decode(encoded.slice(0, CAPSULE_MAX_DIFF_BYTES));
  const hits: CloseoutDiffHit[] = [];
  let filePath = "";
  let addedLine = 0;
  let omitted = 0;
  for (const line of text.split("\n")) {
    if (line.startsWith("+++ b/")) {
      filePath = line.slice("+++ b/".length).trim();
      addedLine = 0;
      continue;
    }
    if (!line.startsWith("+") || line.startsWith("+++")) continue;
    addedLine += 1;
    const content = line.slice(1);
    for (const marker of markersForLine(content)) {
      if (hits.length >= CAPSULE_MAX_DIFF_HITS) {
        omitted += 1;
        continue;
      }
      const verdict = classify(content, marker, input.workItemRef);
      const trimmed = content.trim();
      hits.push({
        kind: marker.kind,
        action: verdict.action,
        filePath,
        line: addedLine,
        text: trimmed.slice(0, 200),
        contentHash: sha256Hex(trimmed),
        resolved: verdict.resolved,
        ...(verdict.reason === undefined ? {} : { reason: verdict.reason }),
      });
    }
  }
  hits.sort((left, right) => {
    if (left.filePath !== right.filePath) return left.filePath < right.filePath ? -1 : 1;
    if (left.line !== right.line) return left.line - right.line;
    return left.kind < right.kind ? -1 : left.kind > right.kind ? 1 : 0;
  });
  return {
    status: "scanned",
    hits,
    bytes: Math.min(encoded.length, CAPSULE_MAX_DIFF_BYTES),
    files: Math.min(input.diff.files, CAPSULE_MAX_DIFF_FILES),
    truncated:
      encoded.length > CAPSULE_MAX_DIFF_BYTES ||
      omitted > 0 ||
      input.diff.files > CAPSULE_MAX_DIFF_FILES,
    omitted,
  };
};

/** The declared marker kinds and actions, exported for structural checks. */
export const diffMarkerVocabulary = {
  kinds: CAPSULE_DIFF_MARKER_KINDS,
  actions: CAPSULE_DIFF_ACTIONS,
} as const;
