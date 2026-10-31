/**
 * `@delivery-os/adapters/file` — file I/O adapter subpath.
 * Supplies line-preserving configuration facts and platform file acquisition.
 */
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
  type ParsedConfig,
  parseConfigYaml,
  parserHostSwitchBlocked,
} from "./yaml-parser.js";
