/**
 * `@delivery-os/testkit/commit` — dev-only commit fakes and temp repositories.
 *
 * Consumers import this subpath from tests only; no production package may
 * depend on it (the testkit exclusion check enforces the separation).
 */

export {
  createTempGitRepository,
  type RepoCommandResult,
  type TempGitRepository,
  type TempGitRepositoryOptions,
} from "./git-repo.js";
export {
  createSafetyScanner,
  createScriptedCommitlint,
  createScriptedTransport,
  type ScriptedCommitlint,
  type ScriptedSafetyScanner,
  type ScriptedTransport,
  type ScriptedTransportStep,
  transportAvailability,
} from "./transport-fakes.js";
