/**
 * `@delivery-os/cli` commands tier (`#commands/*` alias target).
 * Exposes the config command definition for edge composition.
 */

export type { ConfigCommandRuntime } from "./config.js";
export { createConfigCommandDefinition } from "./config.js";
export type { DbCommandRuntime } from "./db.js";
export { createDbCommandDefinition } from "./db.js";
export type {
  LintCommandRuntime,
  LintPmNotesRead,
  LintRegistryRead,
} from "./lint.js";
export { createLintCommandDefinition } from "./lint.js";
export type {
  PhaseCommandRuntime,
  PhasePmNotesRead,
  PhaseRegistryRead,
  PhaseTransitionWrite,
} from "./phase.js";
export { createPhaseCommandDefinition } from "./phase.js";
export type { ProviderCommandRuntime } from "./provider.js";
export { createProviderCommandDefinition } from "./provider.js";
export type { StatusCommandRuntime } from "./status.js";
export { createStatusCommandDefinition } from "./status.js";
export type {
  VerifyCommandRuntime,
  VerifyPmNotesRead,
  VerifyRegistryRead,
} from "./verify.js";
export { createVerifyCommandDefinition } from "./verify.js";
