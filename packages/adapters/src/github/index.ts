/**
 * `@delivery-os/adapters/github` — the GitHub provider slice.
 *
 * The public surface is the client factory, its input/return types, the adapter
 * contract, the bounded deploy-trace reader, and the transport factories the
 * composition edge chooses between. Provider-native payload shapes never cross
 * this boundary.
 */

export { GITHUB_ADAPTER_CONTRACT } from "./capabilities.js";
export {
  createGithubCliTransport,
  GITHUB_CLI_MAX_OUTPUT_BYTES,
  GITHUB_CLI_REFUSAL_CODES,
  GITHUB_CLI_VERSION_WINDOW,
  GITHUB_TRANSPORT_MATRIX,
  type GithubChildRunner,
  type GithubChildRunnerResult,
  type GithubCliProbeResult,
  type GithubCliRefusalCode,
  type GithubCliTransportOptions,
  type GithubTransportPolicy,
  type GithubTransportPreference,
  type GithubTransportSelection,
  probeGithubCli,
  resolveGithubCliConfigDirectory,
  resolveTransportSelection,
} from "./cli-transport.js";
export {
  createGitHubClient,
  createGithubNativeTransport,
  type GithubClient,
  type GithubClientOptions,
  type GithubRepositoryRef,
} from "./client.js";
export {
  createGitHubDeployTraceReader,
  type DeployTraceRepository,
  type GithubDeployArtifact,
  type GithubDeployStep,
  type GithubDeployTrace,
  type GithubDeployTraceOptions,
  type GithubDeployTraceReader,
  normalizeDeployTrace,
} from "./deploy-trace.js";
export {
  boundLogExcerpt,
  createGitHubLogExcerptReader,
  GITHUB_LOG_EXCERPT_MAX_BYTES,
  type GithubLogExcerpt,
  type GithubLogExcerptOptions,
  type GithubLogExcerptReader,
  type LogExcerptRepository,
} from "./log-excerpt.js";
export {
  createGitHubThreadDiscussionReader,
  GITHUB_THREAD_DISCUSSION_MAX_BODY_BYTES,
  GITHUB_THREAD_DISCUSSION_MAX_COMMENTS,
  type GithubThreadComment,
  type GithubThreadDiscussion,
  type GithubThreadDiscussionOptions,
  type GithubThreadDiscussionReader,
  normalizeThreadDiscussion,
} from "./thread-discussion.js";
/**
 * The declared issues transition seed, exported additively so the adapter's
 * reference behavior can be mechanically compared with the code it documents.
 */
export { GITHUB_WORKFLOW_MAP_SEED } from "./workflow-map.js";
