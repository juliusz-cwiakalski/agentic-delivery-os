/**
 * The retro ceremony module (GH-296 F-9; DEC-3, DEC-4, DEC-17).
 *
 * Per-level note validation and the follow-through-first declaration shape over
 * the delivered retro pipeline. The pipeline is consumed read-only: this module
 * adds no collector, no sidecar, no chain, no registry record, and no action
 * filing. R1 stays closeout's own change-level retro.
 */
import {
  CEREMONY_LEVELS,
  type CeremonyDeclaration,
  type CeremonyLevel,
  type CeremonyNote,
} from "#contracts";

/** The declared trigger label each sub-R1 level stands for (F-9). */
export const RETRO_LEVEL_TRIGGER_LABELS = {
  session: "event:session-end",
  incident: "event:incident-severity",
  window: "schedule:daily",
  project: "event:milestone-end",
} as const;

/** The concept's fixed note members (F-9, DM-2). */
export const RETRO_FIXED_MEMBERS = [
  "level",
  "participants",
  "evidenceRefs",
  "facts",
  "interpretations",
  "wins",
  "gaps",
  "candidateLessons",
  "actions",
  "confidence",
] as const;

/** Whether a string is one of the four sub-R1 ceremony levels. */
export const isCeremonyLevelName = (value: string): value is CeremonyLevel =>
  (CEREMONY_LEVELS as readonly string[]).includes(value);

/** The level a note declares, when it declares one. */
export const retroLevelOf = (note: CeremonyNote | undefined): CeremonyLevel | undefined => {
  const level = note?.level;
  return level === undefined ? undefined : isCeremonyLevelName(level) ? level : undefined;
};

/** The missing fixed-schema members of one retro note, in declared order. */
export const missingRetroNoteMembers = (note: CeremonyNote): readonly string[] => {
  const record = note as unknown as Record<string, unknown>;
  return RETRO_FIXED_MEMBERS.filter((member) => record[member] === undefined);
};

/** The declared trigger label of one level. */
export const retroLevelTriggerLabel = (level: CeremonyLevel): string =>
  RETRO_LEVEL_TRIGGER_LABELS[level];

/** The level a declared or recorded trigger label stands for, if any. */
export const retroLevelForTrigger = (label: string): CeremonyLevel | undefined =>
  (Object.entries(RETRO_LEVEL_TRIGGER_LABELS) as readonly [CeremonyLevel, string][]).find(
    ([, trigger]) => trigger === label || trigger.endsWith(`:${label}`),
  )?.[0];

/**
 * Whether the retro declaration's first phase is follow-through verification.
 * The position is load-bearing: an edit moving it fails the parity suite (F-9).
 */
export const ceremonyFollowThroughFirst = (declaration: CeremonyDeclaration): boolean => {
  const [first] = declaration.agenda;
  if (first === undefined || first.id !== "follow-through") return false;
  const [step] = first.steps;
  return step !== undefined && step.kind === "fold";
};

/** The retro declaration's declared trigger labels and the absent `change-merged`. */
export const retroDeclarationShape = (declaration: CeremonyDeclaration) => ({
  triggerLabels: declaration.triggers.map((trigger) =>
    trigger.kind === "schedule" ? `schedule:${trigger.cadence}` : `event:${trigger.event}`,
  ),
  declaresChangeMerged: declaration.triggers.some(
    (trigger) => trigger.kind === "event" && trigger.event === "change-merged",
  ),
  levels: CEREMONY_LEVELS.filter((level) =>
    declaration.triggers.some((trigger) =>
      trigger.kind === "schedule"
        ? `schedule:${trigger.cadence}` === RETRO_LEVEL_TRIGGER_LABELS[level]
        : `event:${trigger.event}` === RETRO_LEVEL_TRIGGER_LABELS[level],
    ),
  ),
});
