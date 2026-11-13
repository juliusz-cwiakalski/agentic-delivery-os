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
  createProfileProbePort,
  createProviderEngine,
  createProviderFactsProbe,
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
export {
  evaluatePeakWindow,
  peakWindowEndSeconds,
  peakWindowOpenSeconds,
  utcSecondsOfDay,
} from "./peak.js";
export {
  deriveGraceSecondsMax,
  PEAK_RULES_ERROR_CODE,
  type PeakRulesFailure,
  type PeakRulesResult,
  parseProfilePeakWindow,
  parseProfilePeakWindows,
} from "./peak-rules.js";
export {
  createProfileEvent,
  familyDiversityAllowed,
  type ProfileEventInput,
  type ProfileHeuristicPolicy,
  type ProfileSelectionInput,
  type ProfileSelectionOptions,
  type ProfileSpawnInput,
  type ProfileSpawnOutcome,
  type ProfileSpawnPort,
  type ProfileSpawnRunInput,
  type ProfileTaskFacts,
  profileEventIdentity,
  projectProfileEvidence,
  resolveProfileForSpawn,
  runProfileSpawn,
  scoreProfileTask,
  selectProfile,
  targetSeatName,
} from "./profile.js";
export {
  buildProfileEnvRecord,
  type EnvRecordErrorCode,
  type EnvRecordValidation,
  type EnvRecordValidationError,
  envRecordNameForSeat,
  type ProfileEnvRecordInput,
  type ResolvedEnvRecordPolicy,
  resolveEnvRecordPolicy,
  serializeEnvRecord,
  validateEnvRecord,
} from "./profile-env-record.js";
export {
  createProfileTargetRecord,
  evaluateProfileLifecycle,
  type PersistProfileTargetInput,
  type PersistProfileTargetOutcome,
  type ProfileLifecycleInput,
  type ProfileLifecycleOutcome,
  type ProfileTargetRecordInput,
  persistProfileTarget,
  readProfileTarget,
} from "./profile-lifecycle.js";
export {
  activeRung,
  evaluatePacing,
  type PacingEvaluation,
  type PacingEvaluationInput,
  rungState,
} from "./profile-pacing.js";
export {
  classifyQuotaTransport,
  createProviderWatchStatus,
  evaluateQuotaResponse,
  evaluateQuotaSnapshot,
  normalizeQuotaEnvelopeResult,
  type ProviderWatchStatusInput,
  type ProviderWatchStatusReader,
  type ProviderWatchStatusResult,
  type ProviderWatchStatusRuntime,
  type QuotaNormalizationFailure,
} from "./quota.js";
export {
  emptyProfileConfiguration,
  type ProfileConfigResult,
  type ProfileValidationError,
  type ProfileValidationErrorCode,
  type ProviderChainSelection,
  type ProviderConfigResult,
  type ProviderValidationError,
  parseAndValidateProfileConfiguration,
  parseAndValidateProviderConfiguration,
  parseProfileConfiguration,
  parseProviderConfiguration,
  selectProviderChain,
  validateProfileConfiguration,
  validateProviderConfiguration,
} from "./validate.js";
