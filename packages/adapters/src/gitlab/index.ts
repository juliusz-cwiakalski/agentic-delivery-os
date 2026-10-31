/**
 * `@delivery-os/adapters/gitlab` — GitLab client seed (GH-188 F-2).
 *
 * The public surface is the client factory, its input/return types, and the
 * adapter contract. Provider-native payload shapes never cross this boundary.
 */

export { GITLAB_ADAPTER_CONTRACT } from "./capabilities.js";
export { createGitLabClient, type GitLabClient, type GitLabClientOptions } from "./client.js";
