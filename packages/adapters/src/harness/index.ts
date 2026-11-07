/**
 * `@delivery-os/adapters/harness` — the harness delivery adapter subpath
 * (GH-233 OQ-T6).
 *
 * Re-exports both delivery adapters behind the shared port surface. The
 * production child-process implementation lives in `@delivery-os/adapters/host`;
 * composition injects it, together with the core-owned spawn-environment
 * builder, classifier, and liveness assembler.
 */
export {
  CLAUDE_CAPABILITIES,
  type ClaudeHarnessOptions,
  createClaudeInstance,
  createClaudeSession,
} from "./claude.js";
export {
  createOpencodeInstance,
  createOpencodeSession,
  OPENCODE_CAPABILITIES,
  type OpencodeHarnessOptions,
} from "./opencode.js";
export {
  attemptWrite,
  createBunSqliteStoreOpener,
  type HarnessOpenedStore,
  type HarnessSqliteHandle,
  type HarnessSqliteRow,
  type HarnessStoreOpener,
  openHarnessStoreReadOnly,
} from "./sqlite-loader.js";
export {
  type ClaudeTelemetryExtractor,
  type ClaudeTelemetryOptions,
  createClaudeTelemetryExtractor,
  createNodeFileReader,
  type HarnessFileRead,
  type HarnessFileReader,
} from "./telemetry-claude.js";
export {
  createOpencodeTelemetryExtractor,
  type OpencodeTelemetryExtractor,
  type OpencodeTelemetryOptions,
} from "./telemetry-opencode.js";
