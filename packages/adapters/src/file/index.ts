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
  runtimePlatform,
} from "./config-source.js";
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
  isStoreArtifactName,
  readStateRootArtifacts,
} from "./state-root-inventory.js";
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
  applyPromotionWrite,
  checkPromotionConfinement,
  type MemoryReadFileSystem,
  type PromotionWriteResult,
  readMemoryFacts,
} from "./memory-promotion.js";
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
  createSecretScanner,
  SECRET_CONTENT_PATTERNS,
  SECRET_FILENAME_PATTERNS,
  type SecretScannerOptions,
} from "./secret-scan.js";
export {
  type ParsedConfig,
  parseConfigYaml,
  parserHostSwitchBlocked,
} from "./yaml-parser.js";
