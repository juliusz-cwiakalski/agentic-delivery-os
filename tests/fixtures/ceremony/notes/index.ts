/**
 * The committed ceremony note builders (GH-296 §4.1.7). Synthetic values only:
 * no participant identity or evidence item resembles a real person or system.
 */
import {
  CEREMONY_NOTE_SCHEMA,
  type CeremonyNote,
  type CeremonyWindow,
} from "../../../../packages/core/src/contracts/index";

export const NOTE_WINDOW: CeremonyWindow = {
  start: "2026-11-15T00:00:00.000Z",
  end: "2026-11-15T23:59:59.999Z",
};

export const conformingNote = (
  ceremony: string,
  overrides: Partial<CeremonyNote> = {},
): CeremonyNote => ({
  schemaId: CEREMONY_NOTE_SCHEMA,
  ceremony,
  scopeKey: "session-alpha",
  window: NOTE_WINDOW,
  ...overrides,
});

export const retroNote = (
  ceremony: string,
  level: "session" | "incident" | "window" | "project",
  overrides: Partial<CeremonyNote> = {},
): CeremonyNote =>
  conformingNote(ceremony, {
    level,
    trigger:
      level === "session"
        ? "session-end"
        : level === "incident"
          ? "incident-severity"
          : level === "window"
            ? "schedule:daily"
            : "milestone-end",
    participants: ["delivery-agent"],
    evidenceRefs: ["evidence:session-1"],
    facts: ["A fact with a cited evidence reference."],
    interpretations: ["An interpretation with confidence."],
    wins: [{ text: "A win", mechanism: "the mechanism that produced it" }],
    gaps: ["A gap"],
    candidateLessons: ["A candidate lesson"],
    actions: ["verify the follow-through artifact"],
    confidence: "medium",
    ...overrides,
  });
