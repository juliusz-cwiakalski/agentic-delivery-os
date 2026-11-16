/**
 * The ceremony tier context reader (GH-296 F-7 composition; DM-7).
 *
 * Resolves one checkout's delivery context for the tier engine from delivered
 * data only: the pm-notes `variant` and `blockers` collection of the selected
 * change, and the plan document's `tier` declaration. Filesystem facts are
 * injected; both reads are bounded by the configuration parser class limits.
 * Absence degrades exactly as the delivered rules state: an absent or invalid
 * pm-notes variant is `full` (absence means full), an unreadable or malformed
 * plan tier declares the unknown tier name the engine reports verbatim, and an
 * absent lifecycle history yields no evidence.
 */
import type { PlanTierDeclaration } from "@delivery-os/core/contracts";
import { type ChangeFolderFileSystem, locateChangeFolder } from "./change-folder.js";
import {
  nodePmNotesFileSystemFacts,
  type PmNotesFileSystemFacts,
  parsePmNotesText,
  readPmNotesTarget,
} from "./pm-notes-parser.js";

/** The resolved tier context one selected change supplies. */
export type CeremonyTierContextFiles = {
  /** The recorded variant; absent or invalid reads as `full` (absence means full). */
  readonly variant: "full" | "lite";
  /** The plan's `tier` declaration; an unreadable tier declares the unknown name. */
  readonly planTier: PlanTierDeclaration;
  /** Whether the pm-notes `blockers` collection carries an open entry. */
  readonly ownerEscalation: boolean;
  /** The change ref the context was resolved from, when one was supplied. */
  readonly changeRef?: string;
};

/** The injected filesystem facts; production wraps `node:fs`. */
export type CeremonyTierContextFileSystem = PmNotesFileSystemFacts & ChangeFolderFileSystem;

/** The production filesystem facts over `node:fs`. */
export const nodeCeremonyTierContextFileSystem = (): CeremonyTierContextFileSystem =>
  nodePmNotesFileSystemFacts();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Narrow one plan document's `tier` member; anything unreadable is unknown. */
export const planTierOf = (document: unknown): PlanTierDeclaration => {
  if (!isRecord(document) || !isRecord(document.tier)) return { name: "unknown" };
  const tier = document.tier;
  const name = typeof tier.name === "string" && tier.name.length > 0 ? tier.name : "unknown";
  const phases = Array.isArray(tier.phases)
    ? tier.phases.filter((entry): entry is number => typeof entry === "number")
    : undefined;
  const triggers = Array.isArray(tier.escalationTriggers)
    ? tier.escalationTriggers.filter((entry): entry is string => typeof entry === "string")
    : undefined;
  return {
    name,
    ...(phases !== undefined && phases.length > 0 ? { phases } : {}),
    ...(triggers !== undefined && triggers.length > 0 ? { escalationTriggers: triggers } : {}),
  };
};

/** Read one selected change's pm-notes variant, blockers, and plan tier. */
export const readCeremonyTierContextFiles = (input: {
  readonly changeRef: string;
  readonly changesDirectory: string;
  readonly fs: CeremonyTierContextFileSystem;
}): CeremonyTierContextFiles => {
  const notes = readPmNotesTarget({
    changeRef: input.changeRef,
    changesDirectory: input.changesDirectory,
    fs: input.fs,
  });
  let variant: "full" | "lite" = "full";
  let ownerEscalation = false;
  if (notes.ok) {
    const document = notes.value;
    if (isRecord(document)) {
      if (document.variant === "lite") variant = "lite";
      if (Array.isArray(document.blockers) && document.blockers.length > 0) {
        ownerEscalation = true;
      }
    }
  }
  const folder = locateChangeFolder({
    changeRef: input.changeRef,
    changesDirectory: input.changesDirectory,
    fs: input.fs,
  });
  let planTier: PlanTierDeclaration = { name: "unknown" };
  if (folder !== undefined) {
    try {
      const planPath = `${folder}/chg-${input.changeRef}-plan.yaml`;
      const parsed = parsePmNotesText(input.fs.readText(planPath), planPath);
      if (parsed.ok) planTier = planTierOf(parsed.value);
    } catch {
      planTier = { name: "unknown" };
    }
  }
  return { variant, planTier, ownerEscalation, changeRef: input.changeRef };
};

/** One recorded lifecycle transition, narrowed for tier evidence mapping. */
export type CeremonyLifecycleTransitionFact = {
  readonly phaseId: string;
  readonly operation: string;
  readonly reason?: string;
};

/**
 * Map recorded lifecycle evidence to the closed escalation-trigger facts
 * (F-7). The mapping keys on the recorded truth: any reopen of the change is
 * `phase-reopen`; a recorded reopen of `review_fix` is `review-rework`; a
 * recorded reopen of `quality_gates` is `gate-failure`; a recorded reopen of
 * `dor_check` is `dor-rework`; an open pm-notes blocker entry is
 * `owner-escalation`. An unmapped trigger reads false — never invented.
 */
export const ceremonyTierEvidenceFromLifecycle = (input: {
  readonly transitions: readonly CeremonyLifecycleTransitionFact[];
  readonly ownerEscalation: boolean;
}): {
  readonly "phase-reopen": boolean;
  readonly "dor-rework": boolean;
  readonly "review-rework": boolean;
  readonly "gate-failure": boolean;
  readonly "owner-escalation": boolean;
} => {
  let phaseReopen = false;
  let dorRework = false;
  let reviewRework = false;
  let gateFailure = false;
  for (const transition of input.transitions) {
    if (transition.operation !== "reopen") continue;
    phaseReopen = true;
    if (transition.phaseId === "dor_check") dorRework = true;
    if (transition.phaseId === "review_fix") reviewRework = true;
    if (transition.phaseId === "quality_gates") gateFailure = true;
  }
  return {
    "phase-reopen": phaseReopen,
    "dor-rework": dorRework,
    "review-rework": reviewRework,
    "gate-failure": gateFailure,
    "owner-escalation": input.ownerEscalation,
  };
};
