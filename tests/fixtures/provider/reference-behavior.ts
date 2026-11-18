/**
 * The one declared locator for the adapter reference-behavior surface.
 *
 * GAP-TP-2 keeps the document path and its parseable headings in one place: if
 * the path or a heading changes, this fixture and the index row move together,
 * and the drift test names the missing document or section instead of skipping.
 */
export const REFERENCE_BEHAVIOR_DOCUMENT =
  "doc/spec/features/feature-adapter-reference-behavior.md";

/** The documentation index that must link the surface. */
export const REFERENCE_BEHAVIOR_INDEX = "doc/00-index.md";

/** The index link target the reference-behavior surface is registered under. */
export const REFERENCE_BEHAVIOR_INDEX_TARGET =
  "spec/features/feature-adapter-reference-behavior.md";

/** The parseable section headings, in document order. */
export const REFERENCE_BEHAVIOR_SECTIONS = {
  transports: "## Transport matrix",
  capabilities: "## Capability posture",
  failures: "## Failure identities",
  absence: "## Absence semantics",
  discussion: "## Evidence read: review-thread discussion",
  excerpt: "## Evidence read: failure log excerpt",
  transport: "## CLI transport, probe, and composition selection",
  mapping: "## Workflow mapping",
} as const;

/** The declared table headers the parser requires before comparing values. */
export const REFERENCE_BEHAVIOR_TABLE_HEADERS = {
  transports: ["Operation", "Preferred", "Fallback"],
  capabilities: ["Adapter", "Supported", "Gaps", "Gap reasons"],
  absence: ["Signal", "Absent means", "Never"],
  seed: ["Precedence", "Token", "Delivery alias", "Mechanism"],
  probe: ["Refusal code", "Meaning"],
} as const;
