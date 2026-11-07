/**
 * Resume-injection capability fixtures: both declared modes, the no-mode case,
 * the non-declaring case, and an absent capability.
 */
import type { BlockerCapabilityFact } from "../../../../packages/core/src/contracts/index";

export const boundaryNote = (): BlockerCapabilityFact => ({
  resumeInjection: true,
  mode: "boundary-note",
});

export const attachContinue = (): BlockerCapabilityFact => ({
  resumeInjection: true,
  mode: "attach-continue",
});

export const declaredWithoutMode = (): BlockerCapabilityFact => ({
  resumeInjection: true,
});

export const resumeDeclined = (): BlockerCapabilityFact => ({
  resumeInjection: false,
});

export const capabilityAbsent = (): undefined => undefined;

export const declaredModes = (): readonly BlockerCapabilityFact[] => [
  boundaryNote(),
  attachContinue(),
  declaredWithoutMode(),
];
