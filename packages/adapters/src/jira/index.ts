/**
 * `@delivery-os/adapters/jira` — Jira read-slice client seed (GH-188 F-3).
 *
 * The public surface is the client factory, its input/return types, and the
 * adapter contract. Provider-native payload shapes never cross this boundary.
 */

export { JIRA_ADAPTER_CONTRACT } from "./capabilities.js";
export { createJiraClient, type JiraClient, type JiraClientOptions } from "./client.js";
