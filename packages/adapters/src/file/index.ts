/**
 * `@delivery-os/adapters/file` — file I/O adapter subpath.
 * Supplies line-preserving configuration facts and platform file acquisition.
 */

export {
  type CapsuleRuntimeOptions,
  createCapsuleFileRuntime,
  nodeCapsuleFileSystemFacts,
} from "./capsule.js";
export {
  ceremonyArtifactsDirectory,
  ceremonyArtifactsDirectoryName,
  createCeremonyArtifactStore,
} from "./ceremony-artifacts.js";
export {
  CEREMONY_DECLARATIONS_FILE_NAME,
  type CeremonyDeclarationDocumentRead,
  type CeremonyDeclarationFileSystem,
  ceremonyDeclarationDocumentPath,
  nodeCeremonyDeclarationFileSystem,
  parseCeremonyNoteText,
  readCeremonyDeclarationDocument,
} from "./ceremony-declarations.js";
export {
  type CeremonyLifecycleTransitionFact,
  type CeremonyTierContextFileSystem,
  type CeremonyTierContextFiles,
  ceremonyTierEvidenceFromLifecycle,
  nodeCeremonyTierContextFileSystem,
  planTierOf,
  readCeremonyTierContextFiles,
} from "./ceremony-tier-context.js";
export {
  type ChangeFolderFileSystem,
  type ChangeFolderLookup,
  type ChangeFolderRequest,
  locateChangeFolder,
  relativeChangeFolder,
  resolveChangeFolder,
} from "./change-folder.js";
export { type CiWorkflowJobNamesRead, readCiWorkflowJobNames } from "./ci-workflow.js";
export {
  COMMITLINT_CONFIG_FILES,
  type CommitlintProbeChildResult,
  type CommitlintProbeOptions,
  type CommitlintProbeRunner,
  createCommitlintProbe,
  hasCommitlintConfig,
} from "./commitlint.js";
export {
  acquireFileConfig,
  type FileAcquisitionInput,
  type FileSystemFacts,
  neutralEnvironmentFacts,
  nodeFileSystemFacts,
  type RuntimePlatform,
  readCommittedConfigDocument,
  runtimePlatform,
} from "./config-source.js";
export {
  type AffectedRepositoryTarget,
  affectedRepositoryTargets,
  copyDecisionRecords,
  DECISION_RECORD_ID_PATTERN,
  type DecisionMirrorApplyResult,
  type DecisionRecordFileSystem,
  type DecisionRegisterRead,
  decisionRecordIdOf,
  decisionRecordIds,
  nodeDecisionRecordFileSystem,
  readDecisionRegister,
} from "./decision-register.js";
export {
  type DispatchAuthorityFact,
  dispatchAuthorityDocumentName,
  dualRunDispatchAuthority,
  listDispatchAuthority,
  readDispatchAuthority,
  readDispatchAuthorityFact,
} from "./dispatch-authority.js";
export {
  dispatchIdentityMarkerPath,
  ensureDispatchIdentityMarkerText,
  readDispatchIdentityMarkerText,
  replaceDispatchIdentityMarkerText,
} from "./dispatch-identity.js";
export {
  createHostIndexAccess,
  type HostIndexAccess,
  type HostIndexRead,
  hostIndexDocumentPath,
  hostIndexExists,
  preserveCorruptHostIndex,
  readHostIndexFile,
  replaceHostIndexFile,
} from "./host-index-store.js";
export {
  classifyInstallDestination,
  createNodeInstallFilePort,
  INSTALL_ARTIFACT_MODE,
  INSTALL_DESTINATION_CLASSES,
  type InstallDestinationClass,
  isCompiledArtifactAtPath,
  isLauncherAtPath,
  LAUNCHER_TARGET_MARKER,
  launcherTargetOf,
  symlinkTargetOf,
} from "./install-destination.js";
export {
  INSTALL_RECORD_MODE,
  removeInstallRecord,
  writeInstallRecordText,
} from "./install-record.js";
export {
  enumerateStateRoots,
  type StateRootEnumeration,
  type StateRootFacts,
} from "./install-state-roots.js";
export {
  applyPromotionWrite,
  checkPromotionConfinement,
  type MemoryReadFileSystem,
  type PromotionWriteResult,
  readMemoryFacts,
} from "./memory-promotion.js";
export {
  type MemoryScanDirectoryEntry,
  type MemoryScanFileSystem,
  type MemoryScanResult,
  nodeMemoryScanFileSystem,
  scanMemoryTree,
} from "./memory-scan.js";
export {
  type MetricsBaselineReadInput,
  readMetricsBaselineLog,
  validateMetricsBaselineDocument,
} from "./metrics-baseline.js";
export {
  extractMetricsBurnRateNode,
  readMetricsBurnRateNode,
} from "./metrics-config.js";
export {
  corpusRowsOfDocument,
  METRICS_CORPUS_BLOCK,
  METRICS_CORPUS_MAX_DEPTH,
  METRICS_CORPUS_MAX_FILES,
  type MetricsCorpusFileSystemFacts,
  type MetricsCorpusReadInput,
  scanMetricsCorpus,
} from "./metrics-corpus.js";
export {
  nodeOwnerHoldMarkerFileSystem,
  type OwnerHoldMarkerFileSystem,
  type OwnerHoldMarkerReadInput,
  ownerHoldMarkerPath,
  readOwnerHoldMarker,
} from "./owner-hold-marker.js";
export {
  type PlanArtifactRequest,
  readPlanArtifact,
} from "./plan-artifact.js";
export { readLocalPmContext } from "./pm-context.js";
export {
  nodePmNotesFileSystemFacts,
  type PmNotesEntryEdit,
  type PmNotesFileSystemFacts,
  type PmNotesParseResult,
  type PmNotesStageResult,
  type PmNotesTargetRead,
  type PmNotesTargetRequest,
  type PmNotesTextRead,
  parsePmNotesText,
  readPmNotesTarget,
  readPmNotesText,
  stagePmNotesPhaseEntry,
} from "./pm-notes-parser.js";
export {
  ensureProjectIdentityMarkerText,
  projectIdentityMarkerPath,
  readProjectIdentityMarker,
} from "./project-identity.js";
export {
  nodeProjectConfigFileSystem,
  type ProjectConfigFileSystem,
  type ProjectGroupsConfigRead,
  projectGroupsConfigPath,
  readProjectGroupsConfig,
} from "./projects-config.js";
export {
  createSecretScanner,
  SECRET_CONTENT_PATTERNS,
  SECRET_FILENAME_PATTERNS,
  type SecretScannerOptions,
} from "./secret-scan.js";
export {
  isStoreArtifactName,
  readStateRootArtifacts,
} from "./state-root-inventory.js";
export {
  nodeWorkspaceScanFileSystem,
  scanDeclaredWorkspaceMembers,
  type WorkspaceLocatedClone,
  type WorkspaceScanEntry,
  type WorkspaceScanFileSystem,
  type WorkspaceScanMember,
} from "./workspace-scan.js";
export {
  type ParsedConfig,
  parseConfigYaml,
  parserHostSwitchBlocked,
} from "./yaml-parser.js";
