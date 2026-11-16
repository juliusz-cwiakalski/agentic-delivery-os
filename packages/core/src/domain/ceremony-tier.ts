/**
 * The ceremony tier engine (GH-296 F-7; DM-7; DEC-2, DEC-13; Appendix D).
 *
 * Exactly one mapping from the two delivered sources: the plan's `tier`
 * declaration (PLAN_KNOWN_TIERS + the canonical phase vocabulary) and the
 * pm-notes `variant` with PM_NOTES_REQUIRED_PHASES_BY_VARIANT. The recorded
 * variant supplies the effective phase set; a disagreement is a finding, never a
 * silent pick; declared plan phases narrow within the canonical eleven; the five
 * escalation triggers are evidence-gated; an unknown declared trigger is
 * reported verbatim as `unevaluated`. No phase-set literal is declared here.
 */
import {
  CANONICAL_PHASE_IDS,
  CEREMONY_ESCALATION_TRIGGERS,
  PLAN_KNOWN_TIERS,
  PM_NOTES_REQUIRED_PHASES_BY_VARIANT,
  type CeremonyEscalationTrigger,
  type CeremonyTierFinding,
  type CeremonyTierTriggerEvaluation,
  type CeremonyTierVerdict,
  type PmNotesVariant,
  type PlanTierDeclaration,
} from "#contracts";

/** One evidence fact per closed escalation trigger. */
export type CeremonyTierEvidence = {
  readonly "phase-reopen": boolean;
  readonly "dor-rework": boolean;
  readonly "review-rework": boolean;
  readonly "gate-failure": boolean;
  readonly "owner-escalation": boolean;
};

/** One tier evaluation input; every fact is declared data. */
export type CeremonyTierInput = {
  readonly plan: { readonly tier: PlanTierDeclaration };
  readonly variant: PmNotesVariant;
  readonly evidence?: CeremonyTierEvidence;
};

/** No evidence is recorded for any trigger. */
export const NO_CEREMONY_TIER_EVIDENCE: CeremonyTierEvidence = {
  "phase-reopen": false,
  "dor-rework": false,
  "review-rework": false,
  "gate-failure": false,
  "owner-escalation": false,
};

const isClosedTrigger = (value: string): value is CeremonyEscalationTrigger =>
  (CEREMONY_ESCALATION_TRIGGERS as readonly string[]).includes(value);

const canonicalSet: ReadonlySet<string> = new Set(CANONICAL_PHASE_IDS);

/** The variant's pinned phase set, imported element for element (no restating). */
export const ceremonyPhaseSetForVariant = (variant: PmNotesVariant): readonly string[] =>
  PM_NOTES_REQUIRED_PHASES_BY_VARIANT[variant];

const phaseSetSourceFor = (variant: PmNotesVariant): string =>
  `PM_NOTES_REQUIRED_PHASES_BY_VARIANT.${variant}`;

const canonicalSubset = (
  declared: readonly number[],
  findings: CeremonyTierFinding[],
): readonly string[] | undefined => {
  const resolved = new Set<string>();
  for (const phaseId of declared) {
    const id = Number.isInteger(phaseId) ? CANONICAL_PHASE_IDS[phaseId - 1] : undefined;
    if (id !== undefined && canonicalSet.has(id)) resolved.add(id);
    else {
      findings.push({
        kind: "unresolved-phase",
        subject: String(phaseId),
        detail: `"${String(phaseId)}" does not resolve to a canonical delivery phase`,
      });
    }
  }
  if (resolved.size === 0) return undefined;
  return CANONICAL_PHASE_IDS.filter((phase) => resolved.has(phase));
};

/** Evaluate one change's tier verdict from the two delivered sources. */
export const evaluateCeremonyTier = (input: CeremonyTierInput): CeremonyTierVerdict => {
  const findings: CeremonyTierFinding[] = [];
  const declaredVariant = input.variant;
  const declaredTier = input.plan.tier.name;
  const knownTier = (PLAN_KNOWN_TIERS as readonly string[]).includes(declaredTier);
  if (!knownTier || declaredTier !== declaredVariant) {
    findings.push({
      kind: "tier-mismatch",
      subject: `${declaredTier}/${declaredVariant}`,
      detail: knownTier
        ? `the plan declares "${declaredTier}" while the pm-notes variant records "${declaredVariant}"; the variant governs`
        : `the plan declares the unknown tier "${declaredTier}"; the recorded variant "${declaredVariant}" governs`,
    });
  }

  let effectiveTier: PmNotesVariant = declaredVariant;
  let phaseSet: readonly string[] = ceremonyPhaseSetForVariant(declaredVariant);
  let phaseSetSource = phaseSetSourceFor(declaredVariant);

  const declaredPhases = input.plan.tier.phases;
  if (declaredPhases !== undefined) {
    const subset = canonicalSubset(declaredPhases, findings);
    if (subset !== undefined) {
      phaseSet = subset;
      phaseSetSource = "plan.tier.phases";
    }
  }

  const evidence = input.evidence ?? NO_CEREMONY_TIER_EVIDENCE;
  const escalationTriggers: CeremonyTierTriggerEvaluation[] = [];
  const escalations: { trigger: string; evidence: string; effectiveFromPhase?: string }[] = [];
  for (const declared of input.plan.tier.escalationTriggers ?? []) {
    if (!isClosedTrigger(declared)) {
      escalationTriggers.push({ trigger: declared, state: "unevaluated" });
      findings.push({
        kind: "unevaluated-trigger",
        subject: declared,
        detail: `"${declared}" is outside the closed escalation vocabulary`,
      });
      continue;
    }
    const present = evidence[declared];
    if (present) {
      escalationTriggers.push({
        trigger: declared,
        state: "matched",
        evidence: `recorded:${declared}`,
      });
      escalations.push({
        trigger: declared,
        evidence: `recorded:${declared}`,
        effectiveFromPhase: "delivery",
      });
      effectiveTier = "full";
      phaseSet = ceremonyPhaseSetForVariant("full");
      phaseSetSource = phaseSetSourceFor("full");
    } else {
      escalationTriggers.push({ trigger: declared, state: "unmatched" });
    }
  }

  return {
    effectiveTier,
    phaseSet,
    phaseSetSource,
    declaredTier,
    declaredVariant,
    escalationTriggers,
    escalations,
    findings,
  };
};

/** One ceremony's tier obligation. */
export type CeremonyTierObligation = {
  readonly ceremony: string;
  readonly obligated: boolean;
  readonly tiers: readonly string[];
};

/**
 * The tiered-intake obligation: only declarations whose `tiers` include the
 * effective tier carry an obligation. An explicit run is never gated.
 */
export const ceremonyTierIntake = (
  declarations: readonly { readonly id: string; readonly tiers: readonly string[] }[],
  verdict: CeremonyTierVerdict,
): readonly CeremonyTierObligation[] =>
  declarations.map((declaration) => ({
    ceremony: declaration.id,
    obligated: declaration.tiers.includes(verdict.effectiveTier),
    tiers: declaration.tiers,
  }));
