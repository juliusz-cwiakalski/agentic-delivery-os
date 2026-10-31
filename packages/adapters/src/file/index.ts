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
  type PmNotesFileSystemFacts,
  type PmNotesParseResult,
  type PmNotesTargetRead,
  type PmNotesTargetRequest,
  parsePmNotesText,
  readPmNotesTarget,
} from "./pm-notes-parser.js";
export {
  type ParsedConfig,
  parseConfigYaml,
  parserHostSwitchBlocked,
} from "./yaml-parser.js";
