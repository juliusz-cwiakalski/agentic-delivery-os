/**
 * `@delivery-os/core/provider` — the pure provider engine surface (GH-182).
 *
 * Runtime-neutral: pure validation, peak arithmetic, condition combination, and
 * chain resolution. All I/O enters through injected seams in later phases.
 */

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
  createProviderEngine,
  type ProviderEngine,
  type ProviderEngineDependencies,
  type ProviderQuotaInput,
  type ProviderResolveInput,
} from "./engine.js";
export { type ProviderLoopInput, type ProviderLoopResult, runProviderLoop } from "./loop.js";
export {
  type AnnouncementInput,
  announcementEvidence,
  announcementIdentity,
  chainParkName,
  clearParkRecord,
  compareParks,
  createAnnouncementRecord,
  createParkRecord,
  foldParks,
  formatUtcIso,
  type ParkInput,
  type PersistResolutionInput,
  type PersistResolutionOutcome,
  parkGeneration,
  parkView,
  persistProviderResolution,
  projectParkEvidence,
  providerParkName,
  providerParksProjection,
  readProviderLedger,
  readProviderParkViews,
} from "./parks.js";
export { evaluatePeakWindow, utcSecondsOfDay } from "./peak.js";
export {
  classifyQuotaTransport,
  evaluateQuotaResponse,
  evaluateQuotaSnapshot,
  normalizeQuotaEnvelopeResult,
  type QuotaNormalizationFailure,
} from "./quota.js";
export {
  type ProviderChainSelection,
  type ProviderConfigResult,
  type ProviderValidationError,
  parseAndValidateProviderConfiguration,
  parseProviderConfiguration,
  selectProviderChain,
  validateProviderConfiguration,
} from "./validate.js";
