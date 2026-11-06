/**
 * `@delivery-os/testkit/commit` — dev-only commit fakes and temp repositories.
 *
 * Consumers import this subpath from tests only; no production package may
 * depend on it (the testkit exclusion check enforces the separation).
 */
export {
  createSafetyScanner,
  createScriptedCommitlint,
  createScriptedTransport,
  transportAvailability,
  type ScriptedCommitlint,
  type ScriptedSafetyScanner,
  type ScriptedTransport,
  type ScriptedTransportStep,
} from "./transport-fakes.js";
export {
  createTempGitRepository,
  type RepoCommandResult,
  type TempGitRepository,
  type TempGitRepositoryOptions,
} from "./git-repo.js";
