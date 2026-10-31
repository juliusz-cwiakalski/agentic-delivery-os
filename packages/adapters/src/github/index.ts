/**
 * `@delivery-os/adapters/github` — minimal GitHub read slice (GH-188 F-4).
 *
 * The public surface is the client factory, its input/return types, and the
 * adapter contract. Provider-native payload shapes never cross this boundary.
 */

export { GITHUB_ADAPTER_CONTRACT } from "./capabilities.js";
export {
  createGitHubClient,
  type GithubClient,
  type GithubClientOptions,
  type GithubRepositoryRef,
} from "./client.js";
