/**
 * `@delivery-os/adapters/file` — file I/O adapter subpath.
 * Supplies line-preserving configuration facts and platform file acquisition.
 */
export {
  acquireFileConfig,
  neutralEnvironmentFacts,
  nodeFileSystemFacts,
  runtimePlatform,
  type FileAcquisitionInput,
  type FileSystemFacts,
  type RuntimePlatform,
} from "./config-source.js";
export {
  parseConfigYaml,
  parserHostSwitchBlocked,
  type ParsedConfig,
} from "./yaml-parser.js";
