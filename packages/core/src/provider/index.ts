/**
 * `@delivery-os/core/provider` — the pure provider engine surface (GH-182).
 *
 * Runtime-neutral: pure validation, peak arithmetic, condition combination, and
 * chain resolution. All I/O enters through injected seams in later phases.
 */
export {
  createProviderEngine,
  type ProviderEngine,
  type ProviderEngineDependencies,
  type ProviderQuotaInput,
  type ProviderResolveInput,
} from "./engine.js";
export {
  announcementCodeForCondition,
  createParkAnnouncement,
  createResumedAnnouncement,
  severityForAnnouncementCode,
} from "./announcements.js";
export {
  type ChainEntryState,
  type ChainResolutionInput,
  type ChainResolutionOutcome,
  resolveProviderChain,
} from "./chain.js";
export { combineProviderConditions } from "./conditions.js";
export {
  classifyQuotaTransport,
  evaluateQuotaResponse,
  evaluateQuotaSnapshot,
  type QuotaNormalizationFailure,
  normalizeQuotaEnvelopeResult,
} from "./quota.js";
export { type ProviderLoopInput, type ProviderLoopResult, runProviderLoop } from "./loop.js";
export {
  announcementEvidence,
  announcementIdentity,
  type AnnouncementInput,
  chainParkName,
  clearParkRecord,
  compareParks,
  createAnnouncementRecord,
  createParkRecord,
  foldParks,
  formatUtcIso,
  type ParkInput,
  parkGeneration,
  parkView,
  projectParkEvidence,
  providerParkName,
} from "./parks.js";
export { evaluatePeakWindow, utcSecondsOfDay } from "./peak.js";
export {
  parseAndValidateProviderConfiguration,
  parseProviderConfiguration,
  type ProviderChainSelection,
  type ProviderConfigResult,
  selectProviderChain,
  type ProviderValidationError,
  validateProviderConfiguration,
} from "./validate.js";
