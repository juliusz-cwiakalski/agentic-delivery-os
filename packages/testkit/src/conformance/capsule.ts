/**
 * Capsule event conformance registry (GH-240 F-1, F-2; TC-CAP-002).
 *
 * The registry is data plus one pure validator: every declared event kind has
 * exactly one writer and one named producer, and no producer-less or unknown
 * kind can be registered. Coverage is a bijection with the closed vocabulary.
 */
import {
  CAPSULE_EVENT_KINDS,
  CAPSULE_WRITERS,
  type CapsuleEventKind,
  type CapsuleWriter,
} from "@delivery-os/core/contracts";

/** One registered kind: its owner writer and the producer that emits it. */
export type CapsuleConformanceEntry = {
  readonly kind: CapsuleEventKind;
  readonly writer: CapsuleWriter;
  readonly producer: string;
};

/** The shipped registry: one entry per declared event kind. */
export const CAPSULE_CONFORMANCE_REGISTRY: readonly CapsuleConformanceEntry[] = [
  { kind: "capsule.opened", writer: "closeout", producer: "closeout capsule step" },
  { kind: "phase.transition", writer: "phase", producer: "phase command" },
  { kind: "commit.landed", writer: "commit", producer: "commit command" },
  { kind: "gate.outcome", writer: "verify", producer: "verify gates command" },
  { kind: "review.verdict", writer: "closeout", producer: "closeout review ingestion" },
  { kind: "closeout.step", writer: "closeout", producer: "closeout step evidence" },
  { kind: "capsule.promotion", writer: "closeout", producer: "closeout promotion stage" },
  { kind: "capsule.retro-coverage", writer: "closeout", producer: "closeout retro coverage" },
  {
    kind: "capsule.compaction-checkpoint",
    writer: "closeout",
    producer: "closeout session compaction",
  },
  { kind: "capsule.backfill-gap", writer: "closeout", producer: "closeout pre-contract backfill" },
  { kind: "capsule.closed", writer: "closeout", producer: "closeout capsule step" },
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Validate a registry against the closed vocabularies.
 *
 * A missing kind, a duplicate kind, an unknown kind or writer, and an empty
 * producer are all violations; an empty list means the registry is exactly the
 * declared vocabulary with one owner each.
 */
export const capsuleConformanceViolations = (registry: readonly unknown[]): string[] => {
  const violations: string[] = [];
  const seen = new Set<string>();
  for (const [index, raw] of registry.entries()) {
    if (!isRecord(raw)) {
      violations.push(`registry entry ${index} is not an object`);
      continue;
    }
    const kind = raw.kind;
    const writer = raw.writer;
    const producer = raw.producer;
    if (typeof kind !== "string" || !(CAPSULE_EVENT_KINDS as readonly string[]).includes(kind)) {
      violations.push(`registry entry ${index} kind is outside the closed vocabulary`);
      continue;
    }
    if (seen.has(kind)) violations.push(`kind ${kind} is registered more than once`);
    seen.add(kind);
    if (typeof writer !== "string" || !(CAPSULE_WRITERS as readonly string[]).includes(writer)) {
      violations.push(`kind ${kind} has an unknown writer`);
    }
    if (typeof producer !== "string" || producer.trim().length === 0) {
      violations.push(`kind ${kind} has no producer case`);
    }
  }
  for (const kind of CAPSULE_EVENT_KINDS) {
    if (!seen.has(kind)) violations.push(`kind ${kind} is missing from the registry`);
  }
  return violations;
};
